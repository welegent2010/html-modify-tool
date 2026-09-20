// v6.7 regression — "images I can't reach"
//   A. background-image photo boxes ARE image items (this used to be zero)
//   B. gradients, translucent panels and content cards are NOT
//   C. editing an inline background-image url keeps the rest of the value
//      (position / size / extra layers) and never adds an <img>
//   D. a class-driven background-image gets an inline override; the
//      <style> block is byte-identical afterwards
//   E. a plain <img> still works exactly as before
//   F. the export carries the new urls, keeps the CSS untouched and leaks
//      no editor bookkeeping
//   G. the PASTE workflow (the way the snippet actually arrives) sees them too
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");
const { pathToFileURL } = require("url");
const fs = require("fs");
const BASE = "/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/";
const EDITOR = pathToFileURL(BASE + "html-editor.html").href;
const FIXTURE = __dirname + "/_dev-bg-image.html";

let passed = 0, failed = 0;
const ok = (cond, msg) => {
  if (cond){ passed++; console.log("  ok  " + msg); }
  else     { failed++; console.log("  FAIL " + msg); }
};

const NEW_MAIN = "https://images.unsplash.com/photo-9999999999999-aaaaaaaaaaaa?w=1200&q=80";
const NEW_CLS  = "https://images.unsplash.com/photo-8888888888888-bbbbbbbbbbbb?w=600&q=80";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", e => { failed++; console.log("  FAIL pageerror " + e.message); });
  await page.goto(EDITOR);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  await page.locator("#fileInput").setInputFiles(FIXTURE);
  await page.waitForTimeout(8000);

  /* every image item in the whole document, wherever it lives */
  const allImages = () => page.evaluate(() => {
    const rows = [];
    const walk = items => items.forEach(it => {
      if (it.kind !== "image") return;
      rows.push({
        cls: (typeof it.el.className === "string" ? it.el.className : "").trim(),
        tag: it.el.tagName,
        bg: !!it.bg,
        bgSrc: it.bgSrc || null,
        src: it.bg ? (bgImageInfo(it.el) || {}).url || "" : (it.el.getAttribute("src") || ""),
        inline: it.el.getAttribute("style") || "",
      });
    });
    SECTIONS.forEach(s => { walk(s.ownItems); s.cards.forEach(c => walk(c.items)); });
    return rows;
  });

  /* ---------- A. background photos are finally reachable ---------- */
  console.log("\n=== A. background-image photo boxes are image items ===");
  const shape = await page.evaluate(() => SECTIONS.map((s, i) => ({
    i, name: s.name, own: s.ownItems.length, cards: s.cards.length,
    kinds: s.ownItems.map(it => it.kind + (it.bg ? "(bg)" : "")).join(","),
  })));
  console.log("  sections:");
  shape.forEach(s => console.log("   [" + s.i + "] " + s.name + "  own=" + s.own + " cards=" + s.cards +
    "  " + (s.kinds || "")));

  const imgs = await allImages();
  const bgItems = imgs.filter(i => i.bg);
  console.log("  image items: " + imgs.length + " (" + bgItems.length + " background)");
  console.log("  " + bgItems.map(i => i.cls || i.tag).join("  |  "));

  const expectBgClasses = ["route-img", "avatar", "avatar", "photo-item", "photo-item", "photo-item",
                           "hero-photo", "tile-photo"];
  const bgClasses = bgItems.map(i => (i.cls || i.tag).split(/\s+/)[0]);
  for (const c of new Set(expectBgClasses)){
    const want = expectBgClasses.filter(x => x === c).length;
    const got  = bgClasses.filter(x => x === c).length;
    ok(got === want, "found " + got + "/" + want + " background photo(s) on ." + c);
  }
  ok(bgItems.length === 8, "8 background photos detected (got " + bgItems.length + ")");

  const inlineBg = bgItems.filter(i => i.bgSrc === "inline-image").length;
  const cssBg    = bgItems.filter(i => i.bgSrc === "css").length;
  ok(inlineBg === 7, "7 urls come from an inline style (got " + inlineBg + ")");
  ok(cssBg === 1, "1 url comes from a CSS rule (got " + cssBg + ")");

  /* a photo tile living INSIDE a link must be reachable too */
  const linked = bgItems.find(i => (i.cls || "").split(/\s+/).indexOf("tile-photo") >= 0);
  ok(!!linked, "a background photo inside an <a> is detected");
  const linkAction = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const a = d.querySelector(".tile-link");
    const sec = SECTIONS.find(x => x.el.contains(a) || x.el === a);
    return sec ? sec.ownItems.filter(it => it.kind === "action").length : -1;
  });
  ok(linkAction === 1, "the wrapping link still offers its URL field");

  /* ---------- B. what must NOT be mistaken for a photo ---------- */
  console.log("\n=== B. gradients / panels / content cards are not photos ===");
  const junk = imgs.filter(i => /gradient/i.test(i.src || ""));
  ok(junk.length === 0, "no gradient was taken for a photo (got " + junk.length + ")");
  const overlay = imgs.find(i => (i.cls || "").split(/\s+/).indexOf("route-overlay") >= 0);
  ok(!overlay, ".route-overlay (pure gradient) is not an image item");
  const note = imgs.find(i => (i.cls || "").split(/\s+/).indexOf("route-note") >= 0);
  ok(!note, ".route-note (translucent panel) is not an image item");
  const card = imgs.find(i => (i.cls || "").split(/\s+/).indexOf("route-card") >= 0);
  ok(!card, ".route-card (content card with a solid background) is not an image item");

  /* ---------- C. writing an inline background url ---------- */
  console.log("\n=== C. editing an inline background-image ===");
  const before = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(".route-img");
    return { inline: el.getAttribute("style"), size: getComputedStyle(el).backgroundSize,
             pos: getComputedStyle(el).backgroundPosition };
  });
  console.log("  before: " + before.inline.slice(0, 90));

  const editPhoto = async (sel, value) => {
    const found = await page.evaluate(s => {
      const d = document.getElementById("frame").contentDocument;
      const el = d.querySelector(s);
      if (!el) return { err: "no such element" };
      const sec = SECTIONS.find(x => x.el.contains(el));
      if (!sec) return { err: "no section contains it" };
      ACTIVE = sec; VIEW = "own"; ACTIVE_CARD = null; ACTIVE_ITEM = null;
      /* if the photo lives inside a card, focus that card first */
      for (const c of sec.cards){ if (c.el.contains(el) || c.el === el){ ACTIVE_CARD = c; VIEW = "card"; } }
      renderStrip(); renderPanel(); paintSelection();
      const pool = ACTIVE_CARD ? ACTIVE_CARD.items : ACTIVE.ownItems;
      let r = null;
      pool.forEach((it, i) => { if (it.el === el) r = (ACTIVE_CARD ? "card:" : "own:") + i; });
      return r ? { ref: r, view: ACTIVE_CARD ? "card" : "own" } : { err: "no item for it" };
    }, sel);
    if (found.err || !found.ref){
      console.log("  (could not open " + sel + ": " + (found.err || found.ref) + ")");
      return null;
    }
    await page.locator(`.field[data-ref="${found.ref}"] .field-chip`).click();
    await page.waitForTimeout(200);
    await page.locator(`.field[data-ref="${found.ref}"].on input[data-f="src"]`).fill(value);
    await page.waitForTimeout(400);
    return found.ref;
  };

  const refMain = await editPhoto(".route-img", NEW_MAIN);
  ok(!!refMain, ".route-img has an editable IMAGE field (" + refMain + ")");

  const afterMain = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(".route-img");
    return { inline: el.getAttribute("style"), size: getComputedStyle(el).backgroundSize,
             pos: getComputedStyle(el).backgroundPosition,
             imgs: el.querySelectorAll("img").length,
             children: el.children.length };
  });
  console.log("  after:  " + afterMain.inline.slice(0, 90));
  ok(afterMain.inline.indexOf(NEW_MAIN) >= 0, "the new url is in the inline style");
  ok(afterMain.size === before.size && afterMain.pos === before.pos,
     "background-size / -position survived (" + afterMain.size + " / " + afterMain.pos + ")");
  ok(afterMain.imgs === 0 && afterMain.children === 0, "no <img> and no wrapper element was injected");
  ok(afterMain.inline.indexOf("url(") >= 0 && (afterMain.inline.match(/url\(/g) || []).length === 1,
     "exactly one url() in the style attribute (the old one is gone)");

  /* a shorthand value with extra layers must keep the extra layers */
  const layered = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(".route-img");
    el.setAttribute("style", "background: url('https://old.example/a.jpg') center/cover no-repeat, linear-gradient(red,blue)");
    el.className = "route-img";
    return { ok: !!document.getElementById("frame").contentDocument };
  });
  const refLayer = await editPhoto(".route-img", "https://new.example/b.jpg");
  const layerAfter = await page.evaluate(() => {
    const el = document.getElementById("frame").contentDocument.querySelector(".route-img");
    return el.getAttribute("style");
  });
  ok(layerAfter.indexOf("new.example/b.jpg") >= 0, "layered shorthand: new url written");
  ok(/linear-gradient/.test(layerAfter), "layered shorthand: the gradient layer is still there");
  ok(/center\/cover|center \/ cover|cover/.test(layerAfter), "layered shorthand: position/size kept");

  /* NOTE: a stale, focused input fires `change` when the panel re-renders
     and removes it, which re-writes that field. So the "final" value used
     for the export check is set through the real UI at the end, never by
     reaching into the DOM behind the editor's back. */

  /* ---------- D. a class-driven url gets an inline override ---------- */
  console.log("\n=== D. a class-driven background-image ===");
  const styleBefore = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    return d.querySelector("style").textContent;
  });
  const refCss = await editPhoto(".hero-photo", NEW_CLS);
  ok(!!refCss, ".hero-photo has an editable IMAGE field (" + refCss + ")");

  const clsAfter = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(".hero-photo");
    return { inline: el.getAttribute("style") || "", computed: getComputedStyle(el).backgroundImage,
             css: d.querySelector("style").textContent };
  });
  ok(clsAfter.inline.indexOf(NEW_CLS) >= 0, "an inline override carries the new url");
  ok(clsAfter.computed.indexOf(NEW_CLS) >= 0, "the element actually renders the new photo");
  ok(clsAfter.css === styleBefore, "the <style> block is byte-identical — no CSS was touched");

  /* ---------- E. plain <img> still works ---------- */
  console.log("\n=== E. a plain <img> is unchanged behaviour ===");
  const realImg = imgs.find(i => (i.cls || "").split(/\s+/).indexOf("real-img") >= 0);
  ok(!!realImg, "the <img> is still an image item");
  ok(realImg && realImg.bg === false, "it is NOT flagged as a background photo");
  ok(realImg && /1601758228041/.test(realImg.src), "its src is read from the attribute");

  const imgEdit = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(".real-img");
    const sec = SECTIONS.find(x => x.el.contains(el));
    ACTIVE = sec; VIEW = "own"; ACTIVE_CARD = null; ACTIVE_ITEM = null;
    renderStrip(); renderPanel(); paintSelection();
    let ref = null;
    ACTIVE.ownItems.forEach((it, i) => { if (it.el === el) ref = "own:" + i; });
    return ref;
  });
  if (imgEdit){
    await page.locator(`.field[data-ref="${imgEdit}"] .field-chip`).click();
    await page.waitForTimeout(200);
    await page.locator(`.field[data-ref="${imgEdit}"].on input[data-f="src"]`).fill("https://cdn.example/dog.jpg");
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => document.getElementById("frame").contentDocument.querySelector(".real-img").getAttribute("src"));
    ok(s === "https://cdn.example/dog.jpg", "<img> src write-back still works");
    const altShown = await page.locator(`.field[data-ref="${imgEdit}"].on .field-edit input[data-f="alt"]`).count();
    ok(altShown === 1, "an <img> still offers the ALT field");
  }

  /* background photos must NOT offer ALT (they have no alt attribute) */
  await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(".route-img");
    const sec = SECTIONS.find(x => x.el.contains(el));
    ACTIVE = sec; VIEW = "own"; ACTIVE_CARD = null;
    for (const c of sec.cards){ if (c.el.contains(el) || c.el === el){ ACTIVE_CARD = c; VIEW = "card"; } }
    ACTIVE_ITEM = el;
    renderStrip(); renderPanel(); paintSelection();
  });
  await page.waitForTimeout(200);
  const bgAltShown = await page.locator('.field.on .field-edit input[data-f="alt"]').count();
  ok(bgAltShown === 0, "a background photo does not offer a meaningless ALT field");
  const bgSrcShown = await page.locator('.field.on .field-edit input[data-f="src"]').count();
  ok(bgSrcShown === 1, "a background photo does offer the IMAGE URL field");

  /* ---------- F. export ---------- */
  console.log("\n=== F. export ===");
  /* leave .route-img on the new url, through the UI, as the last write */
  await editPhoto(".route-img", NEW_MAIN);
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    return { route: d.querySelector(".route-img").getAttribute("style") || "",
             hero: d.querySelector(".hero-photo").getAttribute("style") || "" };
  });
  console.log("  .route-img  style: " + state.route.slice(0, 110));
  console.log("  .hero-photo style: " + state.hero.slice(0, 110));
  const out = await page.evaluate(() => serialize() || "");
  /* match on the photo id only: "&" is serialized as "&amp;" in attributes */
  ok(out.indexOf("photo-9999999999999-aaaaaaaaaaaa") >= 0, "the new inline url is in the export");
  ok(out.indexOf("photo-8888888888888-bbbbbbbbbbbb") >= 0, "the new class-driven url is in the export");
  ok(out.indexOf("photo-1548199973-03cce0bbc87b") < 0, "the replaced inline url is gone");
  ok(!/__(edit|hilite)/.test(out), "no editor marker classes in the export");
  ok(!/\bdata-max\b|\bmaxlength\b/.test(out), "no editor attributes in the export");
  const styleInExport = (out.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
  ok(styleInExport.indexOf("photo-8888888888888") < 0, "the exported <style> block was not rewritten");
  ok(styleInExport.indexOf("photo-1558788353") >= 0, "the original CSS url is still spelled as it was");

  /* ---------- G. the PASTE workflow sees them too ---------- */
  console.log("\n=== G. the IMPORT workflow ===");
  const frag = fs.readFileSync(FIXTURE, "utf-8")
    .replace(/^[\s\S]*<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  await page.locator("#btnImport").click();
  await page.waitForTimeout(300);
  await page.locator("#pasteInput").fill(frag);
  await page.locator("#btnRender").click();
  await page.waitForTimeout(6000);
  const pasted = await page.evaluate(() => {
    const rows = [];
    const walk = items => items.forEach(it => { if (it.kind === "image") rows.push({ cls: ((typeof it.el.className === "string" ? it.el.className : "")).trim(), bg: !!it.bg }); });
    SECTIONS.forEach(s => { walk(s.ownItems); s.cards.forEach(c => walk(c.items)); });
    return rows;
  });
  const pastedBg = pasted.filter(i => i.bg).length;
  console.log("  pasted: " + pasted.length + " image items, " + pastedBg + " background");
  ok(pastedBg === 8, "the pasted snippet exposes 8 background photos (got " + pastedBg + ")");
  ok(pasted.some(i => (i.cls || "").split(/\s+/).indexOf("real-img") >= 0), "the pasted <img> is there too");

  await browser.close();
  console.log("\n=========================================");
  console.log(passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
