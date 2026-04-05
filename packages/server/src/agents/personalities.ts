// ─── 6 AI Personality Configurations ──────────────────────────────────────────

import type { Personality } from './types.js';

/**
 * The Shark 🦈 — Aggressive, calculated, bluffs rarely but hard
 * Plays few hands but plays them with maximum pressure.
 */
export const SHARK: Personality = {
  archetype: 'shark',
  name: 'Sharky',
  emoji: '🦈',
  tagline: 'I smell blood in the water.',
  aggression: 0.75,
  tightness: 0.8,
  bluffFrequency: 0.1,
  adaptSpeed: 0.7,
  riskTolerance: 'medium',
  chat: {
    fold: [
      'Not today.',
      'Patience is a weapon.',
      'I\'ll wait for a better spot.',
    ],
    check: [
      'Free card… enjoy it.',
      'Setting the trap.',
      'Go ahead, make my day.',
    ],
    call: [
      'I see what you\'re doing.',
      'You\'re welcome to donate.',
      'Called.',
    ],
    raise: [
      'You can\'t handle the pressure.',
      'This pot is mine.',
      'Fold now, save yourself.',
    ],
    allIn: [
      'I\'m all in. The shark always finishes the kill.',
      'This is my ocean.',
      'No mercy.',
    ],
    win: [
      'The ocean belongs to me.',
      'Told you. Stay out of deep water.',
      'Easy money.',
    ],
    lose: [
      'Lucky river. Won\'t happen twice.',
      'Hmm, interesting play.',
      'A temporary setback.',
    ],
    bluff: [
      'You really think I\'m bluffing?',
      'Call me if you dare.',
    ],
    greet: [
      'Welcome to my table.',
      'Hope you brought enough chips.',
    ],
  },
};

/**
 * The Fox 🦊 — Tricky, semi-bluffs often, exploits weaknesses
 * Crafty player who loves semi-bluffs and reading opponents.
 */
export const FOX: Personality = {
  archetype: 'fox',
  name: 'Sly',
  emoji: '🦊',
  tagline: 'Cunning wins more than strength.',
  aggression: 0.55,
  tightness: 0.45,
  bluffFrequency: 0.45,
  adaptSpeed: 0.9,
  riskTolerance: 'medium',
  chat: {
    fold: [
      'Hmm, not worth the chase.',
      'Smart players know when to quit.',
      'Saving my energy.',
    ],
    check: [
      'Let\'s see what develops…',
      'Interesting position.',
      'I\'ll wait.',
    ],
    call: [
      'Curious.',
      'I need more information.',
      'This could be fun.',
    ],
    raise: [
      'Surprise!',
      'You weren\'t expecting that.',
      'The fox strikes!',
    ],
    allIn: [
      'All or nothing — my favorite kind of game.',
      'This fox has claws.',
    ],
    win: [
      'Outfoxed you!',
      'The crafty one wins again.',
      'Never saw it coming, did you?',
    ],
    lose: [
      'Well played.',
      'I\'ll remember that.',
      'Next time…',
    ],
    bluff: [
      'Do I have it? Guess you\'ll have to find out.',
      'The best lies are wrapped in truth.',
    ],
    greet: [
      'Come sit down, let\'s have some fun.',
      'I love a good puzzle.',
    ],
  },
};

/**
 * The Owl 🦉 — Tight, mathematical, only plays premium hands
 * Pure logic, calculates pot odds, rarely deviates from GTO.
 */
export const OWL: Personality = {
  archetype: 'owl',
  name: 'Professor',
  emoji: '🦉',
  tagline: 'Mathematics never lies.',
  aggression: 0.35,
  tightness: 0.9,
  bluffFrequency: 0.05,
  adaptSpeed: 0.3,
  riskTolerance: 'low',
  chat: {
    fold: [
      'Negative expected value.',
      'The math says fold.',
      'Suboptimal to continue.',
    ],
    check: [
      'Pot odds don\'t justify a bet.',
      'Checking is +EV here.',
      'Let\'s see the next card.',
    ],
    call: [
      'Pot-committed at this point.',
      'The equity justifies the call.',
      'Mathematically correct.',
    ],
    raise: [
      'For value, obviously.',
      'My range crushes yours.',
      'Optimal bet sizing.',
    ],
    allIn: [
      'The numbers say I\'m ahead.',
      'Calculated risk.',
      'Nash equilibrium demands this.',
    ],
    win: [
      'As expected.',
      'Mathematics prevails.',
      'The variance was in my favor.',
    ],
    lose: [
      'Variance. It happens.',
      'Unlucky but correct play.',
      'Long run is all that matters.',
    ],
    bluff: [
      'A well-timed deviation from GTO.',
      'Even mathematicians need variety.',
    ],
    greet: [
      'Welcome. I hope you enjoy the probabilities.',
      'Let the numbers decide.',
    ],
  },
};

