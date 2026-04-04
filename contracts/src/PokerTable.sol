// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { HandEvaluator } from "./HandEvaluator.sol";

/// @title PokerTable — One contract = one poker table, open to any wallet
/// @notice Players sit down with ETH, deal, bet, showdown. Cards encrypted via BITE.
///         NO built-in AI. NO auto-play. Any wallet (human or external agent) calls actions.
contract PokerTable is IBiteSupplicant {
    using HandEvaluator for uint8[];

    // ──────────────── Enums ────────────────

    enum Phase {
        Waiting,    // 0 — between hands, players may join/leave
        Preflop,    // 1
        Flop,       // 2
        Turn,       // 3
        River,      // 4
        Showdown,   // 5 — BITE CTX decryption / winner determination
        Finished    // 6 — hand resolved, ready for next deal
    }

    // ──────────────── Structs ────────────────

    struct Player {
        address addr;
        bytes32 viewerKey;       // BITE viewer key for encrypted card delivery
        uint256 stack;           // ETH balance at table
        uint256 currentBet;      // Bet in current betting round
        bool    folded;
        bool    hasActed;
        bool    isSeated;
        uint8[2] holeCards;
    }

    // ──────────────── Table config (immutable after deploy) ────────────────

    uint256 public smallBlind;
    uint256 public bigBlind;
    uint256 public minBuyIn;
    uint256 public maxPlayers;
    address public owner;

    // ──────────────── Per-hand state ────────────────

    Phase    public phase;
    uint256  public pot;
    uint256  public currentMaxBet;
    uint256  public dealerIndex;
    uint256  public activePlayerIndex;
    uint8[5] public communityCards;
    uint256  public communityCardCount;
    uint256  public lastRaise;
    uint256  public handCount;

    // ──────────────── Players ────────────────

    Player[] public players;

    // ──────────────── BITE callback auth ────────────────

    mapping(address => bool) public isCallbackSender;

    // ──────────────── Constants ────────────────

    uint256 public constant WITHDRAWAL_FEE_BPS = 100;   // 1%
    uint256 public constant EARLY_QUIT_PENALTY_BPS = 1000; // 10%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ──────────────── Events ────────────────

    event PlayerSatDown(address indexed player, uint256 buyIn);
    event PlayerLeft(address indexed player, uint256 cashout, uint256 fee);
    event HandStarted(uint256 handNumber);
    event CardsDealt(address indexed player);
    event PhaseAdvanced(Phase newPhase);
    event PlayerFolded(address indexed player);
    event PlayerChecked(address indexed player);
    event PlayerCalled(address indexed player, uint256 amount);
    event PlayerRaised(address indexed player, uint256 totalBet, uint256 raiseAmount);
    event ShowdownComplete(address indexed winner, uint256 pot, string winningHand, uint256 winningScore);
    event HandFinished(uint256 handNumber);

    // ──────────────── Errors ────────────────

    error TableFull();
    error AlreadySeated();
    error BuyInTooLow();
    error MustSendETH();
    error InvalidPhase();
    error NotSeated();
    error NotYourTurn();
    error CannotCheck();
    error NothingToCall();
    error InsufficientStack();
    error RaiseTooSmall();
    error NotEnoughPlayers();
    error TransferFailed();
    error NotCallbackSender();

    // ──────────────── Constructor ────────────────
    // Deploy = create table. No factory, no proxy, no cloning.

    constructor(
        uint256 _smallBlind,
        uint256 _bigBlind,
        uint256 _minBuyIn,
        uint256 _maxPlayers
    ) {
        require(_maxPlayers >= 2 && _maxPlayers <= 10, "Max players must be 2-10");
        require(_bigBlind >= _smallBlind && _smallBlind > 0, "Invalid blinds");
        require(_minBuyIn > 0, "Min buy-in must be > 0");

        smallBlind = _smallBlind;
        bigBlind   = _bigBlind;
        minBuyIn   = _minBuyIn;
        maxPlayers = _maxPlayers;
        owner      = msg.sender;
        phase      = Phase.Waiting;
    }

    // ──────────────── Receive ────────────────

    receive() external payable {}

    // ════════════════════════════════════════════
    //  PLAYER MANAGEMENT
    // ════════════════════════════════════════════

    /// @notice Sit down at the table. msg.value = buy-in (ETH).
    ///         Any wallet can call — human, agent, doesn't matter.
    function sitDown(bytes32 viewerKey) external payable {
        if (msg.value < minBuyIn) revert BuyInTooLow();
        if (msg.value == 0) revert MustSendETH();
        if (players.length >= maxPlayers) revert TableFull();

        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].addr == msg.sender) revert AlreadySeated();
        }

        players.push(Player({
            addr:         msg.sender,
            viewerKey:    viewerKey,
            stack:        msg.value,
            currentBet:   0,
            folded:       false,
            hasActed:     false,
            isSeated:     true,
            holeCards:    [uint8(0), 0]
        }));

        emit PlayerSatDown(msg.sender, msg.value);
    }

    /// @notice Stand up and cash out. 10% penalty during active hand, 1% fee always.
    function leaveTable() external {
        uint256 idx = _getPlayerIndex(msg.sender);
        Player storage p = players[idx];
        if (!p.isSeated) revert NotSeated();

        bool wasActive = (idx == activePlayerIndex)
            && (phase >= Phase.Preflop && phase <= Phase.River);

        uint256 amount = p.stack;
        uint256 fee    = 0;

        // 10% early-quit penalty during active hand
        if (phase != Phase.Waiting && phase != Phase.Finished) {
            uint256 penalty = (amount * EARLY_QUIT_PENALTY_BPS) / BPS_DENOMINATOR;
            fee    += penalty;
            amount -= penalty;
        }

        // 1% withdrawal fee always
        uint256 wFee  = (amount * WITHDRAWAL_FEE_BPS) / BPS_DENOMINATOR;
        fee    += wFee;
        amount -= wFee;

        p.stack    = 0;
        p.isSeated = false;
        p.folded   = true;

        if (amount > 0) {
            (bool ok,) = payable(msg.sender).call{value: amount}("");
            if (!ok) revert TransferFailed();
        }

        emit PlayerLeft(msg.sender, amount, fee);

        if (wasActive) {
            _afterAction();
        }
    }

    // ════════════════════════════════════════════
    //  GAME FLOW
    // ════════════════════════════════════════════

    /// @notice Deal a new hand. Anyone seated can call. Requires ≥2 players.
    function dealNewHand() external {
        if (phase != Phase.Waiting && phase != Phase.Finished) revert InvalidPhase();
        if (_countSeated() < 2) revert NotEnoughPlayers();

        handCount++;
        pot                = 0;
        currentMaxBet      = 0;
        communityCardCount = 0;
        lastRaise          = bigBlind;

        // Reset every seat
        for (uint256 i = 0; i < players.length; i++) {
            Player storage p = players[i];
            if (p.isSeated) {
                p.folded       = false;
                p.currentBet   = 0;
                p.hasActed     = false;
                p.holeCards[0] = 0;
                p.holeCards[1] = 0;
            } else {
                p.folded = true;
            }
        }

        // Post blinds
        uint256 sbIdx = _nextSeatedFrom(dealerIndex);
        uint256 bbIdx = _nextSeatedFrom(sbIdx);
        _postBlind(sbIdx, smallBlind);
        _postBlind(bbIdx, bigBlind);
        currentMaxBet = bigBlind;

        // Deal hole cards
        _dealHoleCards();

        phase             = Phase.Preflop;
        activePlayerIndex = _nextActiveFrom(bbIdx);

        emit HandStarted(handCount);
        emit PhaseAdvanced(Phase.Preflop);
    }

    // ════════════════════════════════════════════
    //  PLAYER ACTIONS
    // ════════════════════════════════════════════
    // Any wallet calls these. The table doesn't care who you are.

    function fold() external {
        uint256 idx = _requireActiveTurn(msg.sender);
        players[idx].folded   = true;
        players[idx].hasActed = true;
        emit PlayerFolded(msg.sender);
        _afterAction();
    }

    function check() external {
        uint256 idx = _requireActiveTurn(msg.sender);
        if (currentMaxBet - players[idx].currentBet != 0) revert CannotCheck();
        players[idx].hasActed = true;
        emit PlayerChecked(msg.sender);
        _afterAction();
    }

    function call() external {
        uint256 idx = _requireActiveTurn(msg.sender);
        uint256 toCall = currentMaxBet - players[idx].currentBet;
        if (toCall == 0) revert NothingToCall();

        Player storage p   = players[idx];
        uint256 callAmt    = toCall > p.stack ? p.stack : toCall;

        p.stack       -= callAmt;
        p.currentBet  += callAmt;
        pot           += callAmt;
        p.hasActed     = true;

        emit PlayerCalled(msg.sender, callAmt);
        _afterAction();
    }

    function raise(uint256 raiseAmount) external {
        uint256 idx = _requireActiveTurn(msg.sender);
        Player storage p = players[idx];

        // Enforce minimum raise size
        if (raiseAmount < lastRaise) revert RaiseTooSmall();
        if (raiseAmount < bigBlind) raiseAmount = bigBlind;

        uint256 totalBet = currentMaxBet + raiseAmount;
        uint256 cost     = totalBet - p.currentBet;

        // All-in guard
        if (cost > p.stack) {
            cost     = p.stack;
            totalBet = p.currentBet + cost;
        }

        p.stack       -= cost;
        pot           += cost;
        p.currentBet   = totalBet;
        if (totalBet > currentMaxBet) currentMaxBet = totalBet;
        lastRaise      = raiseAmount;

        // Re-open betting for everyone else
        for (uint256 i = 0; i < players.length; i++) {
            if (i != idx && !players[i].folded && players[i].isSeated) {
                players[i].hasActed = false;
            }
        }
        p.hasActed = true;

        emit PlayerRaised(msg.sender, totalBet, raiseAmount);
        _afterAction();
    }

    // ════════════════════════════════════════════
    //  SHOWDOWN
    // ════════════════════════════════════════════

    /// @notice Initiate BITE CTX decryption for showdown.
    function revealCards() external {
        if (phase != Phase.River) revert InvalidPhase();
        if (getActivePlayerCount() < 2) revert NotEnoughPlayers();

        phase = Phase.Showdown;

        bytes[] memory encrypted = new bytes[](1);
        encrypted[0] = _buildShowdownPayload();

        bytes[] memory plain = new bytes[](1);
        plain[0] = abi.encode(handCount);

        // BITE.submitCTX is internal — call directly
        address cb = BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            500_000,
            encrypted,
            plain
        );
        isCallbackSender[cb] = true;

        emit PhaseAdvanced(Phase.Showdown);
    }

    /// @notice Fallback winner determination (also called after BITE onDecrypt).
    function resolveHand() external {
        if (phase != Phase.Showdown) revert InvalidPhase();
        _evaluateAndDistribute();
    }

    // ════════════════════════════════════════════
    //  BITE CALLBACK
    // ════════════════════════════════════════════

    function onDecrypt(
        bytes[] calldata /* decryptedArguments */,
        bytes[] calldata /* plaintextArguments */
    ) external override {
        if (!isCallbackSender[msg.sender]) revert NotCallbackSender();
        if (phase != Phase.Showdown) revert InvalidPhase();
        _evaluateAndDistribute();
    }

    // ════════════════════════════════════════════
    //  VIEW HELPERS
    // ════════════════════════════════════════════

    function getSeatedPlayerCount() external view returns (uint256) {
        return _countSeated();
    }

    function getActivePlayerCount() public view returns (uint256) {
        uint256 c;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isSeated && !players[i].folded) c++;
        }
        return c;
    }

    function getPlayers() external view returns (Player[] memory) {
        return players;
    }

    function getCommunityCards() external view returns (uint8[] memory) {
        uint8[] memory cards = new uint8[](communityCardCount);
        for (uint256 i = 0; i < communityCardCount; i++) {
            cards[i] = communityCards[i];
        }
        return cards;
    }

    function getActivePlayer() external view returns (address) {
        if (players.length == 0) return address(0);
        return players[activePlayerIndex].addr;
    }

    function getDealer() external view returns (address) {
        if (players.length == 0) return address(0);
        return players[dealerIndex].addr;
    }

    function isPlayerSeated(address who) external view returns (bool) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].addr == who) return players[i].isSeated;
        }
        return false;
    }

    function isPlayerFolded(address who) external view returns (bool) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].addr == who) return players[i].folded;
        }
        return false;
    }

    // ════════════════════════════════════════════
    //  INTERNAL — GAME FLOW CONTROL
    // ════════════════════════════════════════════

    /// @dev Called after every action. Drives the game forward.
    function _afterAction() internal {
        if (phase > Phase.River) return;

        if (_isBettingRoundDone()) {
            _advancePhase();
        } else {
            _findNextActivePlayer();
        }
    }

    function _isBettingRoundDone() internal view returns (bool) {
        if (getActivePlayerCount() <= 1) return true;

        for (uint256 i = 0; i < players.length; i++) {
            Player storage p = players[i];
            if (!p.folded && p.isSeated) {
                if (!p.hasActed) return false;
                if (p.currentBet != currentMaxBet && p.stack > 0) return false;
            }
        }
        return true;
    }

    function _findNextActivePlayer() internal {
        uint256 idx = (activePlayerIndex + 1) % players.length;
        for (uint256 i = 0; i < players.length; i++) {
            Player storage p = players[idx];
            if (p.isSeated && !p.folded && !p.hasActed) {
                activePlayerIndex = idx;
                return;
            }
            idx = (idx + 1) % players.length;
        }
        // Everyone has acted — treat round as done
        _advancePhase();
    }

    function _advancePhase() internal {
        // Reset for new betting round
        for (uint256 i = 0; i < players.length; i++) {
            players[i].currentBet = 0;
            players[i].hasActed   = false;
        }
        currentMaxBet = 0;
        lastRaise     = bigBlind;

        // Only one player left → they win
        if (getActivePlayerCount() <= 1) {
            _evaluateAndDistribute();
            return;
        }

        // Deal community cards and advance phase
        if (phase == Phase.Preflop) {
            _dealCommunity(3);
            phase = Phase.Flop;
        } else if (phase == Phase.Flop) {
            _dealCommunity(1);
            phase = Phase.Turn;
        } else if (phase == Phase.Turn) {
            _dealCommunity(1);
            phase = Phase.River;
        } else if (phase == Phase.River) {
            _evaluateAndDistribute();
            return;
        }

        // First to act post-flop: first active player after dealer
        activePlayerIndex = _nextActiveFrom(dealerIndex);
        emit PhaseAdvanced(phase);
    }

    // ════════════════════════════════════════════
    //  INTERNAL — SHOWDOWN / EVALUATION
    // ════════════════════════════════════════════

    function _evaluateAndDistribute() internal {
        address winner    = address(0);
        uint256 bestScore = 0;
        string memory handName;

        if (getActivePlayerCount() == 1) {
            // Everyone else folded
            for (uint256 i = 0; i < players.length; i++) {
                if (players[i].isSeated && !players[i].folded) {
                    winner = players[i].addr;
                    break;
                }
            }
            handName = "Last Player Standing";
        } else {
            // Evaluate all active hands (best 5 of 7)
            for (uint256 i = 0; i < players.length; i++) {
                Player storage p = players[i];
                if (p.folded || !p.isSeated) continue;

                uint8[] memory hand = new uint8[](7);
                hand[0] = p.holeCards[0];
                hand[1] = p.holeCards[1];
                for (uint256 j = 0; j < communityCardCount && j < 5; j++) {
                    hand[2 + j] = communityCards[j];
                }

                uint256 score = hand.evaluateHand();
                if (score > bestScore) {
                    bestScore = score;
                    winner    = p.addr;
                    handName  = HandEvaluator.getHandName(score);
                }
            }
        }

        // Award pot
        uint256 prize = pot;
        pot = 0;

        if (winner != address(0)) {
            players[_getPlayerIndex(winner)].stack += prize;
        }

        phase = Phase.Finished;

        // Advance dealer
        if (_countSeated() > 0) {
            dealerIndex = _nextSeatedFrom(dealerIndex);
        }

        emit ShowdownComplete(winner, prize, handName, bestScore);
        emit HandFinished(handCount);
    }

    /// @dev Build BITE CTX payload for showdown decryption
    function _buildShowdownPayload() internal view returns (bytes memory) {
        bytes memory data;
        for (uint256 i = 0; i < players.length; i++) {
            Player storage p = players[i];
            if (p.folded || !p.isSeated) continue;
            data = abi.encodePacked(
                data,
                p.addr,
                p.holeCards[0],
                p.holeCards[1],
                p.viewerKey
            );
        }
        return data;
    }

    // ════════════════════════════════════════════
    //  INTERNAL — UTILITY HELPERS
    // ════════════════════════════════════════════

    function _getPlayerIndex(address addr) internal view returns (uint256) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].addr == addr) return i;
        }
        revert NotSeated();
    }

    function _requireActiveTurn(address addr) internal view returns (uint256 idx) {
        if (phase < Phase.Preflop || phase > Phase.River) revert InvalidPhase();
        idx = _getPlayerIndex(addr);
        if (players[idx].folded || !players[idx].isSeated) revert NotYourTurn();
        if (idx != activePlayerIndex) revert NotYourTurn();
    }

    function _countSeated() internal view returns (uint256 c) {
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].isSeated) c++;
        }
    }

    function _nextSeatedFrom(uint256 from) internal view returns (uint256) {
        uint256 idx = (from + 1) % players.length;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[idx].isSeated) return idx;
            idx = (idx + 1) % players.length;
        }
        revert NotEnoughPlayers();
    }

    function _nextActiveFrom(uint256 from) internal view returns (uint256) {
        uint256 idx = (from + 1) % players.length;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[idx].isSeated && !players[idx].folded) return idx;
            idx = (idx + 1) % players.length;
        }
        return from;
    }

    // ════════════════════════════════════════════
    //  INTERNAL — DEALING
    // ════════════════════════════════════════════

    function _postBlind(uint256 idx, uint256 amount) internal {
        Player storage p   = players[idx];
        uint256 amt = amount > p.stack ? p.stack : amount;
        p.stack       -= amt;
        p.currentBet   = amt;
        pot           += amt;
    }

    function _dealHoleCards() internal {
        uint256 seed = uint256(keccak256(abi.encodePacked(
            handCount, block.timestamp, block.prevrandao
        )));

        for (uint256 i = 0; i < players.length; i++) {
            if (!players[i].isSeated) continue;

            uint8 c1 = _genCard(seed, i * 2);
            uint8 c2 = _genCard(seed, i * 2 + 1);

            // Ensure hole cards differ
            while (c2 == c1) {
                seed = uint256(keccak256(abi.encodePacked(seed, c2)));
                c2   = _genCard(seed, i * 2 + 1);
            }

            players[i].holeCards[0] = c1;
            players[i].holeCards[1] = c2;

            emit CardsDealt(players[i].addr);
        }
    }

    function _dealCommunity(uint256 count) internal {
        uint256 seed = uint256(keccak256(abi.encodePacked(
            handCount, communityCardCount, block.timestamp, block.prevrandao
        )));
        for (uint256 i = 0; i < count; i++) {
            communityCards[communityCardCount] = _genCard(seed, 100 + communityCardCount + i);
            communityCardCount++;
        }
    }

    function _genCard(uint256 seed, uint256 index) internal pure returns (uint8) {
        uint256 h    = uint256(keccak256(abi.encodePacked(seed, index)));
        uint8   rank = uint8((h % 13) + 2);   // 2-14
        uint8   suit = uint8((h >> 8) % 4);    // 0-3
        return HandEvaluator.encodeCard(rank, suit);
    }
}
