// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

library HandEvaluator {
    struct EvalResult {
        uint8 handRank;
        uint8 primary;
        uint8 secondary;
        uint8 tertiary;
        uint8 quaternary;
        uint8 quinary;
    }

    uint8 public constant RANK_TWO = 2;
    uint8 public constant RANK_THREE = 3;
    uint8 public constant RANK_FOUR = 4;
    uint8 public constant RANK_FIVE = 5;
    uint8 public constant RANK_SIX = 6;
    uint8 public constant RANK_SEVEN = 7;
    uint8 public constant RANK_EIGHT = 8;
    uint8 public constant RANK_NINE = 9;
    uint8 public constant RANK_TEN = 10;
    uint8 public constant RANK_JACK = 11;
    uint8 public constant RANK_QUEEN = 12;
    uint8 public constant RANK_KING = 13;
    uint8 public constant RANK_ACE = 14;

    uint8 public constant HAND_HIGH_CARD = 0;
    uint8 public constant HAND_ONE_PAIR = 1;
    uint8 public constant HAND_TWO_PAIR = 2;
    uint8 public constant HAND_THREE_OF_A_KIND = 3;
    uint8 public constant HAND_STRAIGHT = 4;
    uint8 public constant HAND_FLUSH = 5;
    uint8 public constant HAND_FULL_HOUSE = 6;
    uint8 public constant HAND_FOUR_OF_A_KIND = 7;
    uint8 public constant HAND_STRAIGHT_FLUSH = 8;

    function rankOf(uint8 card) internal pure returns (uint8) {
        return card & 0x0F;
    }

    function suitOf(uint8 card) internal pure returns (uint8) {
        return (card >> 4) & 0x03;
    }

    function encodeCard(uint8 rank, uint8 suit) internal pure returns (uint8) {
        return (suit << 4) | (rank & 0x0F);
    }

    function evaluateHand(uint8[7] memory cards) internal pure returns (EvalResult memory) {
        EvalResult memory best;
        best.handRank = 0;

        for (uint8 i = 0; i < 7; i++) {
            for (uint8 j = i + 1; j < 7; j++) {
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

    function _evaluate5(uint8[5] memory cards) internal pure returns (EvalResult memory) {
        _sortDesc(cards);

        bool isFlush = _isFlush(cards);
        bool isStraight;
        uint8 straightHigh;

        (isStraight, straightHigh) = _isStraight(cards);

        uint8[15] memory counts;
        for (uint8 i = 0; i < 5; i++) {
            counts[rankOf(cards[i])]++;
        }

        uint8 fourRank = 0;
        uint8 threeRank = 0;
        uint8 pairRank1 = 0;
        uint8 pairRank2 = 0;
        uint8 kickerCount = 0;
        uint8[5] memory kickers;

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

        if (isFlush && isStraight) {
            return EvalResult({
                handRank: HAND_STRAIGHT_FLUSH,
                primary: straightHigh,
                secondary: 0,
                tertiary: 0,
                quaternary: 0,
                quinary: 0
            });
        }

        if (fourRank != 0) {
            return EvalResult({
                handRank: HAND_FOUR_OF_A_KIND,
                primary: fourRank,
                secondary: kickers[0],
                tertiary: 0,
                quaternary: 0,
                quinary: 0
            });
        }

        if (threeRank != 0 && (pairRank1 != 0 || pairRank2 != 0)) {
            uint8 pairR = pairRank1 != 0 ? pairRank1 : pairRank2;
            return EvalResult({
                handRank: HAND_FULL_HOUSE,
                primary: threeRank,
                secondary: pairR,
                tertiary: 0,
                quaternary: 0,
                quinary: 0
            });
        }

        if (isFlush) {
            return EvalResult({
                handRank: HAND_FLUSH,
                primary: rankOf(cards[0]),
                secondary: rankOf(cards[1]),
                tertiary: rankOf(cards[2]),
                quaternary: rankOf(cards[3]),
                quinary: rankOf(cards[4])
            });
        }

        if (isStraight) {
            return EvalResult({
                handRank: HAND_STRAIGHT,
                primary: straightHigh,
                secondary: 0,
                tertiary: 0,
                quaternary: 0,
                quinary: 0
            });
        }

        if (threeRank != 0) {
            return EvalResult({
                handRank: HAND_THREE_OF_A_KIND,
                primary: threeRank,
                secondary: kickers[0],
                tertiary: kickers[1],
                quaternary: 0,
                quinary: 0
            });
        }

        if (pairRank1 != 0 && pairRank2 != 0) {
            uint8 highPair = pairRank1 > pairRank2 ? pairRank1 : pairRank2;
            uint8 lowPair = pairRank1 > pairRank2 ? pairRank2 : pairRank1;
            return EvalResult({
                handRank: HAND_TWO_PAIR,
                primary: highPair,
                secondary: lowPair,
                tertiary: kickers[0],
                quaternary: 0,
                quinary: 0
            });
        }

        if (pairRank1 != 0) {
            return EvalResult({
                handRank: HAND_ONE_PAIR,
                primary: pairRank1,
                secondary: kickers[0],
                tertiary: kickers[1],
                quaternary: kickers[2],
                quinary: 0
            });
        }

        return EvalResult({
            handRank: HAND_HIGH_CARD,
            primary: rankOf(cards[0]),
            secondary: rankOf(cards[1]),
            tertiary: rankOf(cards[2]),
            quaternary: rankOf(cards[3]),
            quinary: rankOf(cards[4])
        });
    }

    function _isFlush(uint8[5] memory cards) internal pure returns (bool) {
        uint8 s = suitOf(cards[0]);
        return suitOf(cards[1]) == s && suitOf(cards[2]) == s && suitOf(cards[3]) == s && suitOf(cards[4]) == s;
    }

    function _isStraight(uint8[5] memory cards) internal pure returns (bool, uint8) {
        uint8 r0 = rankOf(cards[0]);
        uint8 r1 = rankOf(cards[1]);
        uint8 r2 = rankOf(cards[2]);
        uint8 r3 = rankOf(cards[3]);
        uint8 r4 = rankOf(cards[4]);

        if (r0 == r1 + 1 && r1 == r2 + 1 && r2 == r3 + 1 && r3 == r4 + 1) {
            return (true, r0);
        }

        if (r0 == RANK_ACE && r1 == RANK_FIVE && r2 == RANK_FOUR && r3 == RANK_THREE && r4 == RANK_TWO) {
            return (true, RANK_FIVE);
        }

        return (false, 0);
    }

    function _sortDesc(uint8[5] memory cards) internal pure {
        for (uint8 i = 1; i < 5; i++) {
            uint8 key = cards[i];
            // forge-lint: disable-next-line(unsafe-typecast) i is uint8 bounded to [1,4], so int8(i) is safe
            int8 j = int8(i) - 1;
            // forge-lint: disable-next-line(unsafe-typecast) j is in [-1,3] — fits uint8
            while (j >= 0 && rankOf(cards[uint8(j)]) < rankOf(key)) {
                // forge-lint: disable-next-line(unsafe-typecast) j is in [-1,3], j+1 in [0,4] — fits uint8
                cards[uint8(j + 1)] = cards[uint8(j)];
                j--;
            }
            // forge-lint: disable-next-line(unsafe-typecast) j is in [-1,3], j+1 in [0,4] — fits uint8
            cards[uint8(j + 1)] = key;
        }
    }

    function _gt(EvalResult memory a, EvalResult memory b) internal pure returns (bool) {
        if (a.handRank != b.handRank) return a.handRank > b.handRank;
        if (a.primary != b.primary) return a.primary > b.primary;
        if (a.secondary != b.secondary) return a.secondary > b.secondary;
        if (a.tertiary != b.tertiary) return a.tertiary > b.tertiary;
        if (a.quaternary != b.quaternary) return a.quaternary > b.quaternary;
        if (a.quinary != b.quinary) return a.quinary > b.quinary;
        return false;
    }

    function gte(EvalResult memory a, EvalResult memory b) internal pure returns (bool) {
        return _gt(a, b) || _eq(a, b);
    }

    function _eq(EvalResult memory a, EvalResult memory b) internal pure returns (bool) {
        return a.handRank == b.handRank && a.primary == b.primary && a.secondary == b.secondary
            && a.tertiary == b.tertiary && a.quaternary == b.quaternary && a.quinary == b.quinary;
    }

    function club(uint8 rank) internal pure returns (uint8) {
        return encodeCard(rank, 0);
    }

    function diamond(uint8 rank) internal pure returns (uint8) {
        return encodeCard(rank, 1);
    }

    function heart(uint8 rank) internal pure returns (uint8) {
        return encodeCard(rank, 2);
    }

    function spade(uint8 rank) internal pure returns (uint8) {
        return encodeCard(rank, 3);
    }

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
