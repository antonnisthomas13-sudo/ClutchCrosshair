---
name: ClutchCrosshair
description: CS2 pro crosshair codes, presented as Major broadcast player spotlights, in charcoal, deep grey and a signature red.
colors:
  stat-black: "#08090A"
  booth-charcoal: "#0C0D0F"
  charcoal: "#111214"
  deep-grey: "#1B1D21"
  field-grey: "#24272C"
  seam: "#30343A"
  paper: "#ECEDEF"
  steel: "#9DA2AA"
  stat-label: "#C9CCD1"
  signature-red: "#D7262F"
  signature-red-hover: "#B51C25"
  signature-red-pressed: "#9C1820"
  red-link: "#FF5C63"
  white: "#FFFFFF"
  photo-plate: "rgba(0, 0, 0, 0.18)"
  light-ground: "#F3F4F6"
  light-panel: "#FFFFFF"
  light-field: "#EDEFF2"
  light-seam: "#D9DCE1"
  light-ink: "#15171A"
  light-steel: "#575D66"
  light-red: "#C8202A"
  brand-discord: "#5865F2"
  brand-tiktok-cyan: "#25F4EE"
  brand-tiktok-pink: "#FE2C55"
  team-spirit: "#8E98A8"
  team-vitality: "#F5D547"
  team-mouz: "#E8505B"
  team-furia: "#222329"
  team-falcons: "#2ECC71"
  team-aurora: "#8E7CF0"
  team-navi: "#FFD400"
  team-g2: "#ECEEF2"
  team-faze: "#E2394A"
  team-astralis: "#FF4655"
  team-legacy: "#4FA3FF"
  team-mibr: "#3D7BFF"
  team-fut: "#9AE66E"
  team-parivision: "#C084FC"
  team-betboom: "#FF8A3D"
  team-creator: "#A78BFA"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.01em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
  subtitle:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  ui:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
  ui-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  label-caps:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.06em"
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  none: "0px"
  fine: "1px"
  hard: "2px"
  arch-sm: "38px"
  arch-md: "60px"
  arch-lg: "64px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "32px"
  xl: "40px"
components:
  button-copy:
    backgroundColor: "{colors.signature-red}"
    textColor: "{colors.white}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.none}"
    padding: "9px 16px"
  button-copy-hover:
    backgroundColor: "{colors.signature-red-hover}"
  button-copy-pressed:
    backgroundColor: "{colors.signature-red-pressed}"
  button-secondary:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.paper}"
    typography: "{typography.ui-sm}"
    padding: "9px 16px"
  quick-access:
    backgroundColor: "{colors.deep-grey}"
    textColor: "{colors.paper}"
    typography: "{typography.ui}"
    rounded: "{rounded.hard}"
    padding: "12px 14px"
  tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.charcoal}"
    typography: "{typography.ui}"
    rounded: "{rounded.hard}"
  card:
    backgroundColor: "{colors.deep-grey}"
    rounded: "{rounded.hard}"
  field-row:
    backgroundColor: "{colors.field-grey}"
    textColor: "{colors.paper}"
    typography: "{typography.code}"
    rounded: "{rounded.hard}"
  search-input:
    backgroundColor: "{colors.deep-grey}"
    textColor: "{colors.paper}"
    rounded: "{rounded.hard}"
    height: "52px"
---

# Design System: ClutchCrosshair

## Overview

**Creative North Star: "The Broadcast Booth"**

ClutchCrosshair looks like the graphics package of a CS Major broadcast, applied to a working tool. Every pro is a player spotlight: a slab in the team's own colour, with a condensed uppercase name and a photo cut-out. The crosshair sits underneath like the on-screen stat, and a red Copy tab is the one action that matters.

The palette is restrained:
- charcoal for the ground (about 70% of the screen);
- deep grey for cards and panels (about 25%);
- one signature red for buttons, selection and interaction (about 5%).

Yellow is not an interface colour. It appears only where a team's own colour is yellow.

The type is split in three. A condensed sporty face, Barlow Condensed, carries only the headings and the player names, which keeps the esports identity. Inter carries everything you read or click, so the interface feels professional. JetBrains Mono carries the codes and commands.

The home page opens on a compact navigation, a strong title ("Find your perfect CS2 crosshair"), a large search bar, three quick-access tiles (Pros, Creators, Trending), and then the grid. There is no marketing banner and no decorative motion.

**Key Characteristics:**
- Team-colour slabs with chamfered corners as the identity of every player.
- Charcoal 70%, deep grey 25%, signature red 5%; yellow only from teams.
- Condensed display type for headings only; Inter for the interface; mono for codes.
- Flat panels divided by 1px seams; no glows, no gradient text.
- The crosshair preview is always drawn at true in-game size.

## Colors

Charcoal and deep grey everywhere, one signature red for what you can act on.

### Primary
- **Signature Red** (`signature-red`) fills the Copy buttons, the COPIED wipe and text selection, always with white text. It also draws the thin lines: the rule under the navigation and page headers, the active-tab bar, keyboard focus rings, the section-title marker, the selected-team edge, the Contact outline and the quick-access icons.
- **Red Hover** (`signature-red-hover`) and **Red Pressed** (`signature-red-pressed`) are its states. They go darker, so white text stays legible.
- **Red Link** (`red-link`) is for text links on dark.
- In light mode, the red becomes `light-red` and links use `signature-red-hover`.

