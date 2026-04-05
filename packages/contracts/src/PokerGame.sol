// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "./HandEvaluator.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { BITE, PublicKey } from "@skalenetwork/bite-solidity/BITE.sol";
import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";

/**
 * @title PokerGame
 * @notice BITE-powered confidential Texas Hold'em poker.
 *
 *         PRIVACY MODEL — mirrors real poker:
 *           - Hole cards are PRIVATE (BITE encrypted). No one except the
 *             player can see their cards until showdown.
 *           - All actions (fold, check, call, raise) are PUBLIC — just like
 *             sitting at a real table where everyone watches every move.
 *           - Joining/leaving the table is PUBLIC.
 *
 *         CARD ENCRYPTION:
 *         Hole cards are dual-encrypted at deal time:
 *           - TE-encrypted (threshold) → stored for showdown CTX decryption
 *           - ECIES-encrypted → to each player's viewer key for client-side decrypt
 *         Plaintext cards are NEVER stored on-chain. They only exist briefly
 *         inside the onDecrypt callback at showdown.
 *
 *         TOKEN:
 *         All game mechanics (buy-in, blinds, betting, payouts) use ERC-20.
 *         msg.value is used ONLY for revealCards() to fund the CTX callback gas.
 *
 *         State machine: Waiting → Preflop → Flop → Turn → River → Showdown
 */
