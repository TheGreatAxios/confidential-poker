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

    /// @dev Intermediate evaluation state stored in memory to avoid stack-too-deep.
    ///      All local variables that would otherwise consume EVM stack slots are
    ///      packed into this struct so only a single memory pointer is needed.
    struct EvalState {
        uint8[5] ranks;
        uint8[5] suits;
        uint8[15] counts;
        bool isFlush;
        bool isStraight;
        uint8 maxCount;
        uint8 secondCount;
        uint8 maxRank;
        uint8 secondRank;
    }

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
            for (uint256 i = 0; i < 6; i++) {
                uint8[5] memory five;
                uint256 idx = 0;
                for (uint256 j = 0; j < 6; j++) {
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
            for (uint256 i = 0; i < 7; i++) {
                for (uint256 j = i + 1; j < 7; j++) {
                    uint8[5] memory five;
                    uint256 idx = 0;
                    for (uint256 k = 0; k < 7; k++) {
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
        for (uint256 i = 0; i < 5; i++) {
            five[i] = cards[i];
        }
        return _score5Fixed(five);
    }

    /// @notice Score exactly 5 cards (fixed-size array for efficiency)
    /// @dev Uses EvalState struct to keep all intermediates in memory,
    ///      avoiding "Stack too deep" without needing via_ir compilation.
    function _score5Fixed(uint8[5] memory cards) internal pure returns (uint256) {
        EvalState memory s;

        // Extract ranks and suits
        for (uint256 i = 0; i < 5; i++) {
            s.ranks[i] = getRank(cards[i]);
            s.suits[i] = getSuit(cards[i]);
        }

        // Sort ranks descending (bubble sort for 5 elements)
        _sortRanks(s.ranks);

        // Flush check
        s.isFlush =
            (s.suits[0] == s.suits[1] && s.suits[1] == s.suits[2] && s.suits[2] == s.suits[3] && s.suits[3] == s.suits[4]);

        // Straight check
        s.isStraight = _checkStraight(s.ranks);

        // Check for wheel (A-2-3-4-5): ranks are 14,5,4,3,2
        bool isWheel = !s.isStraight && s.ranks[0] == 14 && s.ranks[1] == 5 && s.ranks[2] == 4 && s.ranks[3] == 3
            && s.ranks[4] == 2;
        if (isWheel) s.isStraight = true;

        // Count rank frequencies and find top groups
        _countFrequencies(s.ranks, s.counts);

        _findTopGroups(s.counts, s);

        // Determine hand rank and build score
        return _buildScore(s, isWheel);
    }

    /// @dev Sort ranks array in descending order using bubble sort
    function _sortRanks(uint8[5] memory ranks) internal pure {
        for (uint256 i = 0; i < 4; i++) {
            for (uint256 j = 0; j < 4 - i; j++) {
                if (ranks[j] < ranks[j + 1]) {
                    (ranks[j], ranks[j + 1]) = (ranks[j + 1], ranks[j]);
                }
            }
        }
    }

    /// @dev Check if sorted descending ranks form a straight
    function _checkStraight(uint8[5] memory ranks) internal pure returns (bool) {
        if (
            ranks[0] == ranks[1] + 1 && ranks[1] == ranks[2] + 1 && ranks[2] == ranks[3] + 1
                && ranks[3] == ranks[4] + 1
        ) {
            return true;
        }
        return false;
    }

    /// @dev Count frequency of each rank
    function _countFrequencies(uint8[5] memory ranks, uint8[15] memory counts) internal pure {
        for (uint256 i = 0; i < 5; i++) {
            counts[ranks[i]]++;
        }
    }

    /// @dev Find the top two groups by frequency
    function _findTopGroups(uint8[15] memory counts, EvalState memory s) internal pure {
        for (uint256 r = 2; r <= 14; r++) {
            if (counts[r] > s.maxCount) {
                s.secondCount = s.maxCount;
                s.secondRank = s.maxRank;
                s.maxCount = counts[r];
                s.maxRank = uint8(r);
            } else if (counts[r] > s.secondCount) {
                s.secondCount = counts[r];
                s.secondRank = uint8(r);
            }
        }
    }

    /// @dev Build final score from evaluation state
    function _buildScore(EvalState memory s, bool isWheel) internal pure returns (uint256) {
        uint8 handRank;
        uint256 tiebreaker;

        if (s.isFlush && s.isStraight) {
            if (s.ranks[0] == 14 && s.ranks[1] == 13) {
                handRank = ROYAL_FLUSH;
                tiebreaker = 0;
            } else {
                handRank = STRAIGHT_FLUSH;
                tiebreaker = uint256(isWheel ? 5 : s.ranks[0]) << 192;
            }
        } else if (s.maxCount == 4) {
            handRank = FOUR_OF_A_KIND;
            tiebreaker = (uint256(s.maxRank) << 192) | (uint256(s.secondRank) << 184);
        } else if (s.maxCount == 3 && s.secondCount == 2) {
            handRank = FULL_HOUSE;
            tiebreaker = (uint256(s.maxRank) << 192) | (uint256(s.secondRank) << 184);
        } else if (s.isFlush) {
            handRank = FLUSH;
            tiebreaker = _flushTiebreaker(s.ranks);
        } else if (s.isStraight) {
            handRank = STRAIGHT;
            tiebreaker = uint256(isWheel ? 5 : s.ranks[0]) << 192;
        } else if (s.maxCount == 3) {
            handRank = THREE_OF_A_KIND;
            tiebreaker = _threeOfAKindTiebreaker(s);
        } else if (s.maxCount == 2 && s.secondCount == 2) {
            handRank = TWO_PAIR;
            tiebreaker = _twoPairTiebreaker(s);
        } else if (s.maxCount == 2) {
            handRank = ONE_PAIR;
            tiebreaker = _onePairTiebreaker(s);
        } else {
            handRank = HIGH_CARD;
            tiebreaker = _highCardTiebreaker(s.ranks);
        }

        return (uint256(handRank) << 200) | tiebreaker;
    }

    /// @dev Tiebreaker for flush / high card: all 5 ranks packed
    function _flushTiebreaker(uint8[5] memory ranks) internal pure returns (uint256) {
        return (uint256(ranks[0]) << 192) | (uint256(ranks[1]) << 184) | (uint256(ranks[2]) << 176)
            | (uint256(ranks[3]) << 168) | (uint256(ranks[4]) << 160);
    }

    /// @dev Tiebreaker for high card: all 5 ranks packed
    function _highCardTiebreaker(uint8[5] memory ranks) internal pure returns (uint256) {
        return (uint256(ranks[0]) << 192) | (uint256(ranks[1]) << 184) | (uint256(ranks[2]) << 176)
            | (uint256(ranks[3]) << 168) | (uint256(ranks[4]) << 160);
    }

    /// @dev Tiebreaker for three of a kind: group rank + 2 kickers
    function _threeOfAKindTiebreaker(EvalState memory s) internal pure returns (uint256) {
        uint8 k1;
        uint8 k2;
        for (uint256 i = 0; i < 5; i++) {
            if (s.ranks[i] != s.maxRank) {
                if (k1 == 0) {
                    k1 = s.ranks[i];
                } else {
                    k2 = s.ranks[i];
                }
            }
        }
        return (uint256(s.maxRank) << 192) | (uint256(k1) << 184) | (uint256(k2) << 176);
    }

    /// @dev Tiebreaker for two pair: high pair + low pair + kicker
    function _twoPairTiebreaker(EvalState memory s) internal pure returns (uint256) {
        uint8 highPair = s.maxRank > s.secondRank ? s.maxRank : s.secondRank;
        uint8 lowPair = s.maxRank > s.secondRank ? s.secondRank : s.maxRank;
        uint8 kicker;
        for (uint256 i = 0; i < 5; i++) {
            if (s.ranks[i] != s.maxRank && s.ranks[i] != s.secondRank) {
                kicker = s.ranks[i];
            }
        }
        return (uint256(highPair) << 192) | (uint256(lowPair) << 184) | (uint256(kicker) << 176);
    }

    /// @dev Tiebreaker for one pair: pair rank + 3 kickers
    function _onePairTiebreaker(EvalState memory s) internal pure returns (uint256) {
        uint8 k1;
        uint8 k2;
        uint8 k3;
        for (uint256 i = 0; i < 5; i++) {
            if (s.ranks[i] != s.maxRank) {
                if (k1 == 0) {
                    k1 = s.ranks[i];
                } else if (k2 == 0) {
                    k2 = s.ranks[i];
                } else {
                    k3 = s.ranks[i];
                }
            }
        }
        return (uint256(s.maxRank) << 192) | (uint256(k1) << 184) | (uint256(k2) << 176) | (uint256(k3) << 168);
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