### Neutral
- **Charcoal** (`charcoal`): page ground.
- **Booth Charcoal** (`booth-charcoal`): the team rail, the navigation and page headers.
- **Deep Grey** (`deep-grey`): cards, panels, the search bar, the quick-access tiles.
- **Field Grey** (`field-grey`): code rows and hovers.
- **Stat Black** (`stat-black`): behind the crosshair preview, in both modes.
- **Seam** (`seam`): every 1px divider.
- **Paper** (`paper`): primary text; the active tab and the active game are drawn in it.
- **Steel** (`steel`): secondary text.
- **Stat Label** (`stat-label`): the small "Crosshair" chip on the dark stat box.
- **Light mode** uses `light-ground`, `light-panel`, `light-field`, `light-seam`, `light-ink` and `light-steel`.

### Team colours
Each team has one colour (`team-*`), used only to fill its slab. The text on a slab is near-black or white, picked by luminance.

### Named Rules
**The Five Percent Rule.** Red covers roughly 5% of any screen: actions, the selection and thin interaction lines. It is never a large fill and never decoration.

**The No Second Accent Rule.** There is no second interface accent. Yellow, green and cyan belong to teams and crosshairs.

**The Brand Marks Rule.** Social icons always show their official colours: Discord in `brand-discord`, TikTok white (black in light mode) with its cyan and pink offset, X white (black in light mode).

**The Variables Only Rule.** Every colour, family, size, weight and line height comes from a CSS variable on `:root` or `body.light`. Nothing is hard-coded inside a component.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, sans-serif)
**Body Font:** Inter (with system-ui)
**Label/Mono Font:** JetBrains Mono, for share codes, console commands and match dates

**Character:** A sporty condensed face for headlines only, over a calm, very legible sans for everything you read or click.

### Hierarchy
- **Display** (700, 48px, 1.1; 32px on phones): the home H1 "Find your perfect CS2 crosshair". Sentence case.
- **Headline** (700, 32px, 1): player names inside the slabs, in the modal and on player pages. Uppercase, like broadcast names. Player-page titles use 48px.
- **Title** (700, 24px, 1.1): section titles. Sentence case.
- **UI** (600, 13–15px, 1.3): tabs, buttons, team names, the rail, quick-access tiles, navigation. Normal case.
- **Body** (400, 15px, 1.55): subtitles, about text and FAQ, at most 75ch.
- **Label Caps** (600, 11px, 0.06em tracking, uppercase): small field labels such as "Share code", the "Crosshair" chip, spec labels and the rail title.
- **Code** (400, 12px): share codes and console commands.

### Named Rules
**The Headlines Only Rule.** The condensed face is only for headings and player names. Controls, labels and text are always Inter.

## Layout

The skeleton stays the same. A 248px sticky team rail sits on the left; the content column holds:
1. The compact navigation (36px controls).
2. The hero: H1, subtitle, a 52px search bar at most 640px wide, then three quick-access tiles in a row.
3. The tab rail with sort.
4. The card grid (`auto-fill, minmax(268px, 1fr)`, 14px gap).

Side padding is 32px (16px on phones). Player, FAQ and legal pages use a single 760px column.

Below 800px:
- The rail unfolds: the logo and teams go on top, and follow and contact move to the bottom of the page.
- The quick-access tiles drop their icons.
- The tab rail scrolls, with a fade on the right.

## Elevation & Depth

Flat by default. Depth comes from tonal steps (booth charcoal, charcoal, deep grey, field grey) and 1px seams. The only shadows are state responses: hovered cards and the modal.

### Named Rules
**The No-Glow Rule.** No halos, glows or gradient text. Depth comes from tone and seams.

## Shapes

Hard corners (2px) everywhere; the Copy tabs are square. The signature silhouette is the chamfer: team slabs, the modal band and player-page headers cut their bottom-right corner at 45°. Photos sit on an arch plate (`photo-plate`, with `arch-sm`, `arch-md` or `arch-lg`).

## Components

### Buttons
- **Copy (primary):** Signature Red, white Inter 600 13px, square.
- **States:** darker red on hover, darker again when pressed, and a 1px press-down. Focus is a 2px red ring.
- **Console Copy (secondary):** Charcoal with a left seam. It inverts to Paper on hover.

### Quick-access tiles
- **Style:** Deep Grey, 1px seam, hard corners. Each tile holds a red icon, a name and a live count in Steel ("70 pro players").
- **Hover:** the border turns red.
- **Click:** opens the matching tab and scrolls to the grid.

### Cards / Containers
- **Style:** Deep Grey; the slab is in the team colour with a faint inner rim.
- **Hover:** the card lifts 2px and its border takes the team colour.
- **Spacing:** 16px padding on the sides, 10px between blocks.

### Inputs / Fields
- **Hero search:** Deep Grey, 52px high, with a magnifier icon. Its border turns red on focus.

### Navigation
- **Compact bar:** CS2/Valorant switch, FAQ, language and theme.
- **Team rail:** Inter, with the team logos.
- **Tabs:** Inter 600. The active tab is a Paper block with a 3px red bar under it.

### Player Spotlight Card (signature)
From top to bottom:
1. The team slab: the name and the photo cut-out.
2. A meta line: team, then the date in mono.
3. The stat box: a grey "Crosshair" chip over a true-size preview, on a dimmed Nuke plate.
4. The share-code row with its Copy tab.
5. The console row with its Copy tab.

### Copy Wipe (signature motion)
- A red bar reading "COPIED" sweeps across the code row in about 220ms, holds, then leaves.
- It is off under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** keep red at about 5% of the screen: actions, selection, thin interaction lines.
- **Do** use the condensed face only for headings and player names.
- **Do** read every colour and type setting from a CSS variable.
- **Do** draw the crosshair preview at true in-game size.

### Don't:
- **Don't** reintroduce yellow or amber as an interface accent.
- **Don't** add a marketing banner, a long slogan or decorative motion to the home hero.
- **Don't** add a kicker or eyebrow above a heading.
- **Don't** use glows, gradient text or glassmorphism.
