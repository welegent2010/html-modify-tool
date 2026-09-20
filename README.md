# HTML Modify Tool

A single-file, zero-dependency visual HTML editor for non-engineers.

Drop a Squarespace export (or any HTML page) into the left pane. The right pane shows you only the headings, text, images, links and buttons inside the block you clicked — current value in grey, your new value underneath. Rows of little "how full is it" bars (like `Seats ●●○○`) get their own lit-count control. Download the result or copy it to your clipboard.

The editor is one HTML file. No npm install, no build step, no server.

---

## The top bar

Left to right:

- **HTML MODIFY TOOL** — product name.
- **filename** — the file you currently have open (`no file` before you load anything).
- **build version** — a permanent gold badge (currently `v6.9`) so a screenshot always tells you which build you are looking at. **If the badge does not say at least v6.7 you are running an old copy** — open `html-editor.html` from this folder, not a downloaded one.
- **status** — the transient state: `READY`, `RENDERING…`, `UNSAVED…`, `COPIED 12:09:41`, `SAVED 12:09:41`, `SAVE FAILED`. It turns gold when there is unsaved work.
- **IMPORT / OPEN FILE / PASTE / EXPORT / RESET** — the five actions. PASTE, EXPORT and RESET stay disabled until a document is loaded.
  - **IMPORT** opens the drawer you drop *source* HTML into (a Squarespace code block or a whole page). Pressing Cmd/Ctrl+V anywhere in the tool does the same thing.
  - **OPEN FILE** loads an `.html` file from disk; dragging one onto the preview works too.
  - **PASTE** copies the finished page to your clipboard — no save dialog, which is what you want when the page is going straight back into a code block.
  - **EXPORT** downloads a file. It does not touch the clipboard.

The version badge never changes while you work — only the status text does.

---

## Quick start

