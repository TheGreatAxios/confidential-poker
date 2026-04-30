// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import {HandEvaluator} from "./HandEvaluator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BITE, PublicKey} from "@skalenetwork/bite-solidity/BITE.sol";
import {IBiteSupplicant} from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import {RNG} from "@dirtroad/skale-rng/contracts/RNG.sol";

contract PokerGame is IBiteSupplicant, RNG {
    using HandEvaluator for uint8[7];
    using SafeERC20 for IERC20;

    enum GamePhase {
        Waiting,
        Preflop,
        Flop,
        Turn,
        River,
        Showdown
    }

    enum PendingCallbackKind {
        None,
        CommunityDeal,
        Showdown
    }

    struct Player {
        address addr;
        PublicKey viewerKey;
        uint8[2] holeCards;
        bool isActive;
        bool hasActed;
        uint256 betAmount;
        bool isAllIn;
        uint256 stack;
        bytes teEncryptedHoleCards;
        bytes eciesEncryptedHoleCards;
        bool cardsRevealed;
    }

    uint256 public constant MIN_PLAYERS = 2;
    uint256 public constant MIN_BET = 5 * 10 ** 17;
    uint256 public constant CTX_GAS_BUFFER = 100_000;
    uint256 public constant MIN_CTX_RESERVE_CALLBACKS = 10;
    uint256 public constant SHOWDOWN_CALLBACK_GAS_LIMIT = 5_000_000;
    uint256 public constant DEFAULT_MIN_BUY_IN = 5 * 10 ** 18;
    uint256 public constant DEFAULT_MAX_BUY_IN = 50_000 * 10 ** 18;

    uint256 public immutable BUY_IN;
    uint256 public immutable SMALL_BLIND;
    uint256 public immutable BIG_BLIND;
    uint256 public immutable MAX_PLAYERS;
    uint256 public immutable CTX_CALLBACK_VALUE_WEI;
    string public tableName;

    uint256 public minCallbackGas = 500_000;

    GamePhase public phase;
    address public owner;
    uint256 public handNumber;
    uint256 public currentBet;
    uint256 public currentTurnIndex;
    address public dealer;
    uint256 public dealerIndex;
    uint256 internal rngCursor;
    bytes private teEncryptedDeck;
    uint8 private deckPosition;
    uint256 private _communityCardsDealt;

    IERC20 public gameToken;
    Player[] public players;
    uint8[5] public communityCards;
    uint256 public pot;

    mapping(address => PendingCallbackKind) private _pendingCallbackKinds;
    bool private _showdownPending;
    bool private _communityDealPending;
    uint8 private _pendingCommunityCardCount;

    mapping(address => bool) public leaveRequested;
    mapping(address => uint256) private _handContribution;
    address[] private _contributingPlayers;

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
    event LeaveRequested(address indexed player);

    error NotOwner();
    error NotAPlayer();
    error NotYourTurn();
    error NotBettingPhase();
    error GameIsFull();
    error AlreadyJoined();
    error NotEnoughPlayers();
    error MustCallOrRaise();
    error NotEnoughForRaise();
    error TransferFailed();
    error InvalidPlayerIndex();
    error NoCardsDealt();
    error ShowdownInProgress();
    error AccessDenied();
    error CallbackPending();
    error InsufficientCtxReserve();
    error InvalidCtxCallbackValue();
    error GameInProgress();
    error BuyInOutOfRange();

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier onlyPlayer() {
        _onlyPlayer();
        _;
    }

    modifier isCurrentTurn() {
        _isCurrentTurn();
        _;
    }

    modifier inBettingPhase() {
        _inBettingPhase();
        _;
    }

    constructor(
        address _gameToken,
        address _owner,
        uint256 _buyIn,
        uint256 _smallBlind,
        uint256 _bigBlind,
        uint256 _maxPlayers,
        uint256 _ctxCallbackValueWei,
        string memory _tableName
    ) payable {
        require(_gameToken != address(0), "Zero token address");
        require(_owner != address(0), "Zero owner address");
        require(_buyIn >= DEFAULT_MIN_BUY_IN && _buyIn <= DEFAULT_MAX_BUY_IN, BuyInOutOfRange());
        require(_smallBlind > 0 && _bigBlind > 0, "Zero blind");
        require(_bigBlind > _smallBlind, "BB must exceed SB");
        require(_maxPlayers >= MIN_PLAYERS && _maxPlayers <= 10, "Invalid max players");
        require(_ctxCallbackValueWei > 0, InvalidCtxCallbackValue());

        owner = _owner;
        gameToken = IERC20(_gameToken);
        BUY_IN = _buyIn;
        SMALL_BLIND = _smallBlind;
        BIG_BLIND = _bigBlind;
        MAX_PLAYERS = _maxPlayers;
        CTX_CALLBACK_VALUE_WEI = _ctxCallbackValueWei;
        tableName = _tableName;
        phase = GamePhase.Waiting;

        require(msg.value >= minimumCtxReserve(), InsufficientCtxReserve());
    }

    receive() external payable {}

    function _onlyOwner() internal view {
        require(msg.sender == owner, NotOwner());
    }

    function _onlyPlayer() internal view {
        require(_playerIndex(msg.sender) != type(uint256).max, NotAPlayer());
    }

    function _isCurrentTurn() internal view {
        require(players[currentTurnIndex].addr == msg.sender, NotYourTurn());
    }

    function _inBettingPhase() internal view {
        require(
            phase == GamePhase.Preflop || phase == GamePhase.Flop || phase == GamePhase.Turn
                || phase == GamePhase.River,
            NotBettingPhase()
        );
        require(!_communityDealPending && !_showdownPending, CallbackPending());
    }

    function sitDown(PublicKey calldata viewerKey) external {
        require(phase == GamePhase.Waiting, GameInProgress());
        require(players.length < MAX_PLAYERS, GameIsFull());
        require(_playerIndex(msg.sender) == type(uint256).max, AlreadyJoined());

        gameToken.safeTransferFrom(msg.sender, address(this), BUY_IN);

        players.push(
            Player({
                addr: msg.sender,
                viewerKey: viewerKey,
                holeCards: [uint8(0), uint8(0)],
                isActive: false,
                hasActed: true,
                betAmount: 0,
                isAllIn: false,
                stack: BUY_IN,
                teEncryptedHoleCards: bytes(""),
                eciesEncryptedHoleCards: bytes(""),
                cardsRevealed: false
            })
        );

        emit PlayerJoined(msg.sender, players.length - 1);
    }

    function requestLeave() external onlyPlayer {
        leaveRequested[msg.sender] = true;
        emit LeaveRequested(msg.sender);
    }

    function cancelLeave() external onlyPlayer {
        delete leaveRequested[msg.sender];
    }

    function fold() external onlyPlayer isCurrentTurn inBettingPhase {
        players[currentTurnIndex].isActive = false;
        players[currentTurnIndex].hasActed = true;
        emit PlayerFolded(msg.sender);
        _advanceTurn();
    }

    function check() external onlyPlayer isCurrentTurn inBettingPhase {
        require(players[currentTurnIndex].betAmount >= currentBet, MustCallOrRaise());
        players[currentTurnIndex].hasActed = true;
        emit PlayerChecked(msg.sender);
        _advanceTurn();
    }

    function call() external onlyPlayer isCurrentTurn inBettingPhase {
        uint256 toCall = currentBet - players[currentTurnIndex].betAmount;
        uint256 actualCall = _min(toCall, players[currentTurnIndex].stack);

        players[currentTurnIndex].betAmount += actualCall;
        players[currentTurnIndex].stack -= actualCall;
        _trackContribution(msg.sender, actualCall);
        players[currentTurnIndex].hasActed = true;

        if (players[currentTurnIndex].stack == 0 && actualCall < toCall) {
            players[currentTurnIndex].isAllIn = true;
            emit PlayerWentAllIn(msg.sender, actualCall);
        }

        emit PlayerCalled(msg.sender, actualCall);
        _advanceTurn();
    }

    function raise(uint256 raiseAmount) external onlyPlayer isCurrentTurn inBettingPhase {
        require(raiseAmount >= MIN_BET, NotEnoughForRaise());

        uint256 newBet = currentBet + raiseAmount;
        uint256 toPay = newBet - players[currentTurnIndex].betAmount;

        if (toPay > players[currentTurnIndex].stack) {
            toPay = players[currentTurnIndex].stack;
            newBet = players[currentTurnIndex].betAmount + toPay;
        }

        players[currentTurnIndex].betAmount = newBet;
        players[currentTurnIndex].stack -= toPay;
        currentBet = newBet;
        _trackContribution(msg.sender, toPay);

        if (players[currentTurnIndex].stack == 0) {
            players[currentTurnIndex].isAllIn = true;
            emit PlayerWentAllIn(msg.sender, toPay);
        }

        _resetActedFlagsExcept(currentTurnIndex);
        players[currentTurnIndex].hasActed = true;

        emit PlayerRaised(msg.sender, newBet);
        _advanceTurn();
    }

    function dealNewHand() public {
        require(phase == GamePhase.Waiting, "Game not waiting");
        require(!_communityDealPending && !_showdownPending, CallbackPending());
        require(_countPlayersWithStack() >= MIN_PLAYERS, NotEnoughPlayers());
        require(address(this).balance >= minimumCtxReserve(), InsufficientCtxReserve());

        _processLeaveRequests();
        _removeBustedPlayers();
        require(_countPlayersWithStack() >= MIN_PLAYERS, NotEnoughPlayers());

        handNumber++;
        pot = 0;
        currentBet = 0;
        rngCursor = 1;
        _communityCardsDealt = 0;
        _clearCommunityCards();
        _clearContributions();

        uint8[52] memory liveDeck = _buildShuffledDeck();
        teEncryptedDeck = BITE.encryptTE(BITE.ENCRYPT_TE_ADDRESS, abi.encode(liveDeck));
        deckPosition = 0;

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

        uint256 activeCount;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].stack > 0) {
                players[i].isActive = true;
                players[i].hasActed = false;
                activeCount++;
            }
        }
        require(activeCount >= MIN_PLAYERS, NotEnoughPlayers());

        dealerIndex = _rotateDealer();
        dealer = players[dealerIndex].addr;

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

        uint256 sbIdx;
        uint256 bbIdx;

        if (activeCount == 2) {
            sbIdx = dealerIndex;
            bbIdx = _nextActiveIndex(dealerIndex);
        } else {
            sbIdx = _nextActiveIndex(dealerIndex);
            bbIdx = _nextActiveIndex(sbIdx);
        }

        _postBlind(sbIdx, SMALL_BLIND);
        _postBlind(bbIdx, BIG_BLIND);
        currentBet = BIG_BLIND;

        if (activeCount == 2) {
            currentTurnIndex = sbIdx;
        } else {
            currentTurnIndex = _nextActiveIndex(bbIdx);
        }

        phase = GamePhase.Preflop;
        emit GameStarted(handNumber, dealer);
        emit PhaseChanged(GamePhase.Preflop);
    }

    function dealNext() external {
        bool allIn = _allActiveAllIn();
        require(allIn || msg.sender == owner, "Not authorized or not all-in");

        if (phase == GamePhase.Preflop) {
            _collectBets();
            _submitCommunityDeal(3);
        } else if (phase == GamePhase.Flop) {
            _collectBets();
            _submitCommunityDeal(1);
        } else if (phase == GamePhase.Turn) {
            _collectBets();
            _submitCommunityDeal(1);
        } else if (phase == GamePhase.River) {
            _initiateShowdown();
        } else {
            revert NotBettingPhase();
        }
    }

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

        for (uint256 i = 0; i < players.length; i++) {
            pot += players[i].betAmount;
            players[i].betAmount = 0;
        }

        for (uint256 i = 0; i < decryptedArguments.length; i++) {
            uint256 playerIdx = abi.decode(plaintextArguments[i], (uint256));
            (uint8 card1, uint8 card2) = abi.decode(decryptedArguments[i], (uint8, uint8));
            players[playerIdx].holeCards = [card1, card2];
            players[playerIdx].cardsRevealed = true;
            emit CardsRevealed(players[playerIdx].addr, card1, card2);
        }

        uint256 activeCount;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) activeCount++;
        }

        if (activeCount <= 1) {
            for (uint256 i = 0; i < players.length; i++) {
                if (players[i].isActive) {
                    players[i].stack += pot;
                    emit Winner(players[i].addr, pot, "Last player standing");
                    emit PotAwarded(players[i].addr, pot);
                    break;
                }
            }
            pot = 0;
        } else {
            _distributePots();
        }

        _resetWaitingState();
        emit HandComplete();
    }

    function resolveHand() external onlyOwner {
        _initiateShowdown();
    }

    function leaveTable() external onlyPlayer {
        require(phase == GamePhase.Waiting, GameInProgress());
        require(!_showdownPending, ShowdownInProgress());

        uint256 idx = _playerIndex(msg.sender);
        uint256 stack = players[idx].stack;

        delete leaveRequested[msg.sender];
        _removePlayerAt(idx);

        gameToken.safeTransfer(msg.sender, stack);
        emit PlayerLeft(msg.sender, stack);
    }

    function forfeitAndLeave() external onlyPlayer {
        require(!_showdownPending, ShowdownInProgress());

        uint256 idx = _playerIndex(msg.sender);

        _trackContribution(msg.sender, players[idx].betAmount);
        players[idx].betAmount = 0;

        uint256 forfeited = players[idx].stack;
        players[idx].stack = 0;
        players[idx].isActive = false;
        players[idx].hasActed = true;

        delete leaveRequested[msg.sender];
        _removePlayerAt(idx);
        emit PlayerForfeited(msg.sender, forfeited);

        if (players.length == 0) {
            _resetWaitingState();
            pot = 0;
            dealer = address(0);
            _clearCommunityCards();
            return;
        }

        bool wasBettingPhase = phase == GamePhase.Preflop || phase == GamePhase.Flop || phase == GamePhase.Turn
            || phase == GamePhase.River;

        if (wasBettingPhase) {
            uint256 activeCnt = _activePlayerCountInternal();
            if (activeCnt <= 1) {
                if (activeCnt == 1) {
                    _initiateShowdown();
                } else {
                    _resetWaitingState();
                    emit HandComplete();
                }
                return;
            }

            if (wasBettingPhase && currentTurnIndex == idx) {
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

    function getTeCards(uint256 playerIndex) external view returns (bytes memory) {
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
        uint256 count;
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

    function getPlayerStack(uint256 idx) external view returns (uint256) {
        return players[idx].stack;
    }

    function getCurrentTurnIndex() external view returns (uint256) {
        return currentTurnIndex;
    }

    function minimumCtxReserve() public view returns (uint256) {
        return CTX_CALLBACK_VALUE_WEI * MIN_CTX_RESERVE_CALLBACKS;
    }

    function getHandContribution(address player) external view returns (uint256) {
        return _handContribution[player];
    }

    function isLeaveRequested(address player) external view returns (bool) {
        return leaveRequested[player];
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL — GAME FLOW
    // ═══════════════════════════════════════════════════════════════════════

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _postBlind(uint256 playerIdx, uint256 amount) internal {
        uint256 actual = _min(amount, players[playerIdx].stack);
        players[playerIdx].betAmount = actual;
        players[playerIdx].stack -= actual;
        _trackContribution(players[playerIdx].addr, actual);
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

    function _countActivePlayers() internal view returns (uint256 count) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) count++;
        }
    }

    function _resetActedFlags() internal {
        for (uint256 i = 0; i < players.length; i++) {
            players[i].hasActed = false;
        }
    }

    function _resetActedFlagsExcept(uint256 exceptIdx) internal {
        for (uint256 i = 0; i < players.length; i++) {
            if (i != exceptIdx && players[i].isActive && !players[i].isAllIn) {
                players[i].hasActed = false;
            }
        }
    }

    function _advanceTurn() internal {
        uint256 activeCount = _countActivePlayers();

        if (activeCount <= 1) {
            _initiateShowdown();
            return;
        }

        if (_allNonAllInActed()) {
            _advancePhaseFromTurn();
            return;
        }

        uint256 nextIdx = _nextActiveIndex(currentTurnIndex);
        uint256 guard;
        while (players[nextIdx].hasActed && guard < players.length) {
            nextIdx = _nextActiveIndex(nextIdx);
            guard++;
        }

        if (guard >= players.length || _allNonAllInActed()) {
            _advancePhaseFromTurn();
            return;
        }

        currentTurnIndex = nextIdx;
    }

    function _allNonAllInActed() internal view returns (bool) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive && !players[i].isAllIn && !players[i].hasActed) {
                return false;
            }
        }
        return true;
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
        require(
            address(this).balance >= minimumCtxReserve() + CTX_CALLBACK_VALUE_WEI, InsufficientCtxReserve()
        );

        uint256 activeCount;
        uint256 revealCount;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) activeCount++;
            if (players[i].teEncryptedHoleCards.length > 0) revealCount++;
        }
        require(activeCount > 0, NotEnoughPlayers());
        require(revealCount > 0, NoCardsDealt());

        _collectBets();

        uint256 allowedGas = SHOWDOWN_CALLBACK_GAS_LIMIT;

        bytes[] memory encryptedArgs = new bytes[](revealCount);
        bytes[] memory plaintextArgs = new bytes[](revealCount);
        uint256 j;
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

        address payable ctxSender =
            BITE.submitCTX(BITE.SUBMIT_CTX_ADDRESS, allowedGas, encryptedArgs, plaintextArgs);

        _pendingCallbackKinds[ctxSender] = PendingCallbackKind.Showdown;
        ctxSender.transfer(CTX_CALLBACK_VALUE_WEI);

        emit ShowdownInitiated(j);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL — POT DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════

    function _distributePots() internal {
        uint256 n = _contributingPlayers.length;
        if (n == 0) return;

        uint256[] memory contribs = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            contribs[i] = _handContribution[_contributingPlayers[i]];
        }

        uint256[] memory levels = _uniqueSortedLevels(contribs);

        uint256 prevLevel;
        for (uint256 l = 0; l < levels.length; l++) {
            uint256 level = levels[l];
            uint256 levelSize = level - prevLevel;
            if (levelSize == 0) continue;

            uint256 potAmount;
            address[] memory eligible = new address[](n);
            uint256 eligibleCount;

            for (uint256 i = 0; i < n; i++) {
                if (contribs[i] >= level) {
                    potAmount += levelSize;
                    uint256 pIdx = _playerIndex(_contributingPlayers[i]);
                    if (pIdx != type(uint256).max && players[pIdx].isActive) {
                        eligible[eligibleCount++] = _contributingPlayers[i];
                    }
                }
            }

            if (potAmount > 0 && eligibleCount > 0) {
                _awardPotToBestHand(potAmount, eligible, eligibleCount);
            }

            prevLevel = level;
        }

        pot = 0;
    }

    function _awardPotToBestHand(uint256 amount, address[] memory eligible, uint256 count) internal {
        if (count == 1) {
            uint256 idx = _playerIndex(eligible[0]);
            players[idx].stack += amount;
            emit Winner(eligible[0], amount, "");
            emit PotAwarded(eligible[0], amount);
            return;
        }

        HandEvaluator.EvalResult memory best;
        uint256[] memory winnerIndices = new uint256[](count);
        uint256 winnerCount;

        for (uint256 i = 0; i < count; i++) {
            uint256 pIdx = _playerIndex(eligible[i]);
            uint8[7] memory allCards;
            allCards[0] = players[pIdx].holeCards[0];
            allCards[1] = players[pIdx].holeCards[1];
            allCards[2] = communityCards[0];
            allCards[3] = communityCards[1];
            allCards[4] = communityCards[2];
            allCards[5] = communityCards[3];
            allCards[6] = communityCards[4];

            HandEvaluator.EvalResult memory result = allCards.evaluateHand();

            if (i == 0) {
                best = result;
                winnerCount = 1;
                winnerIndices[0] = pIdx;
            } else if (HandEvaluator._gt(result, best)) {
                best = result;
                winnerCount = 1;
                winnerIndices[0] = pIdx;
            } else if (HandEvaluator._eq(result, best)) {
                winnerIndices[winnerCount] = pIdx;
                winnerCount++;
            }
        }

        string memory handName = HandEvaluator.handRankName(best.handRank);

        uint256 share = amount / winnerCount;
        uint256 remainder = amount % winnerCount;

        for (uint256 i = 0; i < winnerCount; i++) {
            uint256 payout = share + (i == 0 ? remainder : 0);
            players[winnerIndices[i]].stack += payout;
            emit Winner(players[winnerIndices[i]].addr, payout, i == 0 ? handName : "");
            emit PotAwarded(players[winnerIndices[i]].addr, payout);
        }
    }

    function _uniqueSortedLevels(uint256[] memory values) internal pure returns (uint256[] memory) {
        uint256 n = values.length;
        uint256[] memory temp = new uint256[](n);
        uint256 count;

        for (uint256 i = 0; i < n; i++) {
            if (values[i] == 0) continue;
            bool found;
            for (uint256 j = 0; j < count; j++) {
                if (temp[j] == values[i]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                temp[count] = values[i];
                count++;
            }
        }

        for (uint256 i = 1; i < count; i++) {
            uint256 key = temp[i];
            uint256 j = i;
            while (j > 0 && temp[j - 1] > key) {
                temp[j] = temp[j - 1];
                j--;
            }
            temp[j] = key;
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL — CONTRIBUTION TRACKING
    // ═══════════════════════════════════════════════════════════════════════

    function _trackContribution(address player, uint256 amount) internal {
        if (amount == 0) return;
        if (_handContribution[player] == 0) {
            _contributingPlayers.push(player);
        }
        _handContribution[player] += amount;
    }

    function _clearContributions() internal {
        for (uint256 i = 0; i < _contributingPlayers.length; i++) {
            delete _handContribution[_contributingPlayers[i]];
        }
        delete _contributingPlayers;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL — PLAYER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

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
            currentTurnIndex = type(uint256).max;
            dealer = address(0);
            return;
        }

        if (dealerIndex == lastIdx && idx != lastIdx) {
            dealerIndex = idx;
        } else if (dealerIndex > idx) {
            dealerIndex--;
        }
        if (dealerIndex >= players.length) {
            dealerIndex = 0;
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

    function _processLeaveRequests() internal {
        for (uint256 i = players.length; i > 0; i--) {
            uint256 idx = i - 1;
            if (leaveRequested[players[idx].addr]) {
                address playerAddr = players[idx].addr;
                uint256 stack = players[idx].stack;
                delete leaveRequested[playerAddr];
                _removePlayerAt(idx);
                gameToken.safeTransfer(playerAddr, stack);
                emit PlayerLeft(playerAddr, stack);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL — TURN ROTATION
    // ═══════════════════════════════════════════════════════════════════════

    function _nextActiveIndex(uint256 fromIdx) internal view returns (uint256) {
        uint256 next = (fromIdx + 1) % players.length;
        uint256 guard;
        while (!players[next].isActive && guard < players.length) {
            next = (next + 1) % players.length;
            guard++;
        }
        return next;
    }

    function _nextActiveNonAllInIndex(uint256 fromIdx) internal view returns (uint256) {
        uint256 next = (fromIdx + 1) % players.length;
        uint256 guard;
        while ((players[next].isAllIn || !players[next].isActive) && guard < players.length) {
            next = (next + 1) % players.length;
            guard++;
        }
        return next;
    }

    function _rotateDealer() internal view returns (uint256) {
        if (handNumber == 1) {
            for (uint256 i = 0; i < players.length; i++) {
                if (players[i].isActive) return i;
            }
        }
        uint256 next = (dealerIndex + 1) % players.length;
        uint256 guard;
        while (!players[next].isActive && guard < players.length) {
            next = (next + 1) % players.length;
            guard++;
        }
        return next;
    }

    function _allActiveAllIn() internal view returns (bool) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive && !players[i].isAllIn) return false;
        }
        return true;
    }

    function _resetWaitingState() internal {
        _processLeaveRequests();

        phase = GamePhase.Waiting;
        currentBet = 0;
        currentTurnIndex = type(uint256).max;
        _communityDealPending = false;
        _showdownPending = false;
        _pendingCommunityCardCount = 0;
        teEncryptedDeck = bytes("");
        deckPosition = 0;
        _communityCardsDealt = 0;

        for (uint256 i = 0; i < players.length; i++) {
            players[i].betAmount = 0;
            players[i].isActive = false;
            players[i].hasActed = true;
            players[i].isAllIn = false;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL — BITE / COMMUNITY CARDS
    // ═══════════════════════════════════════════════════════════════════════

    function _submitCommunityDeal(uint8 cardCount) internal {
        require(!_communityDealPending && !_showdownPending, CallbackPending());
        require(
            address(this).balance >= minimumCtxReserve() + CTX_CALLBACK_VALUE_WEI, InsufficientCtxReserve()
        );

        uint256 allowedGas = _communityCallbackGasLimit(cardCount);

        bytes[] memory encryptedArgs = new bytes[](1);
        encryptedArgs[0] = teEncryptedDeck;

        bytes[] memory plaintextArgs = new bytes[](1);
        plaintextArgs[0] = bytes("");

        _communityDealPending = true;
        _pendingCommunityCardCount = cardCount;
        currentTurnIndex = type(uint256).max;

        address payable ctxSender =
            BITE.submitCTX(BITE.SUBMIT_CTX_ADDRESS, allowedGas, encryptedArgs, plaintextArgs);

        _pendingCallbackKinds[ctxSender] = PendingCallbackKind.CommunityDeal;
        ctxSender.transfer(CTX_CALLBACK_VALUE_WEI);
    }

    function _completeCommunityDeal(bytes[] calldata decryptedArguments) internal {
        require(_communityDealPending, CallbackPending());
        _communityDealPending = false;

        uint8 cardCount = _pendingCommunityCardCount;
        _pendingCommunityCardCount = 0;
        uint8[52] memory liveDeck = abi.decode(decryptedArguments[0], (uint8[52]));

        for (uint256 i = 0; i < cardCount; i++) {
            communityCards[_communityCardsDealt + i] = liveDeck[deckPosition + i];
        }
        deckPosition += uint8(cardCount);
        _communityCardsDealt += cardCount;

        currentBet = 0;
        _resetActedFlags();

        if (_communityCardsDealt == 3) {
            phase = GamePhase.Flop;
            emit FlopDealt(communityCards[0], communityCards[1], communityCards[2]);
            emit PhaseChanged(GamePhase.Flop);
        } else if (_communityCardsDealt == 4) {
            phase = GamePhase.Turn;
            emit TurnDealt(communityCards[3]);
            emit PhaseChanged(GamePhase.Turn);
        } else if (_communityCardsDealt == 5) {
            phase = GamePhase.River;
            emit RiverDealt(communityCards[4]);
            emit PhaseChanged(GamePhase.River);
        }

        currentTurnIndex = _nextActiveIndex(dealerIndex);

        if (_allActiveAllIn()) {
            if (_communityCardsDealt < 5) {
                _submitCommunityDeal(1);
            } else {
                _initiateShowdown();
            }
        }
    }

    function _communityCallbackGasLimit(uint8 cardCount) internal view returns (uint256) {
        uint256 estimatedGas = minCallbackGas + (uint256(cardCount) * 25_000) + 75_000;
        require(estimatedGas > minCallbackGas, "Gas calc underflow");
        return estimatedGas + CTX_GAS_BUFFER;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INTERNAL — DECK / RNG
    // ═══════════════════════════════════════════════════════════════════════

    function _randCard(uint256 card) internal pure returns (uint8) {
        // forge-lint: disable-next-line(unsafe-typecast) card is 0..51 from deck index, so card%13 in [0,12] and card/13 in [0,3]
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
}
