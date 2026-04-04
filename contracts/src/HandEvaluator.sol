// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title HandEvaluator - Texas Hold'em hand ranking library
/// @notice Evaluates 5-7 cards and returns a comparable hand score
/// @dev Card encoding: uint8 where bits 0-3 = rank (2-14), bits 4-5 = suit (0-3)
library HandEvaluator {
    // Hand rankings (higher = better)
    uint8 public constant HIGH_CARD = 0;
    uint8 public constant ONE_PAIR = 1;
    uint8 public constant TWO_PAIR = 2;
    uint8 public constant THREE_OF_A_KIND = 3;
    uint8 public constant STRAIGHT = 4;
    uint8 public constant FLUSH = 5;
    uint8 public constant FULL_HOUSE = 6;
    uint8 public constant FOUR_OF_A_KIND = 7;
    uint8 public constant STRAIGHT_FLUSH = 8;
    uint8 public constant ROYAL_FLUSH = 9;

    /// @notice Card encoding helpers
    function getRank(uint8 card) internal pure returns (uint8) {
        return card & 0x0F; // lower 4 bits: rank 2-14
    }

    function getSuit(uint8 card) internal pure returns (uint8) {
        return (card >> 4) & 0x03; // upper 2 bits: suit 0-3
    }

    /// @notice Encode a card from rank and suit
    function encodeCard(uint8 rank, uint8 suit) internal pure returns (uint8) {
        require(rank >= 2 && rank <= 14, "Invalid rank");
        require(suit <= 3, "Invalid suit");
        return (suit << 4) | rank;
    }

    /// @notice Evaluate a hand from 5-7 cards, returns a uint256 score
    /// @dev Score format: (handRank << 200) | tiebreaker bits
    /// Higher score = better hand. Tiebreakers use card ranks in descending order.
    function evaluateHand(uint8[] memory cards) internal pure returns (uint256) {
        require(cards.length >= 5 && cards.length <= 7, "Need 5-7 cards");

        // Find the best 5-card combination
        uint256 bestScore = 0;

        if (cards.length == 5) {
            bestScore = _score5(cards);
        } else if (cards.length == 6) {
            // Try all 5-card combinations from 6 cards (6 combos)
            for (uint i = 0; i < 6; i++) {
                uint8[5] memory five;
                uint idx = 0;
                for (uint j = 0; j < 6; j++) {
                    if (j != i) {
                        five[idx] = cards[j];
                        idx++;
                    }
                }
                uint256 score = _score5Fixed(five);
                if (score > bestScore) bestScore = score;
            }
        } else {
            // 7 cards: try all 21 combinations of 5
            for (uint i = 0; i < 7; i++) {
                for (uint j = i + 1; j < 7; j++) {
                    uint8[5] memory five;
                    uint idx = 0;
                    for (uint k = 0; k < 7; k++) {
                        if (k != i && k != j) {
                            five[idx] = cards[k];
                            idx++;
                        }
                    }
                    uint256 score = _score5Fixed(five);
                    if (score > bestScore) bestScore = score;
                }
            }
        }

        return bestScore;
    }

    /// @notice Score exactly 5 cards (from memory array)
    function _score5(uint8[] memory cards) internal pure returns (uint256) {
        uint8[5] memory five;
        for (uint i = 0; i < 5; i++) five[i] = cards[i];
        return _score5Fixed(five);
    }

    /// @notice Score exactly 5 cards (fixed-size array for efficiency)
    function _score5Fixed(uint8[5] memory cards) internal pure returns (uint256) {
        // Extract ranks and suits
        uint8[5] memory ranks;
        uint8[5] memory suits;
        for (uint i = 0; i < 5; i++) {
            ranks[i] = getRank(cards[i]);
            suits[i] = getSuit(cards[i]);
        }

        // Sort ranks descending (simple bubble sort for 5 elements)
        for (uint i = 0; i < 4; i++) {
            for (uint j = 0; j < 4 - i; j++) {
                if (ranks[j] < ranks[j + 1]) {
                    (ranks[j], ranks[j + 1]) = (ranks[j + 1], ranks[j]);
                }
            }
        }

        bool isFlush = (suits[0] == suits[1] && suits[1] == suits[2] &&
                        suits[2] == suits[3] && suits[3] == suits[4]);

        bool isStraight = _isStraight(ranks);

        // Check for wheel (A-2-3-4-5): ranks are 14,5,4,3,2
        bool isWheel = !isStraight &&
            ranks[0] == 14 && ranks[1] == 5 && ranks[2] == 4 &&
            ranks[3] == 3 && ranks[4] == 2;

        if (isWheel) isStraight = true;

        // Count rank frequencies
        uint8[15] memory counts;
        for (uint i = 0; i < 5; i++) {
            counts[ranks[i]]++;
        }

        uint8 maxCount = 0;
        uint8 secondCount = 0;
        uint8 maxRank = 0;
        uint8 secondRank = 0;

        for (uint r = 2; r <= 14; r++) {
            if (counts[r] > maxCount) {
                secondCount = maxCount;
                secondRank = maxRank;
                maxCount = counts[r];
                maxRank = uint8(r);
            } else if (counts[r] > secondCount) {
                secondCount = counts[r];
                secondRank = uint8(r);
            }
        }

        // Determine hand rank and build score
        uint8 handRank;
        uint256 tiebreaker;

        if (isFlush && isStraight) {
            if (ranks[0] == 14 && ranks[1] == 13) {
                handRank = ROYAL_FLUSH;
                tiebreaker = 0;
            } else {
                handRank = STRAIGHT_FLUSH;
                tiebreaker = uint256(isWheel ? 5 : ranks[0]) << 192;
            }
        } else if (maxCount == 4) {
            handRank = FOUR_OF_A_KIND;
            tiebreaker = (uint256(maxRank) << 192) | (uint256(secondRank) << 184);
        } else if (maxCount == 3 && secondCount == 2) {
            handRank = FULL_HOUSE;
            tiebreaker = (uint256(maxRank) << 192) | (uint256(secondRank) << 184);
        } else if (isFlush) {
            handRank = FLUSH;
            tiebreaker = (uint256(ranks[0]) << 192) | (uint256(ranks[1]) << 184) |
                        (uint256(ranks[2]) << 176) | (uint256(ranks[3]) << 168) |
                        (uint256(ranks[4]) << 160);
        } else if (isStraight) {
            handRank = STRAIGHT;
            tiebreaker = uint256(isWheel ? 5 : ranks[0]) << 192;
        } else if (maxCount == 3) {
            // Three of a kind - collect kickers
            uint8 kicker1 = 0;
            uint8 kicker2 = 0;
            for (uint i = 0; i < 5; i++) {
                if (ranks[i] != maxRank) {
                    if (kicker1 == 0) kicker1 = ranks[i];
                    else kicker2 = ranks[i];
                }
            }
            handRank = THREE_OF_A_KIND;
            tiebreaker = (uint256(maxRank) << 192) | (uint256(kicker1) << 184) | (uint256(kicker2) << 176);
        } else if (maxCount == 2 && secondCount == 2) {
            // Two pair
            uint8 kicker = 0;
            for (uint i = 0; i < 5; i++) {
                if (ranks[i] != maxRank && ranks[i] != secondRank) {
                    kicker = ranks[i];
                }
            }
            // Ensure higher pair is first
            if (secondRank > maxRank) {
                (maxRank, secondRank) = (secondRank, maxRank);
            }
            handRank = TWO_PAIR;
            tiebreaker = (uint256(maxRank) << 192) | (uint256(secondRank) << 184) | (uint256(kicker) << 176);
        } else if (maxCount == 2) {
            // One pair - collect 3 kickers
            uint8[3] memory kickers;
            uint kIdx = 0;
            for (uint i = 0; i < 5; i++) {
                if (ranks[i] != maxRank) {
                    kickers[kIdx] = ranks[i];
                    kIdx++;
                }
            }
            handRank = ONE_PAIR;
            tiebreaker = (uint256(maxRank) << 192) | (uint256(kickers[0]) << 184) |
                        (uint256(kickers[1]) << 176) | (uint256(kickers[2]) << 168);
        } else {
            // High card
            handRank = HIGH_CARD;
            tiebreaker = (uint256(ranks[0]) << 192) | (uint256(ranks[1]) << 184) |
                        (uint256(ranks[2]) << 176) | (uint256(ranks[3]) << 168) |
                        (uint256(ranks[4]) << 160);
        }

        return (uint256(handRank) << 200) | tiebreaker;
    }

    /// @notice Check if sorted ranks form a straight
    function _isStraight(uint8[5] memory ranks) internal pure returns (bool) {
        // Ranks are already sorted descending
        if (ranks[0] == ranks[1] + 1 && ranks[1] == ranks[2] + 1 &&
            ranks[2] == ranks[3] + 1 && ranks[3] == ranks[4] + 1) {
            return true;
        }
        return false;
    }

    /// @notice Get hand rank name from score
    function getHandName(uint256 score) internal pure returns (string memory) {
        uint8 handRank = uint8(score >> 200);
        if (handRank == ROYAL_FLUSH) return "Royal Flush";
        if (handRank == STRAIGHT_FLUSH) return "Straight Flush";
        if (handRank == FOUR_OF_A_KIND) return "Four of a Kind";
        if (handRank == FULL_HOUSE) return "Full House";
        if (handRank == FLUSH) return "Flush";
        if (handRank == STRAIGHT) return "Straight";
        if (handRank == THREE_OF_A_KIND) return "Three of a Kind";
        if (handRank == TWO_PAIR) return "Two Pair";
        if (handRank == ONE_PAIR) return "One Pair";
        return "High Card";
    }
}
