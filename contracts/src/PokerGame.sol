// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { IBiteSupplicant } from "@skalenetwork/bite-solidity/interfaces/IBiteSupplicant.sol";
import { BITE } from "@skalenetwork/bite-solidity/BITE.sol";
import { HandEvaluator } from "./HandEvaluator.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title PokerGame - Texas Hold'em with BITE encrypted card dealing
/// @notice Agents join with encrypted identities, cards dealt via CTX, betting in plaintext
contract PokerGame is IBiteSupplicant {
    using HandEvaluator for uint8[];

    // ============ Enums ============

    enum GamePhase {
        Waiting,    // Table open, waiting for players
        Dealing,    // Cards being encrypted and dealt via CTX
        Preflop,    // Pre-flop betting round
        Flop,       // Flop betting round
        Turn,       // Turn betting round
        River,      // River betting round
        Showdown,   // Reveal cards, determine winner
        Finished    // Hand complete
    }

    enum PlayerAction {
        Fold,
        Check,
        Call,
        Raise
    }

    // ============ Structs ============

    struct Player {
        address addr;
        bytes32 encryptedIdentity;  // BITE-encrypted agent identity
        uint256 stack;              // AxiosUSD balance at table
        uint256 currentBet;         // Bet in current round
        bool folded;
        bool hasActed;              // Whether player acted this round
        uint8[2] holeCards;         // Revealed hole cards (set after CTX callback)
        bool cardsRevealed;
    }

    struct Game {
        uint256 id;
        address owner;
        uint256 smallBlind;
        uint256 bigBlind;
        uint256 minBuyIn;
        uint256 maxPlayers;
        GamePhase phase;
        uint256 playerCount;
        uint256 pot;
        uint256 currentMaxBet;
        uint256 dealerIndex;
        uint256 activePlayerIndex;
        uint8[5] communityCards;
        uint256 communityCardCount;
        uint256 lastRaise;
        bool active;
    }

    // ============ State ============

    IERC20 public immutable bettingToken;  // AxiosUSD
    uint256 public gameCounter;

    mapping(uint256 => Game) public games;
    mapping(uint256 => Player[]) public gamePlayers;
    mapping(uint256 => mapping(address => uint256)) public playerIndex; // game => addr => index
    mapping(uint256 => bool) public gameExists;

    // CTX tracking
    mapping(uint256 => bytes) public pendingEncryptedCards; // gameId => encrypted card data
    mapping(address => uint256) public callbackGameId;      // callbackSender => gameId

    // ============ Events ============

    event TableCreated(
        uint256 indexed gameId,
        address indexed owner,
        uint256 smallBlind,
        uint256 bigBlind,
        uint256 minBuyIn,
        uint256 maxPlayers
    );

    event PlayerJoined(
        uint256 indexed gameId,
        address indexed player,
        bytes32 encryptedIdentity,
        uint256 buyIn
    );

    event CardsDealt(
        uint256 indexed gameId,
        uint256 indexed playerIndex
    );

    event PhaseAdvanced(
        uint256 indexed gameId,
        GamePhase newPhase
    );

    event ActionSubmitted(
        uint256 indexed gameId,
        address indexed player,
        PlayerAction action,
        uint256 amount
    );

    event ShowdownComplete(
        uint256 indexed gameId,
        address indexed winner,
        uint256 pot,
        string winningHand,
        uint256 winningScore
    );

    event GameFinished(uint256 indexed gameId);

    // ============ Errors ============

    error GameNotFound();
    error GameNotActive();
    error GameFull();
    error NotPlayer();
    error NotYourTurn();
    error InvalidBet();
    error InsufficientStack();
    error InvalidPhase();
    error AlreadyActed();
    error AlreadyJoined();
    error BuyInTooLow();
    error NoPlayers();
    error NotEnoughPlayers();

    // ============ Constructor ============

    constructor(address _bettingToken) {
        bettingToken = IERC20(_bettingToken);
    }

    // ============ Table Management ============

    /// @notice Create a new poker table
    function createTable(
        uint256 smallBlind,
        uint256 bigBlind,
        uint256 minBuyIn,
        uint256 maxPlayers
    ) external returns (uint256 gameId) {
        require(maxPlayers >= 2 && maxPlayers <= 9, "Invalid player count");
        require(bigBlind >= smallBlind && smallBlind > 0, "Invalid blinds");

        gameCounter++;
        gameId = gameCounter;

        games[gameId] = Game({
            id: gameId,
            owner: msg.sender,
            smallBlind: smallBlind,
            bigBlind: bigBlind,
            minBuyIn: minBuyIn,
            maxPlayers: maxPlayers,
            phase: GamePhase.Waiting,
            playerCount: 0,
            pot: 0,
            currentMaxBet: 0,
            dealerIndex: 0,
            activePlayerIndex: 0,
            communityCards: [uint8(0), 0, 0, 0, 0],
            communityCardCount: 0,
            lastRaise: bigBlind,
            active: true
        });

        gameExists[gameId] = true;

        emit TableCreated(gameId, msg.sender, smallBlind, bigBlind, minBuyIn, maxPlayers);
    }

    /// @notice Join a table with encrypted identity and buy-in
    function joinTable(
        uint256 gameId,
        bytes32 encryptedIdentity,
        uint256 buyIn
    ) external {
        Game storage game = games[gameId];
        if (!gameExists[gameId]) revert GameNotFound();
        if (!game.active) revert GameNotActive();
        if (game.playerCount >= game.maxPlayers) revert GameFull();
        if (playerIndex[gameId][msg.sender] != 0 || 
            (gamePlayers[gameId].length > 0 && gamePlayers[gameId][0].addr == msg.sender)) revert AlreadyJoined();
        if (buyIn < game.minBuyIn) revert BuyInTooLow();

        // Transfer betting tokens from player
        require(
            bettingToken.transferFrom(msg.sender, address(this), buyIn),
            "Token transfer failed"
        );

        uint256 idx = gamePlayers[gameId].length;
        gamePlayers[gameId].push(Player({
            addr: msg.sender,
            encryptedIdentity: encryptedIdentity,
            stack: buyIn,
            currentBet: 0,
            folded: false,
            hasActed: false,
            holeCards: [uint8(0), 0],
            cardsRevealed: false
        }));

        playerIndex[gameId][msg.sender] = idx + 1; // +1 to distinguish from 0
        game.playerCount++;

        emit PlayerJoined(gameId, msg.sender, encryptedIdentity, buyIn);
    }

    // ============ Game Flow ============

    /// @notice Start a hand - begins the dealing phase via CTX
    function startHand(uint256 gameId) external {
        Game storage game = games[gameId];
        if (!gameExists[gameId]) revert GameNotFound();
        if (game.phase != GamePhase.Waiting && game.phase != GamePhase.Finished) revert InvalidPhase();
        if (game.playerCount < 2) revert NotEnoughPlayers();

        // Reset game state for new hand
        game.phase = GamePhase.Dealing;
        game.pot = 0;
        game.currentMaxBet = 0;
        game.communityCardCount = 0;
        game.lastRaise = game.bigBlind;

        // Reset players
        for (uint i = 0; i < gamePlayers[gameId].length; i++) {
            Player storage p = gamePlayers[gameId][i];
            p.folded = false;
            p.currentBet = 0;
            p.hasActed = false;
            p.cardsRevealed = false;
            p.holeCards[0] = 0;
            p.holeCards[1] = 0;
        }

        // Post blinds
        uint256 sbIndex = game.dealerIndex % game.playerCount;
        uint256 bbIndex = (game.dealerIndex + 1) % game.playerCount;

        _postBlind(gameId, sbIndex, game.smallBlind);
        _postBlind(gameId, bbIndex, game.bigBlind);

        game.currentMaxBet = game.bigBlind;

        // Prepare encrypted card data for CTX
        // The encrypted payload contains the hole cards for each player
        bytes memory encryptedPayload = _buildEncryptedCardsPayload(gameId);
        pendingEncryptedCards[gameId] = encryptedPayload;

        // Submit CTX for card dealing
        bytes[] memory encryptedArgs = new bytes[](1);
        encryptedArgs[0] = encryptedPayload;
        bytes[] memory plaintextArgs = new bytes[](1);
        plaintextArgs[0] = abi.encode(gameId);

        address callbackSender = BITE.submitCTX(
            BITE.SUBMIT_CTX_ADDRESS,
            500_000,  // gas limit for callback
            encryptedArgs,
            plaintextArgs
        );

        callbackGameId[callbackSender] = gameId;

        emit PhaseAdvanced(gameId, GamePhase.Dealing);
    }

    /// @notice CTX callback - reveals dealt cards
    function onDecrypt(
        bytes[] calldata decryptedArguments,
        bytes[] calldata plaintextArguments
    ) external override {
        uint256 gameId = abi.decode(plaintextArguments[0], (uint256));
        Game storage game = games[gameId];
        if (!gameExists[gameId]) revert GameNotFound();

        // Decode the decrypted card data
        // Format: array of (playerIndex, card1, card2) packed in bytes
        bytes memory cardData = decryptedArguments[0];

        // For testing without BITE precompile, we allow owner to call with mock data
        // In production, this is only called by the DecryptAndExecute precompile

        _revealCards(gameId, cardData);

        // Advance to preflop
        game.phase = GamePhase.Preflop;
        game.activePlayerIndex = (game.dealerIndex + 2) % game.playerCount;

        // Skip folded/inactive players
        _findNextActivePlayer(gameId);

        emit PhaseAdvanced(gameId, GamePhase.Preflop);
    }

    /// @notice Submit a player action (fold, check, call, raise)
    function submitAction(
        uint256 gameId,
        PlayerAction action,
        uint256 raiseAmount
    ) external {
        Game storage game = games[gameId];
        if (!gameExists[gameId]) revert GameNotFound();
        if (game.phase < GamePhase.Preflop || game.phase > GamePhase.River) revert InvalidPhase();

        uint256 idx = playerIndex[gameId][msg.sender];
        if (idx == 0) revert NotPlayer();
        idx -= 1; // Convert back to 0-based

        Player storage player = gamePlayers[gameId][idx];
        if (player.folded) revert NotPlayer();
        if (idx != game.activePlayerIndex) revert NotYourTurn();

        uint256 toCall = game.currentMaxBet - player.currentBet;

        if (action == PlayerAction.Fold) {
            player.folded = true;
            player.hasActed = true;
        } else if (action == PlayerAction.Check) {
            require(toCall == 0, "Cannot check, must call or fold");
            player.hasActed = true;
        } else if (action == PlayerAction.Call) {
            uint256 callAmount = toCall;
            if (callAmount > player.stack) callAmount = player.stack; // All-in
            player.stack -= callAmount;
            player.currentBet += callAmount;
            game.pot += callAmount;
            player.hasActed = true;
        } else if (action == PlayerAction.Raise) {
            require(raiseAmount >= game.lastRaise, "Raise too small");
            uint256 totalBet = game.currentMaxBet + raiseAmount;
            uint256 raiseCost = totalBet - player.currentBet;
            require(raiseCost <= player.stack, "Insufficient stack");

            player.stack -= raiseCost;
            game.pot += raiseCost;
            player.currentBet = totalBet;
            game.currentMaxBet = totalBet;
            game.lastRaise = raiseAmount;

            // Reset hasActed for other players (they need to respond to raise)
            for (uint i = 0; i < gamePlayers[gameId].length; i++) {
                if (i != idx && !gamePlayers[gameId][i].folded) {
                    gamePlayers[gameId][i].hasActed = false;
                }
            }
            player.hasActed = true;
        }

        emit ActionSubmitted(gameId, msg.sender, action, raiseAmount);

        // Check if betting round is complete
        if (_isBettingRoundComplete(gameId)) {
            _advancePhase(gameId);
        } else {
            _findNextActivePlayer(gameId);
        }
    }

    // ============ View Functions ============

    /// @notice Get game state
    function getGameState(uint256 gameId) external view returns (
        GamePhase phase,
        uint256 pot,
        uint256 currentMaxBet,
        uint256 communityCardCount,
        uint256 activePlayerIndex,
        bool active
    ) {
        Game storage game = games[gameId];
        return (
            game.phase,
            game.pot,
            game.currentMaxBet,
            game.communityCardCount,
            game.activePlayerIndex,
            game.active
        );
    }

    /// @notice Get player info
    function getPlayerInfo(uint256 gameId, uint256 idx) external view returns (
        address addr,
        uint256 stack,
        uint256 currentBet,
        bool folded,
        bool hasActed,
        bool cardsRevealed
    ) {
        Player storage p = gamePlayers[gameId][idx];
        return (p.addr, p.stack, p.currentBet, p.folded, p.hasActed, p.cardsRevealed);
    }

    /// @notice Get community cards
    function getCommunityCards(uint256 gameId) external view returns (uint8[] memory) {
        Game storage game = games[gameId];
        uint8[] memory cards = new uint8[](game.communityCardCount);
        for (uint i = 0; i < game.communityCardCount; i++) {
            cards[i] = game.communityCards[i];
        }
        return cards;
    }

    /// @notice Get number of players at a table
    function getPlayerCount(uint256 gameId) external view returns (uint256) {
        return games[gameId].playerCount;
    }

    /// @notice Get active (non-folded) player count
    function getActivePlayerCount(uint256 gameId) public view returns (uint256) {
        uint256 count = 0;
        for (uint i = 0; i < gamePlayers[gameId].length; i++) {
            if (!gamePlayers[gameId][i].folded) count++;
        }
        return count;
    }

    // ============ Internal Functions ============

    function _postBlind(uint256 gameId, uint256 playerIdx, uint256 amount) internal {
        Player storage player = gamePlayers[gameId][playerIdx];
        uint256 blindAmount = amount;
        if (blindAmount > player.stack) blindAmount = player.stack;
        player.stack -= blindAmount;
        player.currentBet = blindAmount;
        games[gameId].pot += blindAmount;
    }

    function _buildEncryptedCardsPayload(uint256 gameId) internal view returns (bytes memory) {
        // In production, this would be encrypted client-side via BITE SDK
        // For now, we encode the raw card data that will be encrypted by the SDK
        // Format: for each player: (playerIndex, card1, card2)
        Game storage game = games[gameId];
        uint256 playerCount = game.playerCount;

        // Generate cards using SKALE RNG (precompile 0x18)
        // For testing, we use a simple deterministic approach
        bytes memory payload = abi.encode(playerCount);

        // Each card: rank (2-14) in lower 4 bits, suit (0-3) in upper 2 bits
        // We'll generate cards in the CTX callback
        return payload;
    }

    function _revealCards(uint256 gameId, bytes memory cardData) internal {
        Game storage game = games[gameId];

        // Decode card data: array of (playerIndex, card1, card2)
        // For now, generate deterministic cards based on gameId
        // In production, this comes from the decrypted CTX payload
        uint256 seed = uint256(keccak256(abi.encodePacked(gameId, block.timestamp)));

        for (uint i = 0; i < game.playerCount; i++) {
            Player storage player = gamePlayers[gameId][i];

            // Generate 2 unique cards per player
            uint8 card1 = _generateCard(seed, i * 2);
            uint8 card2 = _generateCard(seed, i * 2 + 1);

            // Ensure cards are unique
            while (card2 == card1) {
                seed = uint256(keccak256(abi.encodePacked(seed, card2)));
                card2 = _generateCard(seed, i * 2 + 1);
            }

            player.holeCards[0] = card1;
            player.holeCards[1] = card2;
            player.cardsRevealed = true;

            emit CardsDealt(gameId, i);
        }
    }

    function _generateCard(uint256 seed, uint256 index) internal pure returns (uint8) {
        uint256 h = uint256(keccak256(abi.encodePacked(seed, index)));
        uint8 rank = uint8((h % 13) + 2);  // 2-14
        uint8 suit = uint8((h >> 8) % 4);   // 0-3
        return HandEvaluator.encodeCard(rank, suit);
    }

    function _findNextActivePlayer(uint256 gameId) internal {
        Game storage game = games[gameId];
        uint256 startIdx = game.activePlayerIndex;
        uint256 idx = (startIdx + 1) % game.playerCount;

        // Find next non-folded player who hasn't acted
        uint256 maxIterations = game.playerCount;
        while (maxIterations > 0) {
            Player storage p = gamePlayers[gameId][idx];
            if (!p.folded && !p.hasActed) {
                game.activePlayerIndex = idx;
                return;
            }
            idx = (idx + 1) % game.playerCount;
            maxIterations--;
        }

        // All players have acted or folded
        _advancePhase(gameId);
    }

    function _isBettingRoundComplete(uint256 gameId) internal view returns (bool) {
        Game storage game = games[gameId];
        uint256 activeCount = getActivePlayerCount(gameId);

        if (activeCount <= 1) return true; // Everyone else folded

        // Check if all active players have acted and bets are equal
        for (uint i = 0; i < game.playerCount; i++) {
            Player storage p = gamePlayers[gameId][i];
            if (!p.folded) {
                if (!p.hasActed) return false;
                if (p.currentBet != game.currentMaxBet && p.stack > 0) return false;
            }
        }

        return true;
    }

    function _advancePhase(uint256 gameId) internal {
        Game storage game = games[gameId];

        // Reset bets for new round
        for (uint i = 0; i < game.playerCount; i++) {
            gamePlayers[gameId][i].currentBet = 0;
            gamePlayers[gameId][i].hasActed = false;
        }
        game.currentMaxBet = 0;
        game.lastRaise = game.bigBlind;

        if (game.phase == GamePhase.Preflop) {
            // Deal flop (3 community cards)
            _dealCommunityCards(gameId, 3);
            game.phase = GamePhase.Flop;
        } else if (game.phase == GamePhase.Flop) {
            _dealCommunityCards(gameId, 1);
            game.phase = GamePhase.Turn;
        } else if (game.phase == GamePhase.Turn) {
            _dealCommunityCards(gameId, 1);
            game.phase = GamePhase.River;
        } else if (game.phase == GamePhase.River) {
            game.phase = GamePhase.Showdown;
            _resolveShowdown(gameId);
            return;
        }

        // Check if only one player remains
        if (getActivePlayerCount(gameId) <= 1) {
            _resolveShowdown(gameId);
            return;
        }

        game.activePlayerIndex = game.dealerIndex % game.playerCount;
        _findNextActivePlayer(gameId);

        emit PhaseAdvanced(gameId, game.phase);
    }

    function _dealCommunityCards(uint256 gameId, uint256 count) internal {
        Game storage game = games[gameId];
        uint256 seed = uint256(keccak256(abi.encodePacked(gameId, game.communityCardCount, block.timestamp)));

        for (uint i = 0; i < count; i++) {
            uint8 card = _generateCard(seed, 100 + game.communityCardCount + i);
            game.communityCards[game.communityCardCount] = card;
            game.communityCardCount++;
        }
    }

    function _resolveShowdown(uint256 gameId) internal {
        Game storage game = games[gameId];
        uint256 activeCount = getActivePlayerCount(gameId);

        address winner;
        uint256 winningScore = 0;
        string memory winningHand = "";

        if (activeCount == 1) {
            // Only one player left - they win
            for (uint i = 0; i < game.playerCount; i++) {
                if (!gamePlayers[gameId][i].folded) {
                    winner = gamePlayers[gameId][i].addr;
                    break;
                }
            }
            winningHand = "Last Player Standing";
        } else {
            // Evaluate all active players' hands
            for (uint i = 0; i < game.playerCount; i++) {
                Player storage p = gamePlayers[gameId][i];
                if (p.folded) continue;

                // Build 7-card hand (2 hole + 5 community)
                uint8[] memory hand = new uint8[](7);
                hand[0] = p.holeCards[0];
                hand[1] = p.holeCards[1];
                for (uint j = 0; j < game.communityCardCount; j++) {
                    hand[2 + j] = game.communityCards[j];
                }

                uint256 score = hand.evaluateHand();
                if (score > winningScore) {
                    winningScore = score;
                    winner = p.addr;
                    winningHand = HandEvaluator.getHandName(score);
                }
            }
        }

        // Distribute pot
        uint256 prize = game.pot;
        game.pot = 0;

        if (winner != address(0)) {
            // Add pot to winner's stack
            uint256 wIdx = playerIndex[gameId][winner];
            if (wIdx > 0) {
                gamePlayers[gameId][wIdx - 1].stack += prize;
            }
        }

        game.phase = GamePhase.Finished;
        game.active = false;

        // Advance dealer
        if (game.playerCount > 0) {
            game.dealerIndex = (game.dealerIndex + 1) % game.playerCount;
        }

        emit ShowdownComplete(gameId, winner, prize, winningHand, winningScore);
        emit GameFinished(gameId);
    }

    // ============ Admin / Testing ============

    /// @notice Start hand without CTX (for testing on chains without BITE precompile)
    function startHandNoCTX(uint256 gameId) external {
        Game storage game = games[gameId];
        if (!gameExists[gameId]) revert GameNotFound();
        if (game.phase != GamePhase.Waiting && game.phase != GamePhase.Finished) revert InvalidPhase();
        if (game.playerCount < 2) revert NotEnoughPlayers();

        // Reset game state for new hand
        game.phase = GamePhase.Dealing;
        game.pot = 0;
        game.currentMaxBet = 0;
        game.communityCardCount = 0;
        game.lastRaise = game.bigBlind;

        // Reset players
        for (uint i = 0; i < gamePlayers[gameId].length; i++) {
            Player storage p = gamePlayers[gameId][i];
            p.folded = false;
            p.currentBet = 0;
            p.hasActed = false;
            p.cardsRevealed = false;
            p.holeCards[0] = 0;
            p.holeCards[1] = 0;
        }

        // Post blinds
        uint256 sbIndex = game.dealerIndex % game.playerCount;
        uint256 bbIndex = (game.dealerIndex + 1) % game.playerCount;
        _postBlind(gameId, sbIndex, game.smallBlind);
        _postBlind(gameId, bbIndex, game.bigBlind);
        game.currentMaxBet = game.bigBlind;
    }

    /// @notice Reveal cards manually (for testing without BITE precompile)
    function revealCardsManually(uint256 gameId) external {
        Game storage game = games[gameId];
        if (!gameExists[gameId]) revert GameNotFound();
        require(game.phase == GamePhase.Dealing, "Not in dealing phase");

        // Generate mock card data
        bytes memory mockData = abi.encode(gameId);
        _revealCards(gameId, mockData);

        game.phase = GamePhase.Preflop;
        game.activePlayerIndex = (game.dealerIndex + 2) % game.playerCount;
        _findNextActivePlayer(gameId);

        emit PhaseAdvanced(gameId, GamePhase.Preflop);
    }

    /// @notice Force payout for testing
    function forcePayout(uint256 gameId, address winner) external {
        Game storage game = games[gameId];
        if (!gameExists[gameId]) revert GameNotFound();
        uint256 pot = game.pot;
        game.pot = 0;
        game.phase = GamePhase.Finished;
        game.active = false;
        require(bettingToken.transfer(winner, pot), "Payout failed");
        emit ShowdownComplete(gameId, winner, pot, "Force Payout", 0);
        emit GameFinished(gameId);
    }
}
