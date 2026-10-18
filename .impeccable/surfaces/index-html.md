---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["style.css","players","faq.html","legal.html"]
---

# Surface brief: home (index.html) and shared pages

Scope: home page (Operate mode: find a pro, see the crosshair, copy the code), plus player pages, FAQ, legal and 404, which share style.css. Restyle only: keep the skeleton, every feature and all text. Code-led build.

## Direction contract

THESIS: Every pro is presented as a CS Major broadcast player spotlight: a team-colour slab carrying the name, the crosshair as the on-screen stat, COPY as the bold action tab. It refuses the generic dark card grid with one lone accent and a gradient title.

OWN-WORLD: Broadcast black ground #0E0F13, panels #16181E, 1px seams #2A2E37, no glows. Team colours own the slabs (text black or white by contrast). Red #E3262E is the live colour: Copy, active tab rule, header rule, focus. Yellow #FFD400 only labels the stat box and Trending ranks. Saira Condensed 700/800 caps for names, tabs, buttons; Inter for UI and body; JetBrains Mono for codes; tabular figures. Chamfered corners, radius ≤ 2px.

STORY: The visitor spots their team by slab colour, reads the crosshair at true size in the stat box, presses COPY and alt-tabs into CS2.

FIRST VIEWPORT: Same skeleton: left roster rail (logo, teams with colour chips, follow and contact at the bottom), top bar (search, CS2/Valorant switch, FAQ, EN, theme), condensed 56px H1 and subtitle, tab rail with red underline and sort, then a 4-column grid of spotlight cards: 96px team slab with name 34px and photo cut-out, meta line team and match date, stat box with the real-size canvas, code row with COPY tab, console row.

FORM: Major Broadcast Package, candidate 1 of 7 on the grounded list (Impeccable's pick, chosen by the user over the assigned Reticle Spec Sheet). seed:d9ef083ddd375bba. Signature interaction: the COPY "wipe", a red broadcast bar sweeping across the code row that reads COPIED, 220 ms, disabled under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
