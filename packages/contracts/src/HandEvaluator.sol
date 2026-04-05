// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

/**
 * @title HandEvaluator
 * @notice Pure library for evaluating Texas Hold'em poker hands.
 *         Cards are encoded as uint8: suit (0-3) in bits 4-5, rank (2-14) in bits 0-3.
 *         Ranks: 2=2 ... 10=10, J=11, Q=12, K=13, A=14
 *         Suits: 0=Clubs, 1=Diamonds, 2=Hearts, 3=Spades
 *
 *         Hand ranks (higher = better):
 *           0 = High Card
 *           1 = One Pair
 *           2 = Two Pair
 *           3 = Three of a Kind
 *           4 = Straight
 *           5 = Flush
 *           6 = Full House
 *           7 = Four of a Kind
 *           8 = Straight Flush (includes Royal Flush)
 */
library HandEvaluator {
    struct EvalResult {
        uint8 handRank;      // 0-8
        uint8 primary;       // highest relevant rank
        uint8 secondary;     // kicker / pair rank
        uint8 tertiary;      // second kicker
        uint8 quaternary;    // third kicker
    }

    uint8 public constant RANK_TWO   = 2;
    uint8 public constant RANK_THREE = 3;
    uint8 public constant RANK_FOUR  = 4;
    uint8 public constant RANK_FIVE  = 5;
    uint8 public constant RANK_SIX   = 6;
    uint8 public constant RANK_SEVEN = 7;
    uint8 public constant RANK_EIGHT = 8;
    uint8 public constant RANK_NINE  = 9;
    uint8 public constant RANK_TEN   = 10;
    uint8 public constant RANK_JACK  = 11;
    uint8 public constant RANK_QUEEN = 12;
    uint8 public constant RANK_KING  = 13;
    uint8 public constant RANK_ACE   = 14;

    uint8 public constant HAND_HIGH_CARD       = 0;
    uint8 public constant HAND_ONE_PAIR        = 1;
    uint8 public constant HAND_TWO_PAIR        = 2;
    uint8 public constant HAND_THREE_OF_A_KIND = 3;
    uint8 public constant HAND_STRAIGHT        = 4;
    uint8 public constant HAND_FLUSH           = 5;
    uint8 public constant HAND_FULL_HOUSE      = 6;
    uint8 public constant HAND_FOUR_OF_A_KIND  = 7;
    uint8 public constant HAND_STRAIGHT_FLUSH  = 8;

    /// @notice Extract rank (2-14) from encoded card
    function rankOf(uint8 card) internal pure returns (uint8) {
        return card & 0x0F;
    }

    /// @notice Extract suit (0-3) from encoded card
    function suitOf(uint8 card) internal pure returns (uint8) {
        return (card >> 4) & 0x03;
    }

    /// @notice Encode a card from rank and suit
    function encodeCard(uint8 rank, uint8 suit) internal pure returns (uint8) {
        return (suit << 4) | (rank & 0x0F);
    }

    /// @notice Evaluate the best 5-card hand from exactly 7 cards (2 hole + 5 community)
    function evaluateHand(uint8[7] memory cards) internal pure returns (EvalResult memory) {
        // Try all C(7,5) = 21 combinations
        EvalResult memory best;
        best.handRank = 0;

        // 21 combinations of 5 cards from 7
        for (uint8 i = 0; i < 7; i++) {
            for (uint8 j = i + 1; j < 7; j++) {
                // Skip indices i and j, take the other 5
                uint8[5] memory five;
                uint8 idx = 0;
                for (uint8 k = 0; k < 7; k++) {
                    if (k != i && k != j) {
                        five[idx++] = cards[k];
                    }
                }
                EvalResult memory cur = _evaluate5(five);
                if (_gt(cur, best)) {
                    best = cur;
                }
            }
        }
        return best;
    }

    /// @notice Evaluate exactly 5 cards
    function _evaluate5(uint8[5] memory cards) internal pure returns (EvalResult memory) {
        // Sort descending by rank
        _sortDesc(cards);

        bool isFlush = _isFlush(cards);
        bool isStraight;
        uint8 straightHigh;

        (isStraight, straightHigh) = _isStraight(cards);

        // Count rank frequencies
        uint8[15] memory counts;
        for (uint8 i = 0; i < 5; i++) {
            counts[rankOf(cards[i])]++;
        }

        // Find groups
        uint8 fourRank = 0;
        uint8 threeRank = 0;
        uint8 pairRank1 = 0;
        uint8 pairRank2 = 0;
        uint8 kickerCount = 0;
        uint8[5] memory kickers;

        // Process from highest rank to lowest
        for (uint8 r = RANK_ACE; r >= RANK_TWO; r--) {
            if (counts[r] == 4) {
                fourRank = r;
            } else if (counts[r] == 3) {
                threeRank = r;
            } else if (counts[r] == 2) {
                if (pairRank1 == 0) {
                    pairRank1 = r;
                } else {
                    pairRank2 = r;
                }
            } else if (counts[r] == 1) {
                kickers[kickerCount++] = r;
            }
        }

        // Straight Flush / Royal Flush
        if (isFlush && isStraight) {
            return EvalResult(HAND_STRAIGHT_FLUSH, straightHigh, 0, 0, 0);
        }

        // Four of a Kind
        if (fourRank != 0) {
            return EvalResult(HAND_FOUR_OF_A_KIND, fourRank, kickers[0], 0, 0);
        }

        // Full House
        if (threeRank != 0 && (pairRank1 != 0 || pairRank2 != 0)) {
            uint8 pairR = pairRank1 != 0 ? pairRank1 : pairRank2;
            return EvalResult(HAND_FULL_HOUSE, threeRank, pairR, 0, 0);
        }

        // Flush
        if (isFlush) {
            return EvalResult(HAND_FLUSH, cards[0], cards[1], cards[2], cards[3]);
        }

        // Straight
        if (isStraight) {
            return EvalResult(HAND_STRAIGHT, straightHigh, 0, 0, 0);
        }

        // Three of a Kind
        if (threeRank != 0) {
            return EvalResult(HAND_THREE_OF_A_KIND, threeRank, kickers[0], kickers[1], 0);
        }

        // Two Pair
        if (pairRank1 != 0 && pairRank2 != 0) {
            uint8 highPair = pairRank1 > pairRank2 ? pairRank1 : pairRank2;
            uint8 lowPair = pairRank1 > pairRank2 ? pairRank2 : pairRank1;
            return EvalResult(HAND_TWO_PAIR, highPair, lowPair, kickers[0], 0);
        }

        // One Pair
        if (pairRank1 != 0) {
            return EvalResult(HAND_ONE_PAIR, pairRank1, kickers[0], kickers[1], kickers[2]);
        }

        // High Card
        return EvalResult(HAND_HIGH_CARD, cards[0], cards[1], cards[2], cards[3]);
    }

    /// @notice Check if all 5 cards have the same suit
    function _isFlush(uint8[5] memory cards) internal pure returns (bool) {
        uint8 s = suitOf(cards[0]);
        return suitOf(cards[1]) == s && suitOf(cards[2]) == s && suitOf(cards[3]) == s && suitOf(cards[4]) == s;
    }

    /// @notice Check if 5 sorted-desc cards form a straight. Returns (isStraight, highCard)
    function _isStraight(uint8[5] memory cards) internal pure returns (bool, uint8) {
        uint8 r0 = rankOf(cards[0]);
        uint8 r1 = rankOf(cards[1]);
        uint8 r2 = rankOf(cards[2]);
        uint8 r3 = rankOf(cards[3]);
        uint8 r4 = rankOf(cards[4]);

        // Normal straight: consecutive descending
        if (r0 == r1 + 1 && r1 == r2 + 1 && r2 == r3 + 1 && r3 == r4 + 1) {
            return (true, r0);
        }

        // Wheel: A-2-3-4-5 (Ace is low, high card is 5)
        if (r0 == RANK_ACE && r1 == RANK_FIVE && r2 == RANK_FOUR && r3 == RANK_THREE && r4 == RANK_TWO) {
            return (true, RANK_FIVE);
        }

        return (false, 0);
    }

    /// @notice Sort 5 cards in descending order by rank (insertion sort)
    function _sortDesc(uint8[5] memory cards) internal pure {
        for (uint8 i = 1; i < 5; i++) {
            uint8 key = cards[i];
            int8 j = int8(i) - 1;
            while (j >= 0 && rankOf(cards[uint8(j)]) < rankOf(key)) {
                cards[uint8(j + 1)] = cards[uint8(j)];
                j--;
            }
            cards[uint8(j + 1)] = key;
        }
    }

    /// @notice Compare two EvalResults. Returns true if a > b.
    function _gt(EvalResult memory a, EvalResult memory b) internal pure returns (bool) {
        if (a.handRank != b.handRank) return a.handRank > b.handRank;
        if (a.primary != b.primary) return a.primary > b.primary;
        if (a.secondary != b.secondary) return a.secondary > b.secondary;
        if (a.tertiary != b.tertiary) return a.tertiary > b.tertiary;
        if (a.quaternary != b.quaternary) return a.quaternary > b.quaternary;
        return false; // equal
    }

    /// @notice Check if a >= b (used for determining winner)
    function gte(EvalResult memory a, EvalResult memory b) internal pure returns (bool) {
        return _gt(a, b) || _eq(a, b);
    }

    function _eq(EvalResult memory a, EvalResult memory b) internal pure returns (bool) {
        return a.handRank == b.handRank &&
               a.primary == b.primary &&
               a.secondary == b.secondary &&
               a.tertiary == b.tertiary &&
               a.quaternary == b.quaternary;
    }

    /// @notice Convenience: encode a card with named suit constants
    function club(uint8 rank) internal pure returns (uint8) { return encodeCard(rank, 0); }
    function diamond(uint8 rank) internal pure returns (uint8) { return encodeCard(rank, 1); }
    function heart(uint8 rank) internal pure returns (uint8) { return encodeCard(rank, 2); }
    function spade(uint8 rank) internal pure returns (uint8) { return encodeCard(rank, 3); }

    /// @notice Get hand rank name as string (for debugging/events)
    function handRankName(uint8 hr) internal pure returns (string memory) {
        if (hr == 0) return "High Card";
        if (hr == 1) return "One Pair";
        if (hr == 2) return "Two Pair";
        if (hr == 3) return "Three of a Kind";
        if (hr == 4) return "Straight";
        if (hr == 5) return "Flush";
        if (hr == 6) return "Full House";
        if (hr == 7) return "Four of a Kind";
        if (hr == 8) return "Straight Flush";
        return "Unknown";
    }
}
