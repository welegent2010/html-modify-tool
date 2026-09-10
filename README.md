# HTML Modify Tool

A single-file, zero-dependency visual HTML editor for non-engineers.

Drop a Squarespace export (or any HTML page) into the left pane. The right pane shows you only the headings, text, images, links and buttons inside the block you clicked — current value in grey, your new value underneath. Download the result or copy it to your clipboard.

The editor is one HTML file. No npm install, no build step, no server.

---

## Quick start

1. Download `html-editor.html` from the [latest release](https://github.com/welegent2010/html-modify-tool/releases).
2. Double-click it. It opens in your default browser — Chrome recommended.
3. Click **OPEN FILE** on the top bar and pick any `.html` file (or paste a snippet into the box).
4. Click any block on the left. The right pane shows its editable content.
5. Type your changes. The preview updates live.
6. Click **EXPORT** to download the edited file (and copy it to your clipboard).

That is the entire flow. No account, no upload, no telemetry.

---

## What you can edit

For each block the right pane shows up to four kinds of item:

| Chip     | Field          | Notes                                                            |
|----------|----------------|------------------------------------------------------------------|
| `TEXT`   | A textarea     | The whole visible text inside the element, edited as one string. |
| `IMAGE`  | `src` + `alt`  | Replace the URL or the alt text. Size, crop and CSS are kept.    |
| `ACTION` | text + `href`  | Button text and link target, with an "open in new tab" toggle.   |

Nothing else is exposed. There is intentionally **no way** to:

- add, remove or reorder rows / columns / cards / sections
- change a class name, inline style, or `id`
- duplicate an element
- drag-and-drop to move things around

If you need structural edits, open the file in a real HTML editor. This tool is the safe layer for content edits only.

---

## How the right pane decides what to show

Sections in your page are detected automatically — every top-level block of `<body>` (a `<header>`, a `<section>`, the footer) becomes one chip in the section strip at the top of the right pane.

Inside each section the tool distinguishes two kinds of content:

- **OWN** — headings, body text, images and links that belong to the section itself.
- **CARDS** — repeating items (a grid of class cards, a list of services, etc.). Each card is its own chip; click one to edit that card alone.

This is the rule the tool uses to detect a cards grid:

> A direct child of a section is treated as a cards container when it has 2 or more same-tag children, and **each** child contains at least two of these four: an `<img>`, an `<h1>`-`<h6>`, an `<a>` or `<button>`, or a text node longer than 24 characters.

The strict `>= 2` requirement prevents two-column hero layouts (left text, right single image) from being misclassified as cards.

When the section has both kinds, a small **OWN · CARDS** toggle appears in the pane.

---

## Saving

- Every keystroke updates the live preview.
- After 600 ms of inactivity the full edited string is autosaved to `localStorage`. If the browser tab crashes or you accidentally close it, reopen `html-editor.html` and your last session is restored.
- Click **RESET** to wipe everything: the iframe, the paste box, the saved string, all state. Reloading afterwards gives you a fresh editor. RESET does **not** roll back to a previous version — it erases.

---

## Export

Click **EXPORT** in the top bar:

- **File mode** (loaded from disk): downloads a full HTML file with the same name plus `-YYYY-MM-DD.html`. The downloaded file is byte-identical to the original except for the text/image/link edits you made — all `<script>`, `<link>`, Tailwind classes, web components, fonts and remote images are preserved.
- **Paste mode** (snippet only): downloads the inner content of `<body>`, ready to paste into a Squarespace Code Block.

The edited string is also copied to the clipboard as a fallback. The editor never writes back to your original file on disk — you stay in control of where it lands.

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
4. **Sections with no visible text and no images.** If a section is purely a decorative gradient, it will not appear in the section strip.
5. **Two open tabs editing the same page.** `localStorage` is shared across tabs; the last writer wins. Use one tab at a time.
6. **Pages larger than ~2 MB.** The initial scan takes longer. No hard limit, just slower.
7. **Tailwind Play CDN unreachable.** If the page you load depends on `https://cdn.tailwindcss.com` and the CDN is down, the preview renders unstyled for the first ~6 seconds. After 6 seconds the scan falls back to whatever markup has arrived. The editor itself is unaffected.

---

## Repository layout

```
html modify tool/
├── html-editor.html           # the editor — the only file you ship
├── html-editor.v6-stable.html # frozen snapshot of the v6.0 release
├── dev-regression-test.js     # Playwright tests, developer-only
├── html/                      # sample inputs (drop your own files here)
│   ├── _example-hero.html
│   └── site-files/
└── output/                    # exports land here
```

`html-editor.html` and `html-editor.v6-stable.html` are byte-identical for now. The `.v6-stable.html` copy exists so you can keep working in the editor without ever touching the stable release artifact.

---

## For developers

### Why `<iframe srcdoc>`, not Shadow DOM

Tailwind Play CDN, `iconify-icon`, and Google Fonts are runtime JavaScript that **executes** before any styling appears. Shadow DOM only clones `<link>` / `<style>` / `<meta>` and skips `<script>` — so pages render fully unstyled and look completely black. `<iframe srcdoc>` runs the page exactly as a browser would, so everything renders normally.

### Why polling `readyState`, not the `load` event

A single blocked image (e.g. a 404 on a remote CDN) makes the `load` event never fire. The editor polls `document.readyState !== 'loading'` plus `body.childElementCount > 0` instead, with a ~6 second window during which it keeps re-scanning for late-arriving markup.

### Run the regression suite

```bash
# Playwright must be installed first (one-time)
# see dev-regression-test.js header for the binary path
node dev-regression-test.js
```

35 assertions × 4 runs = all green, including the slow network case where Tailwind CDN takes 5 seconds to deliver.

---

## Versioning

This project uses simple `MAJOR.MINOR` versioning. The current release is **v6.0** — the first publicly distributed version.

- v6.0 — first release. Two-tier view (OWN / CARDS), RESET clears, 35-assertion regression suite.

Breaking changes to the editor file (renamed UI elements, changed export format, new mandatory dependencies) will bump the major version and ship as a new release. The `.v6-stable.html` snapshot will keep working forever.

---

## License

MIT. Do whatever you want with it. Attribution appreciated but not required.

---

## Credits

Built by [@welegent2010](https://github.com/welegent2010). Inspired by Framer's component panel and the minimalist editor pattern (show only what the click could change).