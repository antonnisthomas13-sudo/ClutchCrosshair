# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Competitive CS2 players (and later Valorant players) who want to play with a pro player's or creator's crosshair. Main scene: on a PC, usually in the evening, right before playing, with CS2 open in another window. They search for a pro or a team, look at the crosshair, copy the share code (or the console commands), then alt-tab into the game and import it. Secondary: players discovering crosshairs from TikTok/Discord links on mobile.

## Product Purpose

ClutchCrosshair lists the current CS2 crosshair codes of pro players and content creators. For each player: photo, team, live preview of the crosshair, share code and console commands, each with a one-click Copy. Success = a visitor finds a pro, sees the crosshair, and has the code in their clipboard in seconds, then comes back for the next one.

## Positioning

Every pro code is read directly from official match demos (the exact crosshair used in that match, dated with the match date), in the new CS2 share-code format (`CS...`, since the CS2 update of 30/09/2026). Competing lists still show old `CSGO-` codes that no longer import. The preview is drawn at real in-game size from the decoded code.

## Operating Context

- Static site (HTML/CSS/vanilla JS modules) on Cloudflare Pages at https://clutchcrosshair.com (code on GitHub, each push is deployed). No framework, no build step except `node build.js` (pre-renders every page, the sitemap and the minified CSS/JS), checked with `node check.js`.
- Data: `players.json` (75 pros from 15 teams, 14 creators), updated by `read_demo.py` from HLTV demos; previous crosshair codes are kept per player.
- Pages: home (search, team menu, tabs Pros / Creators / Trending / Generator / Pro Skins, sort, cards, player modal with `#slug` address), one page per player, one page per team, crosshair lists (most used, dot, small, outline, colors), crosshair generator, pro skins (5 inventories), guides, console commands, tools (bind generator), FAQ, methodology, legal notice, 404.
- Site copy is written in English and published in 5 languages: English, French, Spanish, Russian, Turkish (language selector on every page).

## Capabilities and Constraints

- Must keep every existing feature: search (pros + creators), team filter, tabs, sort, modal with shareable address, Copy share code / Copy console on cards, modal and player pages, light/dark mode (remembered), lazy photos, pre-rendered cards for SEO, social links + Contact us, FAQ button, language selector.
- Must keep the page skeleton, structure and all text content.
- Crosshair preview must stay at real in-game size (validated against the game); codes and console are correct.
- Planned: a game selector CS2 / Valorant (CS2 active, Valorant "soon") must have a place in the design now.
- Online: Crosshair Generator, Pro Skins, guides, console commands and tools (bind generator).
- SEO is the top business priority (keyword "CS2"); monetisation through fixed-price sponsored links (`sponsors.json`, always labelled "Sponsored" with `rel="sponsored"`), none sold yet.

## Brand Commitments

- Name: ClutchCrosshair.
- Logo "Hex badge" (`favicon.svg`, `logo-horizontal-dark.svg`, `logo-horizontal-light.svg`) is the only fixed brand asset. Colors and everything else may change.

## Evidence on Hand

- Real data: 75 pro and 14 creator crosshair codes with match dates, team logos (`logos/`), 89 player photos (`photos/`, HLTV, rights not cleared), CS2 screenshot `preview-bg.jpg` (Dust2, Long A doors).
- Computed pro stats (FAQ): color families, gap, center dot, outline shares.
- No testimonials, user counts, press or partnerships exist: do not invent them.

## Product Principles

1. Find → see → copy in the fewest clicks; nothing stands between the visitor and the Copy button.
2. The crosshair itself is the hero of every card, shown truthfully at real size.
3. Trust through facts: exact codes from official demos, dated; never invented claims.
4. Fast and readable on a gaming PC at night; usable on mobile.
5. Built for search engines: content in the HTML, one page per player.
