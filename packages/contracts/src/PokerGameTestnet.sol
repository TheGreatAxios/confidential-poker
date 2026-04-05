// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "./HandEvaluator.sol";

/**
 * @title PokerGameTestnet
 * @notice Texas Hold'em poker — testnet version without BITE encryption.
 *         Cards are hashed (commit-reveal style) instead of encrypted.
 *         Full game loop: sit → deal → bet → showdown → payout.
 */
contract PokerGameTestnet {
    using HandEvaluator for uint8[7];

    enum GamePhase {
        Waiting,   // 0
        Preflop,   // 1
        Flop,      // 2
        Turn,      // 3
        River,     // 4
        Showdown   // 5
    }

    struct Player {
        address addr;
        uint8[2] holeCards;
        bool isActive;
        bool hasActed;
        uint256 betAmount;
        bool isAllIn;
        uint256 stack;       // chip stack
    }

    uint256 public constant SMALL_BLIND = 10;
    uint256 public constant BIG_BLIND = 20;
    uint256 public constant MAX_PLAYERS = 6;
    uint256 public constant MIN_PLAYERS = 2;
    uint256 public constant BUY_IN = 1000;

    GamePhase public phase;
    address public owner;
    uint256 public handNumber;
    uint256 public currentBet;
    uint256 public currentTurnIndex;
    address public dealer;
    uint256 public dealerIndex;

    Player[] public players;
    uint8[5] public communityCards;
    uint256 public pot;

    // ─── Events ──────────────────────────────────────────────────────────
    event PlayerJoined(address indexed player, uint256 seat);
    event GameStarted(uint256 handNumber, address indexed dealer);
    event CardsDealt(address indexed player, uint8 card1, uint8 card2);
    event PhaseChanged(GamePhase newPhase);
    event PlayerFolded(address indexed player);
    event PlayerChecked(address indexed player);
    event PlayerCalled(address indexed player, uint256 amount);
    event PlayerRaised(address indexed player, uint256 totalBet);
    event PlayerWentAllIn(address indexed player, uint256 amount);
    event FlopDealt(uint8 c1, uint8 c2, uint8 c3);
    event TurnDealt(uint8 c);
    event RiverDealt(uint8 c);
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
    error RefundFailed();

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

    constructor() {
        owner = msg.sender;
        phase = GamePhase.Waiting;
    }

    // ═════════════════════════════════════════════════════════════════════
    // PUBLIC ACTIONS
    // ═════════════════════════════════════════════════════════════════════

    function sitDown() external payable {
        require(phase == GamePhase.Waiting, "Game not waiting");
        require(players.length < MAX_PLAYERS, GameIsFull());
        require(_playerIndex(msg.sender) == type(uint256).max, AlreadyJoined());
        require(msg.value >= BUY_IN, "Must send BUY_IN");

        players.push(Player({
            addr: msg.sender,
            holeCards: [uint8(0), uint8(0)],
            isActive: true,
            hasActed: false,
            betAmount: 0,
            isAllIn: false,
            stack: msg.value
        }));

        // Refund excess
        if (msg.value > BUY_IN) {
            (bool ok, ) = msg.sender.call{value: msg.value - BUY_IN}("");
            require(ok, RefundFailed());
        }

        emit PlayerJoined(msg.sender, players.length - 1);

        // Auto-start if enough players
        if (players.length >= MIN_PLAYERS) {
            dealNewHand();
        }
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

    function call() external payable onlyPlayer isCurrentTurn inBettingPhase {
        uint256 toCall = currentBet - players[currentTurnIndex].betAmount;
        require(msg.value >= toCall, NotEnoughForCall());

        // Deduct from stack
        uint256 actualCall = min(toCall, players[currentTurnIndex].stack);
        players[currentTurnIndex].betAmount += actualCall;
        players[currentTurnIndex].stack -= actualCall;
        pot += actualCall;
        players[currentTurnIndex].hasActed = true;

        if (msg.value > actualCall) {
            (bool ok, ) = msg.sender.call{value: msg.value - actualCall}("");
            require(ok, RefundFailed());
        }

        emit PlayerCalled(msg.sender, actualCall);
        _advanceTurn();
    }

    function raise(uint256 raiseAmount) external payable onlyPlayer isCurrentTurn inBettingPhase {
        require(raiseAmount > 0, NotEnoughForRaise());

        uint256 newBet = currentBet + raiseAmount;
        uint256 toPay = newBet - players[currentTurnIndex].betAmount;

        // Cap at player's stack
        if (toPay > players[currentTurnIndex].stack) {
            toPay = players[currentTurnIndex].stack;
            newBet = players[currentTurnIndex].betAmount + toPay;
        }

        require(msg.value >= toPay, NotEnoughForRaise());

        players[currentTurnIndex].betAmount = newBet;
        players[currentTurnIndex].stack -= toPay;
        currentBet = newBet;
        pot += toPay;

        if (msg.value > toPay) {
            (bool ok, ) = msg.sender.call{value: msg.value - toPay}("");
            require(ok, RefundFailed());
        }

        _resetActedFlagsExcept(currentTurnIndex);
        players[currentTurnIndex].hasActed = true;

        emit PlayerRaised(msg.sender, newBet);
        _advanceTurn();
    }

    // ═════════════════════════════════════════════════════════════════════
    // GAME FLOW
    // ═════════════════════════════════════════════════════════════════════

    function dealNewHand() public {
        require(phase == GamePhase.Waiting, "Game not waiting");
        require(players.length >= MIN_PLAYERS, NotEnoughPlayers());

        // Remove busted players
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
        }

        // Deal hole cards (stored in plaintext for testnet)
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, handNumber, msg.sender)));
        for (uint256 i = 0; i < players.length; i++) {
            seed = _nextRand(seed);
            uint8 card1 = uint8((seed % 52) + 1);
            seed = _nextRand(seed);
            uint8 card2 = uint8((seed % 52) + 1);

            uint8 encodedCard1 = HandEvaluator.encodeCard((card1 % 13) + 2, card1 / 13);
            uint8 encodedCard2 = HandEvaluator.encodeCard((card2 % 13) + 2, card2 / 13);

            players[i].holeCards = [encodedCard1, encodedCard2];
            emit CardsDealt(players[i].addr, encodedCard1, encodedCard2);
        }

        // Post blinds
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

    function dealFlop() external onlyOwner {
        require(phase == GamePhase.Preflop, "Must be preflop");
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

    function dealTurn() external onlyOwner {
        require(phase == GamePhase.Flop, "Must be flop");
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

    function dealRiver() external onlyOwner {
        require(phase == GamePhase.Turn, "Must be turn");
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

    function resolveHand() external onlyOwner {
        require(phase == GamePhase.River, "Must be river");
        _collectBets();

        phase = GamePhase.Showdown;

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

    function leaveTable() external onlyPlayer {
        require(phase == GamePhase.Waiting, "Game in progress");
        uint256 idx = _playerIndex(msg.sender);
        require(idx != type(uint256).max, NotAPlayer());

        uint256 stack = players[idx].stack;
        // Remove player and swap with last
        uint256 lastIdx = players.length - 1;
        if (idx != lastIdx) {
            players[idx] = players[lastIdx];
        }
        players.pop();

        (bool ok, ) = msg.sender.call{value: stack}("");
        require(ok, RefundFailed());
        emit PlayerLeft(msg.sender, stack);
    }

    // ═════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════

    function getMyHoleCards() external view onlyPlayer returns (uint8 card1, uint8 card2) {
        uint256 idx = _playerIndex(msg.sender);
        return (players[idx].holeCards[0], players[idx].holeCards[1]);
    }

    function getPlayerHoleCards(uint256 idx) external view returns (uint8 card1, uint8 card2) {
        return (players[idx].holeCards[0], players[idx].holeCards[1]);
    }

    function getCommunityCards() external view returns (uint8[5] memory) {
        return communityCards;
    }

    function playerCount() external view returns (uint256) {
        return players.length;
    }

    function getPlayerAddress(uint256 idx) external view returns (address) {
        return players[idx].addr;
    }

    function getPlayerStack(uint256 idx) external view returns (uint256) {
        return players[idx].stack;
    }

    function activePlayerCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isActive) count++;
        }
        return count;
    }

    function getPhaseName() external view returns (string memory) {
        if (phase == GamePhase.Waiting) return "Waiting";
        if (phase == GamePhase.Preflop) return "Preflop";
        if (phase == GamePhase.Flop) return "Flop";
        if (phase == GamePhase.Turn) return "Turn";
        if (phase == GamePhase.River) return "River";
        return "Showdown";
    }

    function getPlayerCount() external view returns (uint256) {
        return players.length;
    }

    function getPlayerInfo(uint256 idx) external view returns (
        address addr, uint8 c1, uint8 c2, bool active, bool acted, uint256 bet, bool allIn, uint256 stack
    ) {
        Player storage p = players[idx];
        return (p.addr, p.holeCards[0], p.holeCards[1], p.isActive, p.hasActed, p.betAmount, p.isAllIn, p.stack);
    }

    function getCurrentTurnIndex() external view returns (uint256) {
        return currentTurnIndex;
    }

    // ─── Internal ────────────────────────────────────────────────────────

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
        for (uint256 i = 0; i < 5; i++) communityCards[i] = 0;
    }

    function _resetActedFlags() internal {
        for (uint256 i = 0; i < players.length; i++) players[i].hasActed = false;
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
        (bool ok, ) = winner.call{value: amount}("");
        require(ok, "Transfer failed");
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
