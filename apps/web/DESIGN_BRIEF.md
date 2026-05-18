# 🃏 AI Poker Night — Design Brief v2.0

## Research Summary

### Inspiration Sources
- **PokerStars** — Industry gold standard. Dark felt tables, clean gold/amber accents, professional typography, ambient glow effects on active elements.
- **ClubGG Poker** — Modern mobile-first design with glassmorphism panels, smooth card dealing animations, rounded avatars with status rings.
- **WSOP App** — Bold red/gold theme, dramatic lighting, cinematic feel with particle effects.
- **Dribbble/Behance Poker UI** — Trend toward minimal dark UIs with neon accents, frosted glass panels, subtle gradient backgrounds, micro-animations.
- **Neon Glassmorphism (GitHub: digitalisstudios/neon-glass)** — Combines glassmorphism with vibrant neon glows for cyberpunk aesthetic.
- **CSS Glassmorphism Generator (ui.glass)** — Frosted glass panels with blur, rgba backgrounds, subtle borders.
- **Web3 Poker dApps (CoinPoker, Polker)** — Blockchain badges, encryption indicators, wallet connection UX, live stats dashboards.
- **Framer Motion examples (motion.dev)** — Smooth card transitions, spring animations, layout animations for dealing effects.

### Key Design Trends for Gaming UI (2024-2025)
1. **Deep dark backgrounds** (#0a0a0f to #0f1117) with subtle noise textures
2. **Neon accent colors** — emerald green, electric blue, warm amber/gold
3. **Glassmorphism panels** — backdrop-blur, semi-transparent backgrounds, subtle border glow
4. **Micro-animations** — spring-based motion, staggered reveals, hover states
5. **Gradient mesh backgrounds** — Subtle ambient color zones, not flat
6. **Card design** — Clean white cards with drop shadows, suit colors, crisp typography
7. **3D chip stacks** — Layered circles with edge shadows, perspective transforms
8. **Personality-driven avatars** — Gradient ring colors, emoji + status indicators

---

## Color Palette

### Core Backgrounds
| Token | Hex | Usage |
|-------|-----|-------|
| `poker-void` | `#06060c` | Deepest background, outer page |
| `poker-dark` | `#0b0e18` | Main background |
| `poker-surface` | `#111628` | Elevated surfaces, cards |
| `poker-elevated` | `#1a1f36` | Panels, modals |
| `poker-border` | `rgba(255,255,255,0.06)` | Default borders |

### Accent Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `poker-gold` | `#fbbf24` | Primary accent (pots, highlights, CTAs) |
| `poker-gold-dim` | `#b8860b` | Dimmed gold, borders |
| `poker-emerald` | `#34d399` | Success, check, positive actions |
| `poker-crimson` | `#f43f5e` | Danger, fold, all-in alerts |
| `poker-royal` | `#818cf8` | Info, encryption badge, join |
| `poker-violet` | `#a78bfa` | Bluffer personality, purple accent |

### Table Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `poker-felt` | `#0f5132` | Felt base color |
| `poker-felt-light` | `#198754` | Felt highlight |
| `poker-felt-dark` | `#0a3622` | Felt shadow |
| `poker-wood` | `#3d2b1f` | Table rim |
| `poker-wood-light` | `#5c3d2e` | Table rim highlight |

### Text Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `poker-text` | `#e2e8f0` | Primary text |
| `poker-text-dim` | `#94a3b8` | Secondary text |
| `poker-text-muted` | `#475569` | Tertiary/disabled text |
| `poker-card-red` | `#dc2626` | Hearts, Diamonds |
| `poker-card-black` | `#f8fafc` | Spades, Clubs |

---

## Typography

### Font Stack
- **Display**: `Inter` (Google Fonts) — Clean, modern sans-serif for all UI text
- **Monospace**: `JetBrains Mono` — For chip amounts, pot values, stats
- **Card Faces**: System serif fallback for card rank/suit display

### Scale
| Element | Size | Weight |
|---------|------|--------|
| App Title | 20px | 700 (Inter) |
| Phase Badge | 11px | 600 (Inter, uppercase) |
| Agent Name | 12px | 600 (Inter) |
| Chip Amount | 12px | 700 (JetBrains Mono) |
| Card Rank | 14px | 700 (serif fallback) |
| Card Suit | 22px | 400 |
| Pot Value | 16px | 700 (JetBrains Mono) |
| Button Text | 13px | 600 (Inter) |
| Stats Label | 10px | 500 (Inter) |

---

## Key Visual Effects

### 1. Card Dealing Animation (Framer Motion)
- Cards fly from center of table to each player's position
- Spring physics: `stiffness: 300, damping: 20`
- Slight rotation during flight (-10deg to 10deg)
- Scale up from 0.5 to 1.0
- Staggered delay: 0.1s between each card
- Hover: slight lift (translateY: -4px) with shadow increase

### 2. Card Flip Animation
- 3D flip on Y-axis (rotateY 0 → 180)
- Front face hidden during flip
- 0.6s duration with easeInOut

### 3. Chip Stack (CSS)
- 3-4 layered circles offset by 2px top
- Subtle box-shadow for 3D depth
- Color-coded by agent personality
- Amount displayed in monospace beside

### 4. Table Felt Texture
- Radial gradient for depth
- SVG noise filter overlay (opacity 0.04)
- Subtle inner shadow for rim effect
- Wood grain border via gradient

### 5. Gold Glow Effect
- Active elements pulse with gold box-shadow
- `box-shadow: 0 0 20px rgba(251, 191, 36, 0.3)`
- Animation: 2s ease-in-out infinite

### 6. Glassmorphism Panels
- `backdrop-filter: blur(16px)`
- `background: rgba(17, 22, 40, 0.6)`
- `border: 1px solid rgba(255, 255, 255, 0.08)`
- Subtle hover glow on interactive elements

### 7. Encryption Shield Badge
- Small shield icon with lock
- Emerald green glow: `box-shadow: 0 0 12px rgba(52, 211, 153, 0.3)`
- Pulse animation when active

### 8. Agent Thinking Animation
- Three bouncing dots with staggered animation
- Emoji reaction overlay on action (🤔 → 😎 → 😤 etc.)

### 9. Background Ambient Glow
- Two gradient blobs (position: fixed) with slow drift animation
- Emerald blob (top-left) and violet blob (bottom-right)
- opacity: 0.15, blur: 120px

---

## Component-by-Component Redesign

### Layout (`layout.tsx`)
- Add Inter font import
- Body: `bg-poker-void` with subtle noise texture
- Gradient mesh background blobs (fixed position)
- Anti-aliased text rendering

### Header
- Glassmorphism bar: `bg-poker-surface/60 backdrop-blur-xl`
- Logo: Gold gradient square with playing card emoji
- Connection status: Animated dot (green = live, amber = demo)
- Encryption shield badge (right side)
- Subtle bottom border glow

### PokerTable
- Larger responsive table (w-[340px] → w-[700px] on xl)
- Elliptical felt with SVG noise texture
- Wood-style rim border (8px gradient)
- Inner glow on the felt
- Ambient light effect from center

### AgentAvatar
- 56px circle with gradient border matching personality color
- Background: dark glass effect
- Emoji centered, 28px
- Thinking dots: gold bouncing dots
- Dealer chip: small gold circle with "D"
- Status ring: glowing border when acting, dimmed when folded
- Chat bubble: glassmorphism with arrow, personality color accent

### Card
- Face-down: Deep blue gradient with geometric pattern
- Face-up: White/off-white with rounded corners (8px)
- Suit colors: red for hearts/diamonds, near-white for spades/clubs
- Subtle shadow: `0 4px 12px rgba(0,0,0,0.3)`
- Hover: lift + shadow increase
- Dealing animation: spring from center

### ChipStack
- 3 stacked circles with 2px offset
- Rounded edges with white border (10% opacity)
- Drop shadow for depth
- Amount in monospace font

### CommunityCards
- Centered in table
- Empty slots: dashed border with subtle glow
- Cards animate in sequentially with spring physics

### PotDisplay
- Glassmorphism pill shape
- Gold glow pulse
- Chip icon (Lucide) + amount
- Current bet shown below in smaller text

### GameControls
- Glassmorphism control bar
- Fold: crimson/red tint
- Check: emerald/green tint
- Call: emerald/green tint
- Raise: gold tint with range slider
- All-in: crimson with pulse effect
- Buttons: 44px height, rounded-xl, icon + text

### FaucetPanel
- Purple/violet tinted glass button
- Water drop icon (Lucide)
- Success/error states with color coding

### JoinPanel
- Glassmorphism input field
- Gold border on focus
- Join button with gold gradient

### AgentStats (Leaderboard)
- Horizontal scrollable on mobile, grid on desktop
- Each stat card: glassmorphism with personality color accent line
- Rank number, emoji, name, win rate, chip count
- Tip button: subtle gold accent
- Leader highlighted with gold border glow

### Footer
- Subtle glass effect
- Minimal text, dimmed
- Tech stack badges

### 404 Page
- Full-screen dramatic card back pattern
- "Hand Not Found" with gold accent
- Back button with hover glow

---

## Reference Links

- [Dribbble Poker UI](https://dribbble.com/tags/poker-ui)
- [Dribbble Poker Table](https://dribbble.com/tags/poker-table)
- [Dribbble Card Game UI](https://dribbble.com/tags/card-game-ui)
- [Behance Poker UI Design](https://www.behance.net/search/projects/poker+ui+design+game)
- [Framer Motion Examples](https://motion.dev/examples)
- [CSS Glassmorphism Generator](https://ui.glass/generator)
- [Neon Glassmorphism Theme](https://github.com/digitalisstudios/neon-glass)
- [Glow & Glass Effects in Dark Websites](https://www.designsystemscollective.com/building-glow-and-glass-ui-components-in-dark-themes-css-examples-ae402ade54d2)
- [Poker Chip CSS (CodePen)](https://codepen.io/yakovd33/pen/jbbbPM)
- [Card Stack Framer Motion (CodeSandbox)](https://codesandbox.io/s/card-stack-framer-motion-e0v68)
- [React Poker Library](https://github.com/therewillbecode/react-poker)
- [Bitcoin Poker UI Design](https://www.3upgaming.com/blog/why-bitcoin-poker-ui-wins-big-in-2025/)