contract PokerGame is IBiteSupplicant {
    using HandEvaluator for uint8[7];

    // ─── Enums ───────────────────────────────────────────────────────────
    enum GamePhase {
        Waiting,   // 0: waiting for players
        Preflop,   // 1: preflop betting (cards dealt, blinds posted)
        Flop,      // 2: flop betting
        Turn,      // 3: turn betting
        River,     // 4: river betting
        Showdown   // 5: card reveal and pot distribution
    }

    // ─── Structs ─────────────────────────────────────────────────────────
    struct Player {
        address addr;
        PublicKey viewerKey;              // ECIES public key for encrypting their cards
        uint8[2] holeCards;               // ONLY populated in onDecrypt at showdown; zero otherwise
        bool isActive;                    // hasn't folded this hand
        bool hasActed;                    // acted this betting round
        uint256 betAmount;                // total bet in current betting round
        bool isAllIn;
        uint256 stack;                    // chip stack (ERC-20 balance in contract)
        bytes teEncryptedHoleCards;       // TE-encrypted for showdown CTX decryption
        bytes eciesEncryptedHoleCards;    // ECIES-encrypted to player's viewer key
        bool cardsRevealed;               // true after showdown decryption
    }

    // ─── Constants ───────────────────────────────────────────────────────
    uint256 public constant SMALL_BLIND = 5 * 10**6;    // 5 USDC
    uint256 public constant BIG_BLIND = 10 * 10**6;     // 10 USDC
    uint256 public constant MAX_PLAYERS = 10;
    uint256 public constant MIN_PLAYERS = 2;
    uint256 public constant BUY_IN = 1000 * 10**6;  // 1000 USDC (6 decimals)

    /// @notice Minimum gas to reserve for the CTX callback
    uint256 public minCallbackGas = 500_000;

    // ─── State ───────────────────────────────────────────────────────────
    GamePhase public phase;
    address public owner;
    uint256 public handNumber;
    uint256 public currentBet;
    uint256 public currentTurnIndex;
    address public dealer;
    uint256 public dealerIndex;

    IERC20 public sklToken;
    Player[] public players;
    uint8[5] public communityCards;
    uint256 public pot;

    mapping(address => bool) private _canCallOnDecrypt;
    bool private _showdownPending;

    // ─── Events ──────────────────────────────────────────────────────────
    event PlayerJoined(address indexed player, uint256 seat);
    event GameStarted(uint256 handNumber, address indexed dealer);
    event CardsDealt(address indexed player);
    event CardsEncrypted(address indexed player, uint256 playerIndex);
    event PhaseChanged(GamePhase newPhase);
    event PlayerFolded(address indexed player);
    event PlayerChecked(address indexed player);
    event PlayerCalled(address indexed player, uint256 amount);
    event PlayerRaised(address indexed player, uint256 totalBet);
    event PlayerWentAllIn(address indexed player, uint256 amount);
    event FlopDealt(uint8 card1, uint8 card2, uint8 card3);
    event TurnDealt(uint8 card);
    event RiverDealt(uint8 card);
    event ShowdownInitiated(uint256 activePlayerCount);
    event CardsRevealed(address indexed player, uint8 card1, uint8 card2);
    event Winner(address indexed player, uint256 amount, string handName);
    event PotAwarded(address indexed player, uint256 amount);
    event HandComplete();
    event PlayerLeft(address indexed player, uint256 returned);

    // ─── Errors ──────────────────────────────────────────────────────────
    error NotOwner();
    error NotAPlayer();
    error NotYourTurn();
    error NotBettingPhase();
    error GameIsFull();
    error AlreadyJoined();
    error NotEnoughPlayers();
    error MustCallOrRaise();
    error NotEnoughForCall();
    error NotEnoughForRaise();
    error TransferFailed();
    error InvalidPlayerIndex();
    error NoCardsDealt();
    error CardsAlreadyRevealed();
    error ShowdownInProgress();
    error NotAtRiver();
    error CardsNotYetRevealed();
    error InsufficientCallbackGas();
    error AccessDenied();

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, NotOwner());
        _;
    }

    modifier onlyPlayer() {
        require(_playerIndex(msg.sender) != type(uint256).max, NotAPlayer());
        _;
    }

    modifier isCurrentTurn() {
        require(players[currentTurnIndex].addr == msg.sender, NotYourTurn());
        _;
    }

    modifier inBettingPhase() {
        require(
            phase == GamePhase.Preflop || phase == GamePhase.Flop ||
            phase == GamePhase.Turn || phase == GamePhase.River,
            NotBettingPhase()
        );
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _sklToken) {
        owner = msg.sender;
        sklToken = IERC20(_sklToken);
        phase = GamePhase.Waiting;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC ACTIONS — all game actions are on-chain and visible to all
    // (just like sitting at a real poker table)
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Sit down at the table with your ECIES viewer key.
    ///         You must have approved this contract to transfer BUY_IN tokens.
    function sitDown(PublicKey calldata viewerKey) external {
        require(phase == GamePhase.Waiting, "Game not waiting");
        require(players.length < MAX_PLAYERS, GameIsFull());
        require(_playerIndex(msg.sender) == type(uint256).max, AlreadyJoined());

        // Transfer BUY_IN from player
        bool ok = sklToken.transferFrom(msg.sender, address(this), BUY_IN);
        require(ok, TransferFailed());

        players.push(Player({
            addr: msg.sender,
            viewerKey: viewerKey,
            holeCards: [uint8(0), uint8(0)],
            isActive: true,
            hasActed: false,
            betAmount: 0,
            isAllIn: false,
            stack: BUY_IN,
            teEncryptedHoleCards: bytes(""),
            eciesEncryptedHoleCards: bytes(""),
            cardsRevealed: false
        }));

        emit PlayerJoined(msg.sender, players.length - 1);
    }

    /// @notice Fold your hand.
    function fold() external onlyPlayer isCurrentTurn inBettingPhase {
        players[currentTurnIndex].isActive = false;
        players[currentTurnIndex].hasActed = true;
        emit PlayerFolded(msg.sender);
        _advanceTurn();
    }

    /// @notice Check (pass). Only valid when there's no bet to match.
    function check() external onlyPlayer isCurrentTurn inBettingPhase {
        require(players[currentTurnIndex].betAmount >= currentBet, MustCallOrRaise());
        players[currentTurnIndex].hasActed = true;
        emit PlayerChecked(msg.sender);
        _advanceTurn();
    }

    /// @notice Call the current bet. Deducted from your stack.
    function call() external onlyPlayer isCurrentTurn inBettingPhase {
        uint256 toCall = currentBet - players[currentTurnIndex].betAmount;
        uint256 actualCall = min(toCall, players[currentTurnIndex].stack);

        players[currentTurnIndex].betAmount += actualCall;
        players[currentTurnIndex].stack -= actualCall;
        pot += actualCall;
        players[currentTurnIndex].hasActed = true;

        if (actualCall == players[currentTurnIndex].stack && actualCall < toCall) {
            players[currentTurnIndex].isAllIn = true;
            emit PlayerWentAllIn(msg.sender, actualCall);
        }

        emit PlayerCalled(msg.sender, actualCall);
        _advanceTurn();
    }

    /// @notice Raise by a given amount. Deducted from your stack.
    function raise(uint256 raiseAmount) external onlyPlayer isCurrentTurn inBettingPhase {
        require(raiseAmount > 0, NotEnoughForRaise());

        uint256 newBet = currentBet + raiseAmount;
        uint256 toPay = newBet - players[currentTurnIndex].betAmount;

        if (toPay > players[currentTurnIndex].stack) {
            toPay = players[currentTurnIndex].stack;
            newBet = players[currentTurnIndex].betAmount + toPay;
        }

        players[currentTurnIndex].betAmount = newBet;
        players[currentTurnIndex].stack -= toPay;
        currentBet = newBet;
        pot += toPay;

        if (players[currentTurnIndex].stack == 0) {
            players[currentTurnIndex].isAllIn = true;
            emit PlayerWentAllIn(msg.sender, toPay);
        }

        _resetActedFlagsExcept(currentTurnIndex);
        players[currentTurnIndex].hasActed = true;

        emit PlayerRaised(msg.sender, newBet);
        _advanceTurn();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GAME FLOW — dealer-controlled hand progression
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Start a new hand. Rotates dealer, removes busted players,
    ///         posts blinds, deals encrypted hole cards via BITE.
    function dealNewHand() public {
        require(phase == GamePhase.Waiting, "Game not waiting");
        require(players.length >= MIN_PLAYERS, NotEnoughPlayers());

        _removeBustedPlayers();
        require(players.length >= MIN_PLAYERS, NotEnoughPlayers());

        handNumber++;
        pot = 0;
        currentBet = 0;
        _clearCommunityCards();

        dealerIndex = handNumber % players.length;
        dealer = players[dealerIndex].addr;

        for (uint256 i = 0; i < players.length; i++) {
            players[i].isActive = true;
            players[i].hasActed = false;
            players[i].betAmount = 0;
            players[i].isAllIn = false;
            players[i].holeCards = [uint8(0), uint8(0)];
            players[i].cardsRevealed = false;
            players[i].teEncryptedHoleCards = bytes("");
            players[i].eciesEncryptedHoleCards = bytes("");
        }

        // Deal encrypted hole cards
        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp, block.prevrandao, handNumber, msg.sender
        )));
        for (uint256 i = 0; i < players.length; i++) {
            seed = _nextRand(seed);
            uint8 card1 = uint8((seed % 52) + 1);
            seed = _nextRand(seed);
            uint8 card2 = uint8((seed % 52) + 1);

            uint8 encodedCard1 = HandEvaluator.encodeCard((card1 % 13) + 2, card1 / 13);
            uint8 encodedCard2 = HandEvaluator.encodeCard((card2 % 13) + 2, card2 / 13);

            bytes memory teCards = BITE.encryptTE(
                BITE.ENCRYPT_TE_ADDRESS,
                abi.encode(encodedCard1, encodedCard2)
            );

            bytes memory eciesCards = BITE.encryptECIES(
                BITE.ENCRYPT_ECIES_ADDRESS,
                abi.encode(encodedCard1, encodedCard2),
                players[i].viewerKey
            );

            players[i].teEncryptedHoleCards = teCards;
            players[i].eciesEncryptedHoleCards = eciesCards;

            emit CardsDealt(players[i].addr);
            emit CardsEncrypted(players[i].addr, i);
        }

        // Post blinds from player stacks
        uint256 sbIdx = _nextActiveIndex(dealerIndex);
        uint256 bbIdx = _nextActiveIndex(sbIdx);
        _postBlind(sbIdx, SMALL_BLIND);
        _postBlind(bbIdx, BIG_BLIND);
        currentBet = BIG_BLIND;

        currentTurnIndex = _nextActiveIndex(bbIdx);
        _resetActedFlags();

        phase = GamePhase.Preflop;
        emit GameStarted(handNumber, dealer);
        emit PhaseChanged(GamePhase.Preflop);
    }

    /// @notice Deal the flop (3 community cards).
    function dealFlop() external onlyOwner {
        require(phase == GamePhase.Preflop, "Must be in preflop phase");
        _collectBets();

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, handNumber, "flop")));
        communityCards[0] = _randCard(seed); seed = _nextRand(seed);
        communityCards[1] = _randCard(seed); seed = _nextRand(seed);
        communityCards[2] = _randCard(seed);

        currentBet = 0;
        _resetActedFlags();
        currentTurnIndex = _nextActiveIndexFromDealer();

        phase = GamePhase.Flop;
        emit FlopDealt(communityCards[0], communityCards[1], communityCards[2]);
        emit PhaseChanged(GamePhase.Flop);
    }

    /// @notice Deal the turn (1 community card).
    function dealTurn() external onlyOwner {
        require(phase == GamePhase.Flop, "Must be in flop phase");
        _collectBets();

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, handNumber, "turn")));
        communityCards[3] = _randCard(seed);

        currentBet = 0;
        _resetActedFlags();
        currentTurnIndex = _nextActiveIndexFromDealer();

        phase = GamePhase.Turn;
        emit TurnDealt(communityCards[3]);
        emit PhaseChanged(GamePhase.Turn);
    }

    /// @notice Deal the river (1 community card).
    function dealRiver() external onlyOwner {
        require(phase == GamePhase.Turn, "Must be in turn phase");
        _collectBets();

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, handNumber, "river")));
        communityCards[4] = _randCard(seed);

        currentBet = 0;
        _resetActedFlags();
        currentTurnIndex = _nextActiveIndexFromDealer();

        phase = GamePhase.River;
        emit RiverDealt(communityCards[4]);
        emit PhaseChanged(GamePhase.River);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SHOWDOWN — the ONLY place msg.value is used (for CTX callback gas)
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Request encrypted card reveal via BITE CTX.
    ///         msg.value funds the CTX callback gas — forwarded to the CTX sender.
    ///         All game tokens stay as ERC-20; ETH here is ONLY for gas.
    function revealCards() external payable {
        require(phase == GamePhase.River, NotAtRiver());
        require(!_showdownPending, ShowdownInProgress());

        uint256 allowedGas = msg.value / tx.gasprice;
        require(allowedGas > minCallbackGas, InsufficientCallbackGas());

        uint256 activeCount = 0;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) activeCount++;
        }
        require(activeCount > 1, "Only one player left");

        bytes[] memory encryptedArgs = new bytes[](activeCount);
        bytes[] memory plaintextArgs = new bytes[](activeCount);
        uint256 j = 0;

        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) {
                require(players[i].teEncryptedHoleCards.length > 0, NoCardsDealt());
                encryptedArgs[j] = players[i].teEncryptedHoleCards;
                plaintextArgs[j] = abi.encode(i);
                j++;
            }
        }

        _showdownPending = true;
        phase = GamePhase.Showdown;

        address payable ctxSender = BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            allowedGas,
            encryptedArgs,
            plaintextArgs
        );

        _canCallOnDecrypt[ctxSender] = true;

        // Forward msg.value to CTX sender for callback gas
        ctxSender.transfer(msg.value);

        emit ShowdownInitiated(j);
    }

    /// @notice BITE callback — called after threshold decryption of showdown cards.
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        require(_canCallOnDecrypt[msg.sender], AccessDenied());
        _canCallOnDecrypt[msg.sender] = false;
        require(_showdownPending, "No pending showdown");

        _showdownPending = false;

        // Collect remaining bets into pot
        for (uint256 i = 0; i < players.length; i++) {
            pot += players[i].betAmount;
            players[i].betAmount = 0;
        }

        // Populate hole cards from decrypted data
        for (uint256 i = 0; i < decryptedArguments.length; i++) {
            uint256 playerIdx = abi.decode(plaintextArguments[i], (uint256));
            (uint8 card1, uint8 card2) = abi.decode(decryptedArguments[i], (uint8, uint8));

            players[playerIdx].holeCards = [card1, card2];
            players[playerIdx].cardsRevealed = true;

            emit CardsRevealed(players[playerIdx].addr, card1, card2);
        }

        address[] memory activePlayers = new address[](players.length);
        uint256 activeCount = 0;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) {
                activePlayers[activeCount++] = players[i].addr;
            }
        }

        if (activeCount == 1) {
            _awardPot(activePlayers[0], pot, "Last player standing");
        } else {
            _evaluateAndDistribute(activePlayers, activeCount);
        }

        phase = GamePhase.Waiting;
        emit HandComplete();
    }

    /// @notice Fallback showdown — owner can resolve if only one player remains.
    function resolveHand() external onlyOwner {
        require(phase == GamePhase.River, "Must be at river");

        phase = GamePhase.Showdown;

        for (uint256 i = 0; i < players.length; i++) {
            pot += players[i].betAmount;
            players[i].betAmount = 0;
        }

        address[] memory activePlayers = new address[](players.length);
        uint256 activeCount = 0;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) {
                activePlayers[activeCount++] = players[i].addr;
            }
        }

        if (activeCount == 1) {
            _awardPot(activePlayers[0], pot, "Last player standing");
        } else {
            for (uint256 i = 0; i < players.length; i++) {
                if (players[i].isActive && !players[i].cardsRevealed) {
                    revert CardsNotYetRevealed();
                }
            }
            _evaluateAndDistribute(activePlayers, activeCount);
        }

        phase = GamePhase.Waiting;
        emit HandComplete();
    }

    /// @notice Leave the table and withdraw your remaining stack as tokens.
    function leaveTable() external onlyPlayer {
        require(phase == GamePhase.Waiting, "Game in progress");
        uint256 idx = _playerIndex(msg.sender);

        uint256 stack = players[idx].stack;
        uint256 lastIdx = players.length - 1;
        if (idx != lastIdx) {
            players[idx] = players[lastIdx];
        }
        players.pop();

        bool ok = sklToken.transfer(msg.sender, stack);
        require(ok, TransferFailed());
        emit PlayerLeft(msg.sender, stack);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function getMyEncryptedCards() external view onlyPlayer returns (bytes memory) {
        return players[_playerIndex(msg.sender)].eciesEncryptedHoleCards;
    }

    function getMyHoleCards() external view onlyPlayer returns (uint8 card1, uint8 card2) {
        uint256 idx = _playerIndex(msg.sender);
        return (players[idx].holeCards[0], players[idx].holeCards[1]);
    }

    function areMyCardsRevealed() external view onlyPlayer returns (bool) {
        return players[_playerIndex(msg.sender)].cardsRevealed;
    }

    function getEncryptedCards(uint256 playerIndex) external view returns (bytes memory) {
        require(playerIndex < players.length, InvalidPlayerIndex());
        return players[playerIndex].eciesEncryptedHoleCards;
    }

    function getTEEcards(uint256 playerIndex) external view returns (bytes memory) {
        require(playerIndex < players.length, InvalidPlayerIndex());
        return players[playerIndex].teEncryptedHoleCards;
    }

    function getViewerKey(uint256 playerIndex) external view returns (PublicKey memory) {
        require(playerIndex < players.length, InvalidPlayerIndex());
        return players[playerIndex].viewerKey;
    }

    function isCardsRevealed(uint256 playerIndex) external view returns (bool) {
        require(playerIndex < players.length, InvalidPlayerIndex());
        return players[playerIndex].cardsRevealed;
    }

    function activePlayerCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) count++;
        }
        return count;
    }

    function getCommunityCards() external view returns (uint8[5] memory) {
        return communityCards;
    }

    function playerCount() external view returns (uint256) {
        return players.length;
    }

    function getPlayer(uint256 index) external view returns (address) {
        return players[index].addr;
    }

    function getPhaseName() external view returns (string memory) {
        if (phase == GamePhase.Waiting) return "Waiting";
        if (phase == GamePhase.Preflop) return "Preflop";
        if (phase == GamePhase.Flop) return "Flop";
        if (phase == GamePhase.Turn) return "Turn";
        if (phase == GamePhase.River) return "River";
        return "Showdown";
    }

    function evaluatePlayerHand(address player) external view returns (
        uint8 handRank, uint8 primary, uint8 secondary, uint8 tertiary, uint8 quaternary
    ) {
        uint256 idx = _playerIndex(player);
        require(idx != type(uint256).max, NotAPlayer());

        uint8[7] memory allCards;
        allCards[0] = players[idx].holeCards[0];
        allCards[1] = players[idx].holeCards[1];
        allCards[2] = communityCards[0];
        allCards[3] = communityCards[1];
        allCards[4] = communityCards[2];
        allCards[5] = communityCards[3];
        allCards[6] = communityCards[4];

        HandEvaluator.EvalResult memory result = allCards.evaluateHand();
        return (result.handRank, result.primary, result.secondary, result.tertiary, result.quaternary);
    }

    function getPlayerInfo(uint256 idx) external view returns (
        address addr, bool active, bool acted, uint256 bet, bool allIn, uint256 stackBal
    ) {
        Player storage p = players[idx];
        return (p.addr, p.isActive, p.hasActed, p.betAmount, p.isAllIn, p.stack);
    }

    function getPlayerCount() external view returns (uint256) {
        return players.length;
    }

    function getPlayerAddress(uint256 idx) external view returns (address) {
        return players[idx].addr;
    }

    function getPlayerStack(uint256 idx) external view returns (uint256) {
        return players[idx].stack;
    }

    function getCurrentTurnIndex() external view returns (uint256) {
        return currentTurnIndex;
    }

    // ─── Internal Helpers ────────────────────────────────────────────────

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _postBlind(uint256 playerIdx, uint256 amount) internal {
        uint256 actual = min(amount, players[playerIdx].stack);
        players[playerIdx].betAmount = actual;
        players[playerIdx].stack -= actual;
        pot += actual;
    }

    function _collectBets() internal {
        for (uint256 i = 0; i < players.length; i++) {
            pot += players[i].betAmount;
            players[i].betAmount = 0;
        }
    }

    function _clearCommunityCards() internal {
        for (uint256 i = 0; i < 5; i++) {
            communityCards[i] = 0;
        }
    }

    function _resetActedFlags() internal {
        for (uint256 i = 0; i < players.length; i++) {
            players[i].hasActed = false;
        }
    }

    function _resetActedFlagsExcept(uint256 exceptIdx) internal {
        for (uint256 i = 0; i < players.length; i++) {
            if (i != exceptIdx && players[i].isActive) {
                players[i].hasActed = false;
            }
        }
    }

    function _advanceTurn() internal {
        uint256 activeCount = 0;
        uint256 lastActive = 0;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) {
                activeCount++;
                lastActive = i;
            }
        }

        if (activeCount <= 1) {
            _collectBets();
            _awardPot(players[lastActive].addr, pot, "Last player standing");
            phase = GamePhase.Waiting;
            emit HandComplete();
            return;
        }

        if (_allActivePlayersActed()) {
            currentTurnIndex = type(uint256).max;
            return;
        }

        uint256 nextIdx = _nextActiveIndex(currentTurnIndex);
        uint256 guard = 0;
        while (players[nextIdx].hasActed && guard < players.length) {
            nextIdx = _nextActiveIndex(nextIdx);
            guard++;
        }

        if (guard >= players.length || _allActivePlayersActed()) {
            currentTurnIndex = type(uint256).max;
            return;
        }

        currentTurnIndex = nextIdx;
    }

    function _allActivePlayersActed() internal view returns (bool) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive && !players[i].hasActed) return false;
        }
        return true;
    }

    function _nextActiveIndex(uint256 fromIdx) internal view returns (uint256) {
        uint256 next = (fromIdx + 1) % players.length;
        uint256 guard = 0;
        while (!players[next].isActive && guard < players.length) {
            next = (next + 1) % players.length;
            guard++;
        }
        return next;
    }

    function _nextActiveIndexFromDealer() internal view returns (uint256) {
        return _nextActiveIndex(dealerIndex);
    }

    function _playerIndex(address addr) internal view returns (uint256) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].addr == addr) return i;
        }
        return type(uint256).max;
    }

    function _removeBustedPlayers() internal {
        for (uint256 i = players.length; i > 0; i--) {
            uint256 idx = i - 1;
            if (players[idx].stack == 0) {
                uint256 lastIdx = players.length - 1;
                if (idx != lastIdx) players[idx] = players[lastIdx];
                players.pop();
            }
        }
    }

    function _awardPot(address winner, uint256 amount, string memory handName) internal {
        pot = 0;
        emit Winner(winner, amount, handName);
        emit PotAwarded(winner, amount);
        bool ok = sklToken.transfer(winner, amount);
        require(ok, TransferFailed());
    }

    function _evaluateAndDistribute(address[] memory activePlayers, uint256 activeCount) internal {
        if (activeCount == 0) return;

        HandEvaluator.EvalResult memory best;
        address bestPlayer = activePlayers[0];

        for (uint256 i = 0; i < activeCount; i++) {
            uint256 pIdx = _playerIndex(activePlayers[i]);

            uint8[7] memory allCards;
            allCards[0] = players[pIdx].holeCards[0];
            allCards[1] = players[pIdx].holeCards[1];
            allCards[2] = communityCards[0];
            allCards[3] = communityCards[1];
            allCards[4] = communityCards[2];
            allCards[5] = communityCards[3];
            allCards[6] = communityCards[4];

            HandEvaluator.EvalResult memory result = allCards.evaluateHand();

            if (i == 0 || HandEvaluator.gte(result, best)) {
                if (i > 0 && HandEvaluator.gte(best, result) && bestPlayer != activePlayers[i]) {
                    continue;
                }
                best = result;
                bestPlayer = activePlayers[i];
            }
        }

        string memory handName = HandEvaluator.handRankName(best.handRank);
        _awardPot(bestPlayer, pot, handName);
    }

    function _nextRand(uint256 seed) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(seed)));
    }

    function _randCard(uint256 seed) internal pure returns (uint8) {
        uint256 card = seed % 52;
        return HandEvaluator.encodeCard(uint8((card % 13) + 2), uint8(card / 13));
    }

    receive() external payable {}
}