1. Download `html-editor.html` from the [latest release](https://github.com/welegent2010/html-modify-tool/releases).
2. Double-click it. It opens in your default browser — Chrome recommended.
3. Click **OPEN FILE** on the top bar and pick any `.html` file — or click **IMPORT** and paste a snippet into the box.
4. Click any block on the left. The right pane shows its editable content.
5. Type your changes. The preview updates live.
6. Click **PASTE** to copy the finished page to your clipboard (what you normally want), or **EXPORT** if you need the file on disk.

That is the entire flow. No account, no upload, no telemetry.

---

## What you can edit

For each block the right pane shows up to four kinds of item. Each one starts **collapsed** — a single chip row with a badge, a preview and a chevron. Click it to open the editor:

| Chip        | Collapsed row          | Editor (on click)                                        |
|-------------|------------------------|----------------------------------------------------------|
| `TEXT`      | badge · current text   | A single-line box with a `used / max` counter. Long values scroll sideways rather than growing the panel. |
| `IMAGE`     | badge · current text   | The picture URL (plus `alt` when the picture is a real `<img>`). Size, crop and CSS are kept. |
| `ACTION`    | badge · link label     | Button text and link target, with an "open in new tab" toggle. |
| `INDICATOR` | appears inside the editor of a `TEXT` chip that carries a row of small bars | lit count |

Every text field also carries a **character budget** — see below.

Only one chip is open at a time — clicking another closes the first, so the pane never grows into a wall of forms.

**A picture is a picture, `<img>` or not.** Photos are very often a CSS background rather than an `<img>`:

```html
<div class="route-img" style="background-image:url('…')"></div>
<div class="avatar"></div>            <!-- .avatar { background-image: url(…) } -->
<div class="hero-band" style="background:url('…') center/cover no-repeat"><h2>…copy on top…</h2></div>
<div class="band"></div>              <!-- .band::before { background-image: url(…) } -->
```

A box whose background holds a photo `url()` is an `IMAGE` chip like any other — its chip shows a small `bg` marker (or `bg ::before` when a pseudo-element paints it). Three shapes are recognised, and the copy that sits on top of the photo stays fully editable:

| shape | chip marker | what stays editable |
| --- | --- | --- |
| a childless photo box | `bg` | — nothing else in it |
| a photo **behind** content (hero band, tile with a badge) | `bg` | every text / link / button inside it |
| a photo painted by `::before` / `::after` | `bg ::before` | every text / link / button inside it |

Deliberately **not** treated as photos: gradients, flat colours, `data:` URIs, repeating patterns (tiled at natural size without `cover`/`contain`), and boxes smaller than 32px. If the hero band is itself a direct child of `<body>`, its photo is exposed too — nothing above it gets scanned otherwise.

Where the URL is written back matters, and the editor picks the right place by itself:

- **inline** (`background-image`, or the `background` shorthand) — edited in place, so extra layers, position and size survive untouched. A `background: url(a), linear-gradient(…)` keeps its gradient.
- **a CSS rule** — a single inline override is written on that one element. **The stylesheet is never modified**, which keeps the "content edits only" promise intact.
- **a pseudo-element** — there is no attribute to edit, so the element gets a stable `data-hmt-bg` hook and one rule is appended (later edits replace that line instead of piling up). The page's own stylesheet stays untouched here too.

A background photo has no `alt` attribute, so the ALT field is hidden for it rather than offered and ignored.

**One chip per field, not per element.** A card whose fields are stacked on separate lines gets one chip each — a timetable slot shows three (`09:00`, `Vinyasa Flow`, `Maya`), a pricing box shows two (`$120`, `/ session`). Editing one never touches its neighbours: no merging, no lost lines, no inherited fonts.

A *hover-swap* label — a button holding two `<span>`s where CSS hides one until hover — stays a single item, because at rest only one of them is visible.

A link or button whose label is built from **several stacked lines** (the studio logo, `<span>SAMA</span><span>Yoga Studio</span>`) is exposed as one `TEXT` chip per line, plus a `ACTION` chip that sets the URL only. Writing the joined label into the first line would delete the other lines and collapse the block.

Nothing else is exposed. There is intentionally **no way** to:

- add, remove or reorder rows / columns / cards / sections
- change a class name, inline style, or `id`
- duplicate an element
- drag-and-drop to move things around
- introduce a line break inside a text item (the field is single-line)

If you need structural edits, open the file in a real HTML editor. This tool is the safe layer for content edits only.

---

## Character budgets — why a long label stops typing

The editor may change text; it may never change CSS. The one lever that keeps a layout still is **how much text a field is allowed to hold**, so every text field measures its own ceiling and the browser refuses the next keystroke. The counter next to the label (`12 / 12`) turns amber at the limit.

The ceiling is measured per field, not hardcoded:

```
avgChar   average character width in that element's own font
perLine   characters that fit across the element's own text box
lines     lines the element already occupies today
slack     free horizontal room left in the element's own row

budget = max(currentLength, min(CEILING, perLine × lines + slack/avgChar))
```

In words: **you may retype the text you already have, plus whatever empty space your own row already offers — never more.**

| Element | Typical budget | Why |
|---|---|---|
| Nav link (`Home`) | 4–5 | `<nav>` is exactly as wide as its links — there is no slack, so growing one would push all nine and change the header spacing |
| Two-line logo line (`SAMA`) | ~6 | the wider sibling line (`Yoga Studio`) sets the block width; the shorter line may fill up to it and no further |
| Card CTA (`Book`) | ~8 | a pill may take one extra line |
| Hero CTA (`Book a Class`) | 20 | the row it sits in has spare width, and buttons stop at 20 characters |
| Card title (`Vinyasa Flow`) | 12 | tight single-line heading |
| Body paragraph | fills its current line count | rewriting a paragraph may not make it taller |

Links and buttons stop at **20 characters**; body text at 240. An element is treated as a "pill" (and gets the extra line) when it draws its own box — background, border, or ≥8px of horizontal padding. A bare text link never gets that allowance, which is what makes nav items strict and buttons lenient.

Two details worth knowing:

- The budget is measured **once per field**, from the layout the page shipped with. It does not creep upward as you type.
- It is a *typing* limit, not a rewrite limit: a value pasted or scripted in is trimmed by the same number.

---

## Indicator rows (Seats ●●○○)

Cards often carry a small "how full is it" row — a label followed by a few little bars where only some are lit:

```
Seats  ▬▬ ▬▬ ▬▬ ▬▬
        lit lit dim dim
```

The editor spots these on its own and gives the item an **INDICATOR** block with one clickable
block per bar:

- **Click a bar** to set how many are lit. Clicking the last lit bar dims it, so the full
  `0 … N` range is reachable with the bars alone.
- **`none` / `all`** are shortcuts for 0 and N.
- The label next to the row (`Seats`, `Places`, `Spots`…) is the ordinary text field of the same
  item — rename it like any other text.

The bar count is read from your markup, not assumed: a row of 5 works exactly like a row of 4.

### How it finds them (and why the CSS does not matter)

Nothing about your class names is hard-coded. The tool looks for the **shape** — 3 to 8 empty
sibling elements of the same tag, the same size, sitting on one line — and then compares their
**computed** styles to work out which ones are lit. A row counts as an indicator when:

- every bar is a leaf element with no text of its own,
- all bars are flat and wide (wider than tall) and share one row,
- the row uses **exactly two** visual states, and
- the lit bars form one unbroken run at the front, with the dim ones after them.

Two states means two states of the *rendered* bar, so all of these work without configuration:

| Your technique                                  | Example                                        |
|-------------------------------------------------|------------------------------------------------|
| A class on the lit bars                         | `.dots i { background:#5a544c }` + `.dots i.on { background:gold }` |
| Tailwind colour tokens                          | `bg-custom-accent` vs `bg-custom/30`           |
| Inline styles written by hand or by a script    | `style="background:#F5BD63"` vs `#4A443C`      |
| One colour, dimmed with opacity                 | `opacity:1` vs `opacity:.2`                    |
| A gradient sheen                                | different `background-image`                   |

The tool only writes back **what actually differs** between a lit bar and a dim bar — a class
token, an inline style property, or an attribute. Everything else on the bar (ids, aria labels,
per-bar classes) is left byte-for-byte alone. Bars that were already in the right state are never
touched at all, so your inline formatting survives.

A row of identical decorative blocks — same colour, no lit/dim split — is **not** an indicator and
gets no control. Across the 16 sample pages in `html/site-files/` the detector fires zero times.

---

## How the right pane decides what to show

The pane is deliberately quiet. **Nothing is listed until you ask for it.**

1. **Click a section** in the preview (or its chip in the strip). The pane lists every editable thing in that section as a one-line **field chip**: a type badge (`TEXT` / `IMAGE` / `ACTION` / `INDICATOR`), a short preview of the current value, and a chevron. A section with 27 own items is 27 tidy rows — not 27 open forms.
2. **Click a chip** to open its editor. Only the chip you clicked expands; opening another closes the first, so there is at most one editor on screen.
3. **Click a card** (in the preview, or its chip in the cards list) to focus that one card. The same collapse rules apply — the tool never dumps the whole card group into the pane.

Sections in your page are detected automatically — every top-level block of `<body>` (a `<header>`, a `<section>`, the footer) becomes one chip in the section strip at the top of the right pane.

Inside each section the tool distinguishes two kinds of content:

- **OWN** — headings, body text, images and links that belong to the section itself.
- **CARDS** — repeating items (a grid of class cards, a list of services, etc.). Each card is its own chip; click one to edit that card alone.

This is the rule the tool uses to detect a cards grid:

> A direct child of a section is treated as a cards container when it has 2 or more same-tag children, and **each** child contains at least two of these four: an `<img>`, an `<h1>`-`<h6>`, an `<a>` or `<button>`, or a text node longer than 24 characters.

The strict `>= 2` requirement prevents two-column hero layouts (left text, right single image) from being misclassified as cards.

Indicator rows (`Seats ●●○○`) are not a separate view — they appear as a control *inside* the expanded editor of the text chip that carries them. See [Indicator rows](#indicator-rows-seats-) above.

---

## Saving

- Every keystroke updates the live preview.
- After ~400 ms of inactivity the full edited string is autosaved to `localStorage`. If the browser tab crashes or you accidentally close it, reopen `html-editor.html` and your last session is restored.
- Click **RESET** to wipe everything: the iframe, the paste box, the saved string, all state. Reloading afterwards gives you a fresh editor. RESET does **not** roll back to a previous version — it erases.

---

## Getting the page back out

Two buttons, one job each.

**PASTE** (the one you want most of the time) copies the finished HTML to your clipboard. Nothing downloads and no dialog appears, so the loop is: edit → PASTE → Cmd+V into the Squarespace / Aura code block. If the browser refuses clipboard access — a `file://` page sometimes does — the editor says so and points you at EXPORT instead of failing silently.

**EXPORT** downloads a file:

- **File mode** (loaded from disk): a full HTML file with the same name plus `-YYYY-MM-DD.html`. It is byte-identical to the original except for the text/image/link edits you made — all `<script>`, `<link>`, Tailwind classes, web components, fonts and remote images are preserved.
- **Import mode** (snippet only): the inner content of `<body>`, ready to paste into a Squarespace Code Block.

Both write the same bytes and both refresh the autosave. The editor never writes back to your original file on disk — you stay in control of where it lands.

---

## Browser compatibility

Tested and verified on:

- ✅ Chrome 110+ (Mac, Windows, Linux)
- ✅ Edge 110+ (Chromium-based)
- ✅ Safari 16+ (Mac)
- ⚠️ Firefox 110+ — works, but remote images in `file://` iframes can hit CORS warnings on Windows

JavaScript features used (all standard since 2011): `iframe.srcdoc`, `WeakSet`, `document.execCommand('copy')`, `URL.createObjectURL`, `:focus-within`.

No external CDN, no npm package, no font download.

---

## Known limitations

The editor works for ~95% of static pages. It does not handle:

1. **Shadow DOM contents.** Pages that render text inside a `<template>` or a custom element with an open shadow root will appear empty in the right pane. You can still edit them by hand.
2. **Canvas / SVG text.** `<canvas>` and inline `<svg><text>` are skipped by design.
3. **`<input>` / `<textarea>` inside the page.** Forms are read-only markers — the tool will not try to edit a search bar or a newsletter field, only the static content around it.
4. **Sections with nothing in them.** A block that is purely decorative — a gradient, a solid
   colour, an empty spacer, a box with no text and no picture — does not appear in the section
   strip. A block holding a background **photo** does, from v6.7 on.
5. **Pictures that are not `<img>` or `background-image`.** A photo drawn with `<svg><image>`,
   with a CSS `content: url(…)` pseudo-element, or a `<canvas>` is skipped, like all other SVG.
6. **Background photos inside a `@media` override.** v6.7 writes an inline override when the URL
   comes from a CSS rule, and an inline value wins at every breakpoint — so if a rule sets a
   *different* photo on mobile, that one will be overridden too. Inline-authored photos (the
   common case) are unaffected.
7. **Two open tabs editing the same page.** `localStorage` is shared across tabs; the last writer wins. Use one tab at a time.
8. **Pages larger than ~2 MB.** The initial scan takes longer. No hard limit, just slower.
7. **Tailwind Play CDN unreachable.** If the page you load depends on `https://cdn.tailwindcss.com` and the CDN is down, the preview renders unstyled for the first ~6 seconds. After 6 seconds the scan falls back to whatever markup has arrived. The editor itself is unaffected.
8. **Indicator rows drawn with SVG.** If the bars are `<rect>` elements inside an inline `<svg>` instead of ordinary elements, the tool cannot see them — `<svg>` subtrees are skipped by design.
9. **Indicator rows that load with zero lit bars.** The lit look is learned from a bar that is
   actually lit. A row that ships with every bar dim looks identical to a decorative divider, so
   no control appears. Light at least one bar by hand first, or keep one lit in the template.
10. **Indicator rows with more than two states** (e.g. low / medium / full) are left alone — the
    "lit prefix" model only describes a two-state row.

---

## Repository layout

```
html modify tool/
├── html-editor.html           # the editor — the only file you ship
├── README.md                  # this file
├── html/                      # working pages — drop the files you want to edit here
│   └── site-files/            # a real Squarespace export (sample material)
├── tests/                     # developer-only regression suite, needs Playwright
│   ├── run-all.sh             # runs every suite in order
│   ├── dev-regression-test.js # (51)  real Squarespace pages, section/card model, export + clipboard
│   ├── dev-test-text-replace.js # (32)  text replacement, hover-swap, icons
│   ├── dev-test-meter.js      # (50)  indicator rows
│   ├── dev-test-timetable.js  # (35)  multi-line span stacks + a real page
│   ├── dev-test-collapse.js   # (28)  collapsed field chips, one editor open at a time
│   ├── dev-test-hover-swap.js # (14)  hover-swap labels stay in sync
│   ├── dev-test-budget.js     # (22)  character budgets, multi-line labels, no reflow
│   ├── dev-test-bg-image.js   # (42)  background-image photos, CSS untouched
│   ├── dev-test-backdrop.js   # (41)  photos behind copy, ::before photos, decoys
│   ├── _audit-v66.js          # split audit across all 15 real pages
│   ├── _audit-v67.js          # picture audit — <img> vs background photos, per page
│   ├── _audit-v69.js          # what the backdrop detector ADDS on real pages
│   ├── _example-hero.html     # fixtures: one per suite
│   ├── _dev-text-replace.html
│   ├── _dev-seats.html        #   seats indicator sample (all four techniques + a decoy)
│   ├── _dev-timetable.html    #   stacked-span fields + a hover-swap button
│   ├── _dev-bg-image.html     #   background-image photos: inline, CSS-rule, inside a link
│   └── _dev-backdrop.html     #   hero behind copy, ::before photo, icon badge + 5 decoys
└── output/                    # exports land here
```

`tests/` is not part of the editor — everything the editor itself needs is inside
`html-editor.html`. Fixtures live next to the suite that uses them; the only path that
points outside `tests/` is `../html/site-files/`, the sample Squarespace export.

---

## For developers

### Why `<iframe srcdoc>`, not Shadow DOM

Tailwind Play CDN, `iconify-icon`, and Google Fonts are runtime JavaScript that **executes** before any styling appears. Shadow DOM only clones `<link>` / `<style>` / `<meta>` and skips `<script>` — so pages render fully unstyled and look completely black. `<iframe srcdoc>` runs the page exactly as a browser would, so everything renders normally.

### Why polling `readyState`, not the `load` event

A single blocked image (e.g. a 404 on a remote CDN) makes the `load` event never fire. The editor polls `document.readyState !== 'loading'` plus `body.childElementCount > 0` instead, with a ~6 second window during which it keeps re-scanning for late-arriving markup.

### Run the regression suite

```bash
# Playwright must be installed first (one-time) — see tests/run-all.sh for the binary path

sh tests/run-all.sh                          # all nine suites
sh tests/run-all.sh dev-test-budget.js       # or a single one
```

All nine run green across repeated runs — 315 assertions.

The character budget makes a field refuse over-long edits, so a fixture that stuffs an 18-character
string into a 12-character title box will silently lose the tail. Keep test payloads inside the
field's budget (the suites assert `maxlength` first).

Two traps when driving the editor from a test:

- A field's input is destroyed when the panel re-renders (opening another chip does this), and
  Chrome fires `change` on the way out — which re-writes that field. Set a "final" value through
  the UI, not by reaching into the DOM behind the editor's back, or it will be overwritten.
- Nothing is detected inside a zero-sized box, so a fixture photo box needs a height in CSS.
  A `background-image` div with no height renders 0px tall and is correctly skipped.

Three throwaway audits worth repeating whenever the scanner changes:

- **split audit** (`_audit-v66.js`) — for every real page, list the elements the new detection splits
  that the old one did not. Each has to be a genuine stack of fields. v6.3 produced 32 splits across
  14 pages (`60 Mins`/`All Levels`, `$120`/`/ session`, `Day`/`01`) and no false ones. **v6.6: 0
  changes across all 15 pages** — the recursive rule only fires on the two-line logo.
- **indicator scan** — run `findBarRow()` over every element of every page and count hits; the
  answer must be 0 on real content. v6.3 re-checked all 14 pages: 0.
- **picture audit** (`_audit-v67.js`) — per page, how many `IMAGE` items are `<img>` and how many
  are background photos. **v6.7 measured the real export: 93 `<img>`, 0 background photos.** That
  is the point — the Aura/Squarespace pages were already fine, so the new rule is purely additive
  and cannot change any existing page's item list. It is the hand-written layouts that need it.
- **backdrop audit** (`_audit-v69.js`) — every element the v6.9 detector reaches that v6.7 did not,
  listed with size, `background-size` and filename. **v6.9 added exactly 2 across the same 14
  pages** (`booking.html` 768×274, `index.html` 980×420 — both `cover`, both real jpgs), so the
  wider rule adds no noise on production pages.

---

## Versioning

This project uses simple `MAJOR.MINOR` versioning.

- **v6.0** — first public release. Two-tier view (OWN / CARDS), RESET clears, 35-assertion suite.
- **v6.1** — fixed text replacement appending instead of replacing. Any label living inside a
  `<span>` (hover-swap buttons, schedule cards) had the new value *prepended* and kept the old
  text. The replacement now writes into the first text node of the subtree and drops the rest.
- **v6.2** — indicator rows. `Seats ●●○○` rows are detected from computed style and get a lit-count
  control. Also fixed a long-standing leak: removing a selection marker from an element that had
  no class of its own left `class=""` behind in the export. The top bar gained a permanent
  gold version badge next to the transient status text, so the build is identifiable from
  any screenshot.
- **v6.3** — one item per field. `isTextLeaf()` decided "this element is one editable run of text"
  from tag names alone, so a card whose fields were all `<span>` (a timetable slot, a Tailwind
  `flex flex-col` meta row like `60 Mins / All Levels`, a price row `$120 / / session`) was
  treated as a single value. Typing a space rewrote the first text node and deleted the other
  two — three styled lines collapsed into one and inherited the first line's font. Detection now
  also looks at layout: several visible text blocks each on their own line make the element a
  container, so every field becomes its own item. Hover-swap labels (one block hidden at rest)
  still count as a single item. `setTextPreserving()` gained a matching safety net — with several
  lines under one element it edits only the first and never merges or deletes the rest — and text
  items became single-line inputs.
- **v6.4** — collapsed field chips. The right pane used to dump a section's own items straight in
  as a stack of open editors, so a header section could show 27 inputs at once ("selection
  anxiety"). Every field is now one compact row — type badge, short preview, chevron — and its
  editor only exists after you click it. Opening another chip closes the previous one. The same
  collapse applies inside a focused card, and the pane starts empty until you pick something.
- **v6.5** — hover-swap labels. A button whose two labels sit on top of each other (Squarespace and
  Tailwind do this with `transform: translate` or `position: absolute`, so **both** stay visible at
  rest) was detected with CSS-state checks that never fired. The write went to the first label and
  the second stale copy stayed on screen — "写进去的字和先前默认的字同时存在". Detection is now
  geometric: two text children whose bounding boxes overlap in *both* axes are one label, and all
  of them are rewritten together. Removing an emptied element child also stopped `<span></span>`
  fragments from reaching the export.
- **v6.6** — "changing text must not change the layout". Three defects, one theme:
  1. **Multi-line labels were half-deleted.** The studio logo is
     `<a><div class="flex flex-col"><span>SAMA</span><span>Yoga Studio</span></div></a>` — a
     two-line label one level deeper than the old `stackedTextBlocks()` looked. It scored "1 line",
     so typing a single space rewrote the first text node and **deleted** `Yoga Studio`, collapsing
     the logo onto one line in a different font and sliding the whole nav sideways. The check is now
     recursive (a wrapper holding the stack is followed, and the lines individual text nodes start
     on are measured), and such a link is split into one `TEXT` item per line with the action item
     reduced to the URL.
  2. **`<br>` inside a label.** The hero `<h1>` is `Breathe. Move. <br>Return to center.` — two text
     nodes, one hard break. The writer replaced the first run and removed the second but kept the
     `<br>`, so the break drifted to the end of the text. When every text node is a direct child of
     the element the label is one run broken by `<br>`, and the run is replaced together with the
     breaks that separated it.
  3. **No length limit.** Any longer text widened its box and pushed the rest of the row. Every
     text/action input now carries a measured `maxlength` (see *Character budgets* above) with an
     `n / max` counter, so the browser refuses the extra keystroke and nothing moves.

  Cumulative test suite: from v6.0's 35 single-suite run to **225 assertions across 7 suites** —
  regression 44, text-replace 32, meter 50, timetable 35, collapse 28, hover-swap 14, budget 22.
- **v6.7** — "images I can't reach". `scan()` only ever looked for `<img>`, so every layout that
  puts its photos in CSS exposed **zero** images: the pictures were on screen and absent from the
  panel, with no way to swap a URL.

  ```html
  <div class="route-img" style="background-image:url('…')"></div>
  <div class="avatar"></div>          <!-- .avatar { background-image: url(…) } -->
  ```

  - A **picture box** — rendered, no text of its own, no `<img>`/`<svg>`/`<video>` inside, and a
    `url()` in its background — is now an `IMAGE` chip. Gradients are not photos; neither are
    translucent panels, content cards or 0-height spacers.
  - The write-back respects **where the URL lives**: an inline value is edited in place, so a
    shorthand keeps its extra layers, its position and its size; a class-driven one gets a single
    inline override and **the stylesheet is never touched**.
  - A `background-image` has no `alt`, so the ALT field is hidden instead of offered and ignored.
  - Two structural gaps came out of the same bug: a section whose root **is** the picture box
    (`<img>` or a photo div sitting directly on the body) was never scanned, because
    `scanSection()` only walked children — and a photo box has none. And the section gate required
    text or an `<img>`, so `<div class="hero-photo"></div>` was filtered out before anything could
    look at it.

  Cumulative test suite: **267 assertions across 8 suites** — the seven above plus
  bg-image 42. `_audit-v67.js` measures the split per page: the real export has 93 `<img>` and
  **0** background photos, i.e. this change is purely additive on existing pages.
- **v6.8** — "one button, one job". EXPORT downloaded a file *and* copied the HTML to the
  clipboard, so the save dialog opened every single time — even though the page nearly always
  goes straight back into a code block by pasting.

  - **PASTE** is a new button in the top bar: clipboard only, no dialog. If the browser refuses
    clipboard access it says so instead of failing silently.
  - **EXPORT** now only downloads.
  - The old PASTE — the button that opened the drawer you paste *source* HTML into — is renamed
    **IMPORT**, so the header reads `IMPORT · OPEN FILE · PASTE · EXPORT · RESET` and each word
    means one thing.
  - PASTE and EXPORT produce the same bytes; both refresh the autosave.

  Cumulative test suite: **274 assertions across 8 suites** — regression grows 44 → 51 with the
  clipboard contract (enabled only after a load, same bytes as EXPORT, no editor markers, status
  reads `COPIED`).
- **v6.9** — "the hero photo is still missing". v6.7 only recognised a background picture when the
  element had **no content of its own**, so the two most common layouts stayed invisible:

  ```html
  <div class="hero-band" style="background:url('…') center/cover no-repeat">
    <h2>Walk With Me</h2> …           <!-- photo BEHIND the copy -->
  <div class="band"></div>             <!-- .band::before paints it -->
  <figure style="background-image:url(…)"><svg class="badge">…</svg>
  ```

  - A **backdrop photo** no longer stops the walk: the section keeps every text / link / button
    chip *and* gains the picture. A hero band that is itself a direct child of `<body>` is covered
    too — nothing above it ever gets scanned otherwise.
  - Photos painted by `::before` / `::after` are detected. There is no attribute to edit, so the
    element gets a `data-hmt-bg` hook and one appended rule; later edits replace that line instead
    of piling up, and the page stylesheet stays byte-identical.
  - Still refused, on purpose: gradients, flat colours, `data:` URIs, patterns that tile at natural
    size without `cover`/`contain`, and boxes under 32px. Each decoy has its own assertion.
  - `_audit-v69.js` on the same 14 real pages: **+2 image items, both genuine photos** — the wider
    rule adds nothing to production pages.

  Cumulative test suite: **315 assertions across 9 suites** — the eight above plus backdrop 41.

Breaking changes to the editor file (renamed UI elements, changed export format, new mandatory
dependencies) will bump the major version and ship as a new release. Every release is tagged on
GitHub, so any past version stays one `git checkout v6.6` away.

---

## License

MIT. Do whatever you want with it. Attribution appreciated but not required.

---

## Credits

Built by [@welegent2010](https://github.com/welegent2010). Inspired by Framer's component panel and the minimalist editor pattern (show only what the click could change).