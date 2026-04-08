// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "./HandEvaluator.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BITE, PublicKey} from "@skalenetwork/bite-solidity/BITE.sol";
import {IBiteSupplicant} from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import "@dirtroad/skale-rng/contracts/RNG.sol";

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
 *         ETH held by this contract is reserved for BITE CTX callback gas.
 *
 *         State machine: Waiting → Preflop → Flop → Turn → River → Showdown
 */
contract PokerGame is IBiteSupplicant, RNG {
    using HandEvaluator for uint8[7];

    // ─── Enums ───────────────────────────────────────────────────────────
    enum GamePhase {
        Waiting, // 0: waiting for players
        Preflop, // 1: preflop betting (cards dealt, blinds posted)
        Flop, // 2: flop betting
        Turn, // 3: turn betting
        River, // 4: river betting
        Showdown // 5: card reveal and pot distribution
    }

    enum PendingCallbackKind {
        None,
        CommunityDeal,
        Showdown
    }

    // ─── Structs ─────────────────────────────────────────────────────────
    struct Player {
        address addr;
        PublicKey viewerKey; // ECIES public key for encrypting their cards
        uint8[2] holeCards; // ONLY populated in onDecrypt at showdown; zero otherwise
        bool isActive; // hasn't folded this hand
        bool hasActed; // acted this betting round
        uint256 betAmount; // total bet in current betting round
        bool isAllIn;
        uint256 stack; // chip stack (ERC-20 balance in contract)
        bytes teEncryptedHoleCards; // TE-encrypted for showdown CTX decryption
        bytes eciesEncryptedHoleCards; // ECIES-encrypted to player's viewer key
        bool cardsRevealed; // true after showdown decryption
    }

    // ─── Constants ───────────────────────────────────────────────────────
    uint256 public constant SMALL_BLIND = 5 * 10 ** 17; // 0.5 SKL
    uint256 public constant BIG_BLIND = 1 * 10 ** 18; // 1 SKL
    uint256 public constant MIN_BET = 5 * 10 ** 17; // 0.5 SKL
    uint256 public constant MAX_BET = 500 * 10 ** 18; // 500 SKL
    uint256 public constant MIN_BUY_IN = 5 * 10 ** 18; // 5 SKL
    uint256 public constant MAX_BUY_IN = 50_000 * 10 ** 18; // 50,000 SKL
    uint256 public constant MAX_PLAYERS = 10;
    uint256 public constant MIN_PLAYERS = 2;
    uint256 public constant ACTIVE_PLAYERS_PER_HAND = 2;
    uint256 public constant BUY_IN = 1000 * 10 ** 18; // 1000 SKL (18 decimals)
    uint256 public constant CTX_GAS_BUFFER = 100_000;
    uint256 public constant MIN_CTX_RESERVE_CALLBACKS = 10;
    uint256 public constant SHOWDOWN_CALLBACK_GAS_LIMIT = 5_000_000;

    /// @notice Minimum gas baseline for CTX callbacks
    uint256 public minCallbackGas = 500_000;
    uint256 public immutable ctxCallbackValueWei;

    // ─── State ───────────────────────────────────────────────────────────
    GamePhase public phase;
    address public owner;
    uint256 public handNumber;
    uint256 public currentBet;
    uint256 public currentTurnIndex;
    address public dealer;
    uint256 public dealerIndex;
    uint256 public handSelectionCursor;
    uint256 internal rngCursor;
    bytes private teEncryptedDeck;
    uint8 private deckPosition;

    IERC20 public sklToken;
    Player[] public players;
    uint8[5] public communityCards;
    uint256 public pot;

    mapping(address => PendingCallbackKind) private _pendingCallbackKinds;
    bool private _showdownPending;
    bool private _communityDealPending;
    uint8 private _pendingCommunityCardCount;

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
    event PlayerForfeited(address indexed player, uint256 forfeited);

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
    error InsufficientCtxReserve();
    error InvalidCtxCallbackValue();
    error AccessDenied();
    error CallbackPending();

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
            phase == GamePhase.Preflop || phase == GamePhase.Flop || phase == GamePhase.Turn
                || phase == GamePhase.River,
            NotBettingPhase()
        );
        require(!_communityDealPending && !_showdownPending, CallbackPending());
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _sklToken, uint256 _ctxCallbackValueWei) payable {
        owner = msg.sender;
        sklToken = IERC20(_sklToken);
        phase = GamePhase.Waiting;
        require(BUY_IN >= MIN_BUY_IN && BUY_IN <= MAX_BUY_IN, "Buy-in out of range");
        require(_ctxCallbackValueWei > 0, InvalidCtxCallbackValue());
        ctxCallbackValueWei = _ctxCallbackValueWei;
        require(msg.value >= minimumCtxReserve(), InsufficientCtxReserve());
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC ACTIONS — all game actions are on-chain and visible to all
    // (just like sitting at a real poker table)
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Sit down at the table with your ECIES viewer key.
    ///         You must have approved this contract to transfer BUY_IN tokens.
    function sitDown(PublicKey calldata viewerKey) external {
        require(players.length < MAX_PLAYERS, GameIsFull());
        require(_playerIndex(msg.sender) == type(uint256).max, AlreadyJoined());

        // Transfer BUY_IN from player
        bool ok = sklToken.transferFrom(msg.sender, address(this), BUY_IN);
        require(ok, TransferFailed());

        players.push(
            Player({
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
            })
        );

        emit PlayerJoined(msg.sender, players.length - 1);

        if (phase == GamePhase.Waiting && _countPlayersWithStack() >= MIN_PLAYERS) {
            dealNewHand();
        }
    }

    receive() external payable {}

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
        require(raiseAmount >= MIN_BET, NotEnoughForRaise());

        uint256 newBet = currentBet + raiseAmount;
        require(newBet <= MAX_BET, NotEnoughForRaise());
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
        require(_countPlayersWithStack() >= MIN_PLAYERS, NotEnoughPlayers());
        require(address(this).balance >= minimumCtxReserve(), InsufficientCtxReserve());

        _removeBustedPlayers();
        require(_countPlayersWithStack() >= MIN_PLAYERS, NotEnoughPlayers());

        handNumber++;
        pot = 0;
        currentBet = 0;
        rngCursor = 1;
        uint8[52] memory liveDeck = _buildShuffledDeck();
        teEncryptedDeck = BITE.encryptTE(BITE.ENCRYPT_TE_ADDRESS, abi.encode(liveDeck));
        deckPosition = 0;
        _clearCommunityCards();

        for (uint256 i = 0; i < players.length; i++) {
            players[i].isActive = false;
            players[i].hasActed = true;
            players[i].betAmount = 0;
            players[i].isAllIn = false;
            players[i].holeCards = [uint8(0), uint8(0)];
            players[i].cardsRevealed = false;
            players[i].teEncryptedHoleCards = bytes("");
            players[i].eciesEncryptedHoleCards = bytes("");
        }

        uint256[2] memory handPlayers;
        uint256 picked = 0;
        uint256 scanned = 0;
        while (scanned < players.length && picked < ACTIVE_PLAYERS_PER_HAND) {
            uint256 idx = (handSelectionCursor + scanned) % players.length;
            if (players[idx].stack > 0) {
                handPlayers[picked] = idx;
                players[idx].isActive = true;
                players[idx].hasActed = false;
                picked++;
            }
            scanned++;
        }
        require(picked == ACTIVE_PLAYERS_PER_HAND, NotEnoughPlayers());
        handSelectionCursor = (handPlayers[1] + 1) % players.length;

        if (handNumber == 1) {
            dealerIndex = handPlayers[0];
        } else if (dealerIndex == handPlayers[0]) {
            dealerIndex = handPlayers[1];
        } else {
            dealerIndex = handPlayers[0];
        }
        dealer = players[dealerIndex].addr;

        // Deal encrypted hole cards
        for (uint256 i = 0; i < players.length; i++) {
            if (!players[i].isActive) continue;
            uint8 encodedCard1 = liveDeck[deckPosition];
            uint8 encodedCard2 = liveDeck[deckPosition + 1];
            deckPosition += 2;

            bytes memory teCards = BITE.encryptTE(BITE.ENCRYPT_TE_ADDRESS, abi.encode(encodedCard1, encodedCard2));

            bytes memory eciesCards = BITE.encryptECIES(
                BITE.ENCRYPT_ECIES_ADDRESS, abi.encode(encodedCard1, encodedCard2), players[i].viewerKey
            );

            players[i].teEncryptedHoleCards = teCards;
            players[i].eciesEncryptedHoleCards = eciesCards;

            emit CardsDealt(players[i].addr);
            emit CardsEncrypted(players[i].addr, i);
        }

        // Post blinds from player stacks
        uint256 sbIdx = dealerIndex;
        uint256 bbIdx = _nextActiveIndex(sbIdx);
        _postBlind(sbIdx, SMALL_BLIND);
        _postBlind(bbIdx, BIG_BLIND);
        currentBet = BIG_BLIND;

        // Heads-up preflop action starts with the small blind (dealer).
        currentTurnIndex = sbIdx;
        _resetActedFlags();

        phase = GamePhase.Preflop;
        emit GameStarted(handNumber, dealer);
        emit PhaseChanged(GamePhase.Preflop);
    }

    /// @notice Deal the flop (3 community cards).
    function dealFlop() external onlyOwner {
        require(phase == GamePhase.Preflop, "Must be in preflop phase");
        _collectBets();
        _submitCommunityDeal(3);
    }

    /// @notice Deal the turn (1 community card).
    function dealTurn() external onlyOwner {
        require(phase == GamePhase.Flop, "Must be in flop phase");
        _collectBets();
        _submitCommunityDeal(1);
    }

    /// @notice Deal the river (1 community card).
    function dealRiver() external onlyOwner {
        require(phase == GamePhase.Turn, "Must be in turn phase");
        _collectBets();
        _submitCommunityDeal(1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SHOWDOWN
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice BITE callback — called after threshold decryption of showdown cards.
    function onDecrypt(bytes[] calldata decryptedArguments, bytes[] calldata plaintextArguments) external override {
        PendingCallbackKind kind = _pendingCallbackKinds[msg.sender];
        require(kind != PendingCallbackKind.None, AccessDenied());
        delete _pendingCallbackKinds[msg.sender];

        if (kind == PendingCallbackKind.CommunityDeal) {
            _completeCommunityDeal(decryptedArguments);
            return;
        }

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

        _resetWaitingState();
        emit HandComplete();
    }

    /// @notice Owner-triggered showdown entrypoint. Winner settlement happens in onDecrypt.
    function resolveHand() external onlyOwner {
        _initiateShowdown();
    }

    /// @notice Leave the table and withdraw your remaining stack as tokens.
    function leaveTable() external onlyPlayer {
        require(phase == GamePhase.Waiting, "Game in progress");
        uint256 idx = _playerIndex(msg.sender);

        uint256 stack = players[idx].stack;
        _removePlayerAt(idx);

        bool ok = sklToken.transfer(msg.sender, stack);
        require(ok, TransferFailed());
        emit PlayerLeft(msg.sender, stack);
    }

    /// @notice Emergency dev exit: leave immediately and forfeit any remaining stack.
    function forfeitAndLeave() external onlyPlayer {
        require(!_showdownPending, ShowdownInProgress());

        uint256 idx = _playerIndex(msg.sender);
        uint256 forfeited = players[idx].stack;
        bool wasBettingPhase = phase == GamePhase.Preflop || phase == GamePhase.Flop || phase == GamePhase.Turn
            || phase == GamePhase.River;
        bool wasCurrentTurn = players.length > 0 && currentTurnIndex == idx;

        players[idx].stack = 0;
        players[idx].isActive = false;
        players[idx].hasActed = true;

        _removePlayerAt(idx);
        emit PlayerForfeited(msg.sender, forfeited);

        if (players.length == 0) {
            _resetWaitingState();
            pot = 0;
            dealer = address(0);
            _clearCommunityCards();
            return;
        }

        if (wasBettingPhase) {
            uint256 activeCount = _activePlayerCountInternal();
            if (activeCount <= 1) {
                if (activeCount == 1) {
                    _initiateShowdown();
                } else {
                    _resetWaitingState();
                    emit HandComplete();
                }
                return;
            }

            if (wasCurrentTurn) {
                currentTurnIndex = idx == 0 ? players.length - 1 : idx - 1;
                _advanceTurn();
            }
        }
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

    function evaluatePlayerHand(address player)
        external
        view
        returns (uint8 handRank, uint8 primary, uint8 secondary, uint8 tertiary, uint8 quaternary)
    {
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

    function getPlayerInfo(uint256 idx)
        external
        view
        returns (address addr, bool active, bool acted, uint256 bet, bool allIn, uint256 stackBal)
    {
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

    function minimumCtxReserve() public view returns (uint256) {
        return ctxCallbackValueWei * MIN_CTX_RESERVE_CALLBACKS;
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

    function _countPlayersWithStack() internal view returns (uint256 count) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].stack > 0) count++;
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
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) {
                activeCount++;
            }
        }

        if (activeCount <= 1) {
            _initiateShowdown();
            return;
        }

        if (_allActivePlayersActed()) {
            _advancePhaseFromTurn();
            return;
        }

        uint256 nextIdx = _nextActiveIndex(currentTurnIndex);
        uint256 guard = 0;
        while (players[nextIdx].hasActed && guard < players.length) {
            nextIdx = _nextActiveIndex(nextIdx);
            guard++;
        }

        if (guard >= players.length || _allActivePlayersActed()) {
            _advancePhaseFromTurn();
            return;
        }

        currentTurnIndex = nextIdx;
    }

    function _advancePhaseFromTurn() internal {
        if (phase == GamePhase.Preflop) {
            _collectBets();
            _submitCommunityDeal(3);
            return;
        }

        if (phase == GamePhase.Flop) {
            _collectBets();
            _submitCommunityDeal(1);
            return;
        }

        if (phase == GamePhase.Turn) {
            _collectBets();
            _submitCommunityDeal(1);
            return;
        }

        if (phase == GamePhase.River) {
            _initiateShowdown();
        }
    }

    function _initiateShowdown() internal {
        require(
            phase == GamePhase.Preflop || phase == GamePhase.Flop || phase == GamePhase.Turn
                || phase == GamePhase.River,
            NotBettingPhase()
        );
        require(!_communityDealPending, CallbackPending());
        require(!_showdownPending, ShowdownInProgress());
        require(address(this).balance >= minimumCtxReserve() + ctxCallbackValueWei, InsufficientCtxReserve());

        uint256 activeCount = 0;
        uint256 revealCount = 0;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) activeCount++;
            if (players[i].teEncryptedHoleCards.length > 0) revealCount++;
        }
        require(activeCount > 0, NotEnoughPlayers());
        require(revealCount > 0, NoCardsDealt());
        uint256 allowedGas = _showdownCallbackGasLimit(revealCount);

        bytes[] memory encryptedArgs = new bytes[](revealCount);
        bytes[] memory plaintextArgs = new bytes[](revealCount);
        uint256 j = 0;

        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].teEncryptedHoleCards.length > 0) {
                encryptedArgs[j] = players[i].teEncryptedHoleCards;
                plaintextArgs[j] = abi.encode(i);
                j++;
            }
        }

        _showdownPending = true;
        phase = GamePhase.Showdown;
        currentTurnIndex = type(uint256).max;

        address payable ctxSender = BITE.submitCTX(BITE.SUBMIT_CTX_ADDRESS, allowedGas, encryptedArgs, plaintextArgs);

        _pendingCallbackKinds[ctxSender] = PendingCallbackKind.Showdown;
        ctxSender.transfer(ctxCallbackValueWei);

        emit ShowdownInitiated(j);
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
                _removePlayerAt(idx);
            }
        }
    }

    function _removePlayerAt(uint256 idx) internal {
        uint256 lastIdx = players.length - 1;

        if (idx != lastIdx) {
            players[idx] = players[lastIdx];
        }
        players.pop();

        if (players.length == 0) {
            dealerIndex = 0;
            handSelectionCursor = 0;
            currentTurnIndex = type(uint256).max;
            dealer = address(0);
            return;
        }

        if (dealerIndex == lastIdx && idx != lastIdx) {
            dealerIndex = idx;
        } else if (dealerIndex > idx) {
            dealerIndex--;
        } else if (dealerIndex >= players.length) {
            dealerIndex = 0;
        }

        if (handSelectionCursor == lastIdx && idx != lastIdx) {
            handSelectionCursor = idx;
        } else if (handSelectionCursor > idx) {
            handSelectionCursor--;
        }
        if (handSelectionCursor >= players.length) {
            handSelectionCursor = 0;
        }

        if (currentTurnIndex == lastIdx && idx != lastIdx) {
            currentTurnIndex = idx;
        } else if (currentTurnIndex > idx && currentTurnIndex != type(uint256).max) {
            currentTurnIndex--;
        }
        if (currentTurnIndex >= players.length) {
            currentTurnIndex = type(uint256).max;
        }

        dealer = players[dealerIndex].addr;
    }

    function _activePlayerCountInternal() internal view returns (uint256 count) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) count++;
        }
    }

    function _resetWaitingState() internal {
        phase = GamePhase.Waiting;
        currentBet = 0;
        currentTurnIndex = type(uint256).max;
        _communityDealPending = false;
        _showdownPending = false;
        _pendingCommunityCardCount = 0;
        teEncryptedDeck = bytes("");
        deckPosition = 0;

        for (uint256 i = 0; i < players.length; i++) {
            players[i].betAmount = 0;
            players[i].isActive = false;
            players[i].hasActed = true;
            players[i].isAllIn = false;
        }
    }

    function _firstActivePlayerIndex() internal view returns (uint256) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) return i;
        }
        return type(uint256).max;
    }

    function _awardPot(address winner, uint256 amount, string memory handName) internal {
        pot = 0;
        emit Winner(winner, amount, handName);
        emit PotAwarded(winner, amount);
        uint256 winnerIdx = _playerIndex(winner);
        require(winnerIdx != type(uint256).max, NotAPlayer());
        players[winnerIdx].stack += amount;
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

    function _randCard(uint256 card) internal pure returns (uint8) {
        return HandEvaluator.encodeCard(uint8((card % 13) + 2), uint8(card / 13));
    }

    function _buildShuffledDeck() internal returns (uint8[52] memory liveDeck) {
        for (uint256 i = 0; i < 52; i++) {
            liveDeck[i] = _randCard(i);
        }

        for (uint256 i = 51; i > 0; i--) {
            uint256 swapIndex = getNextRandomRange(rngCursor, i + 1);
            rngCursor++;

            uint8 card = liveDeck[i];
            liveDeck[i] = liveDeck[swapIndex];
            liveDeck[swapIndex] = card;
        }
    }

    function _communityCallbackGasLimit(uint8 cardCount) internal view returns (uint256) {
        uint256 estimatedGas = minCallbackGas + (uint256(cardCount) * 25_000) + 75_000;
        require(estimatedGas > minCallbackGas, InsufficientCallbackGas());
        return estimatedGas + CTX_GAS_BUFFER;
    }

    function _showdownCallbackGasLimit(uint256 activeCount) internal pure returns (uint256) {
        activeCount;
        return SHOWDOWN_CALLBACK_GAS_LIMIT;
    }

    function _submitCommunityDeal(uint8 cardCount) internal {
        require(!_communityDealPending && !_showdownPending, CallbackPending());
        require(address(this).balance >= minimumCtxReserve() + ctxCallbackValueWei, InsufficientCtxReserve());

        uint256 allowedGas = _communityCallbackGasLimit(cardCount);

        bytes[] memory encryptedArgs = new bytes[](1);
        encryptedArgs[0] = teEncryptedDeck;

        bytes[] memory plaintextArgs = new bytes[](1);
        plaintextArgs[0] = bytes("");

        _communityDealPending = true;
        _pendingCommunityCardCount = cardCount;
        currentTurnIndex = type(uint256).max;

        address payable ctxSender = BITE.submitCTX(BITE.SUBMIT_CTX_ADDRESS, allowedGas, encryptedArgs, plaintextArgs);

        _pendingCallbackKinds[ctxSender] = PendingCallbackKind.CommunityDeal;
        ctxSender.transfer(ctxCallbackValueWei);
    }

    function _completeCommunityDeal(bytes[] calldata decryptedArguments) internal {
        require(_communityDealPending, CallbackPending());
        _communityDealPending = false;

        uint8 cardCount = _pendingCommunityCardCount;
        _pendingCommunityCardCount = 0;
        uint8[52] memory liveDeck = abi.decode(decryptedArguments[0], (uint8[52]));

        uint256 communityIndex = deckPosition - (ACTIVE_PLAYERS_PER_HAND * 2);
        for (uint256 i = 0; i < cardCount; i++) {
            communityCards[communityIndex + i] = liveDeck[deckPosition + i];
        }
        deckPosition += cardCount;

        currentBet = 0;
        _resetActedFlags();
        currentTurnIndex = _nextActiveIndexFromDealer();

        if (cardCount == 3) {
            phase = GamePhase.Flop;
            emit FlopDealt(communityCards[0], communityCards[1], communityCards[2]);
            emit PhaseChanged(GamePhase.Flop);
            return;
        }

        if (phase == GamePhase.Flop) {
            phase = GamePhase.Turn;
            emit TurnDealt(communityCards[3]);
            emit PhaseChanged(GamePhase.Turn);
            return;
        }

        phase = GamePhase.River;
        emit RiverDealt(communityCards[4]);
        emit PhaseChanged(GamePhase.River);
    }
}