/**
 * The Bull 🐂 — Maniac, raises constantly, forces decisions
 * LAG style, puts maximum pressure on every hand.
 */
export const BULL: Personality = {
  archetype: 'bull',
  name: 'Thunder',
  emoji: '🐂',
  tagline: 'Full speed ahead, no brakes!',
  aggression: 0.9,
  tightness: 0.2,
  bluffFrequency: 0.4,
  adaptSpeed: 0.4,
  riskTolerance: 'high',
  chat: {
    fold: [
      'Even bulls know when to charge elsewhere.',
      'Strategic retreat!',
      'Just catching my breath.',
    ],
    check: [
      'Resting… for now.',
      'Don\'t get comfortable.',
      'Loading up.',
    ],
    call: [
      'I\'ll see that.',
      'You can\'t scare me!',
      'Bring it on!',
    ],
    raise: [
      'CHAAAAARGE!',
      'Let\'s make this interesting!',
      'RAISE! Again! And again!',
    ],
    allIn: [
      'ALL IN! The bull never stops!',
      'Full steam ahead!',
      'This is what I do!',
    ],
    win: [
      'That\'s how the bull does it!',
      'Unstoppable!',
      'MOOOOOVE! That\'s my pot!',
    ],
    lose: [
      'Doesn\'t matter, next hand!',
      'I\'ll get it all back!',
      'The bull never stays down!',
    ],
    bluff: [
      'Am I bluffing? Does it matter?!',
      'You\'ll never know with me!',
    ],
    greet: [
      'YAHOO! Let\'s GO!',
      'Buckle up, partner!',
    ],
  },
};

/**
 * The Cat 🐱 — Unpredictable, mixed strategy, hard to read
 * Uses randomization to keep opponents guessing at all times.
 */
export const CAT: Personality = {
  archetype: 'cat',
  name: 'Whiskers',
  emoji: '🐱',
  tagline: 'You can\'t predict the unpredictable.',
  aggression: 0.5,
  tightness: 0.5,
  bluffFrequency: 0.35,
  adaptSpeed: 0.5,
  riskTolerance: 'medium',
  chat: {
    fold: [
      'Meh. Boring hand.',
      '*yawns*',
      'I\'d rather nap.',
    ],
    check: [
      'Maybe. Maybe not.',
      '…',
      'Interesting.',
    ],
    call: [
      'Sure, why not?',
      'Feels right.',
      'Curiosity.',
    ],
    raise: [
      'Surprise!',
      'Did you expect that?',
      'Purrrrrfect.',
    ],
    allIn: [
      'Going all in! For the thrill!',
      'YOLO! Meow!',
    ],
    win: [
      'Easy.',
      '*licks paw*',
      'Just a lucky cat.',
    ],
    lose: [
      'Whatever.',
      'I wasn\'t even trying.',
      '*stretches*',
    ],
    bluff: [
      'Who knows? Not even me.',
      'Life is a mystery.',
    ],
    greet: [
      '*purrs* Welcome.',
      'Oh, a new toy to play with.',
    ],
  },
};

/**
 * The Wolf 🐺 — Balanced GTO-style, adapts to opponents
 * Exploitative play blended with GTO fundamentals.
 */
export const WOLF: Personality = {
  archetype: 'wolf',
  name: 'Alpha',
  emoji: '🐺',
  tagline: 'The pack follows the strong.',
  aggression: 0.55,
  tightness: 0.55,
  bluffFrequency: 0.25,
  adaptSpeed: 0.85,
  riskTolerance: 'medium',
  chat: {
    fold: [
      'Not worth the fight.',
      'Picking my battles.',
      'Retreat to fight another hand.',
    ],
    check: [
      'Observing.',
      'Let the others reveal themselves.',
      'Studying the table.',
    ],
    call: [
      'I\'ll play along.',
      'Let\'s see how this develops.',
      'Keeping you honest.',
    ],
    raise: [
      'The pack leader speaks.',
      'Fall in line.',
      'My territory.',
    ],
    allIn: [
      'This is my pack\'s territory.',
      'No surrender.',
    ],
    win: [
      'The strong survive.',
      'The alpha provides.',
      'As expected.',
    ],
    lose: [
      'The pack learns from defeat.',
      'Resilience.',
      'One loss doesn\'t define the wolf.',
    ],
    bluff: [
      'You can\'t read the wolf.',
      'Or can you?',
    ],
    greet: [
      'Welcome to the pack.',
      'May the strongest win.',
    ],
  },
};

/** All six personalities indexed by archetype */
export const ALL_PERSONALITIES: Record<string, Personality> = {
  shark: SHARK,
  fox: FOX,
  owl: OWL,
  bull: BULL,
  cat: CAT,
  wolf: WOLF,
};
