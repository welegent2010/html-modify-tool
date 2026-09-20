// v6.9 regression — "the hero photo is still missing"
//   A. a photo BEHIND content is an IMAGE item — and the content stays editable
//   B. a photo painted by ::before / ::after is reachable too
//   C. decoration still is not a photo: patterns, gradients, flat colour,
//      data: URIs
//   D. write-back never rewrites the page's own CSS
//   E. a pseudo photo is rewritten by appending one rule, exactly once
//   F. the export carries the new urls and no editor bookkeeping
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");
const { pathToFileURL } = require("url");
const BASE = "/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/";
const EDITOR = pathToFileURL(BASE + "html-editor.html").href;
const FIXTURE = __dirname + "/_dev-backdrop.html";

let passed = 0, failed = 0;
const ok = (cond, msg) => {
  if (cond){ passed++; console.log("  ok  " + msg); }
  else     { failed++; console.log("  FAIL " + msg); }
};

const NEW_INLINE = "https://images.unsplash.com/photo-9991111111111-eeeeeeeeeeee?w=1600";
const NEW_CSS    = "https://images.unsplash.com/photo-8882222222222-dddddddddddd?w=1500";
const NEW_PSEUDO = "https://images.unsplash.com/photo-7773333333333-cccccccccccc?w=1400";

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

  const shape = () => page.evaluate(() => SECTIONS.map(s => ({
    name: s.name,
    own: s.ownItems.map(i => ({
      kind: i.kind, bg: !!i.bg, pseudo: i.pseudo || null, bgSrc: i.bgSrc || null,
      cls: (typeof i.el.className === "string" ? i.el.className.trim().split(/\s+/)[0] : i.el.tagName) || i.el.tagName,
    })),
  })));

  /* ---------- A. a photo behind content is reachable ---------- */
  console.log("\n=== A. the photo behind the copy is an IMAGE item ===");
  const sec = await shape();
  sec.forEach((s,i) => console.log("   [" + i + "] " + s.name + "  " +
    s.own.map(x => x.kind + (x.pseudo ? "(bg " + x.pseudo + ")" : x.bg ? "(bg)" : "") + ":" + x.cls).join("  ")));

  const findSec = name => sec.find(s => s.name === name);
  const heroRoot = findSec("Walk With Me");
  ok(!!heroRoot, "the body-level hero band is a section");
  if (heroRoot){
    const imgs = heroRoot.own.filter(x => x.kind === "image");
    ok(imgs.length === 1, "its photo is one IMAGE item (got " + imgs.length + ")");
    ok(imgs[0] && imgs[0].cls === "hero-inline", "and it is the band itself, not a child");
    ok(heroRoot.own.filter(x => x.kind === "text").length === 2, "h2 + p are still TEXT items");
    ok(heroRoot.own.filter(x => x.kind === "action").length === 1, "the link is still an ACTION item");
  }
  const heroCss = findSec("Sunset Route");
  ok(!!heroCss && heroCss.own.filter(x => x.kind === "image").length === 1,
     "a class-driven hero photo is also reachable");
  const figSec = sec.find(s => s.own.some(x => x.cls === "icon-figure"));
  ok(!!figSec && figSec.own.filter(x => x.kind === "image").length === 1,
     "a photo tile that carries an svg badge is reachable");

  /* ---------- B. ::before and ::after photos ---------- */
  console.log("\n=== B. a photo painted by a pseudo-element ===");
  const pseudoItems = await page.evaluate(() => {
    const rows = [];
    SECTIONS.forEach(s => s.ownItems.forEach(i => { if (i.pseudo) rows.push({ cls: i.el.className.trim().split(/\s+/)[0], pseudo: i.pseudo, bgSrc: i.bgSrc }); }));
    return rows;
  });
  console.log("  " + pseudoItems.map(p => p.cls + " → " + p.pseudo).join("   |   "));
  ok(pseudoItems.length === 2, "both pseudo-painted photos are found (got " + pseudoItems.length + ")");
  ok(pseudoItems.every(p => p.pseudo === "::before" && p.bgSrc === "pseudo"), "reported as ::before / pseudo");
  const chip = await page.evaluate(() => {
    const it = SECTIONS.flatMap(s => s.ownItems).find(i => i.pseudo);
    return currentPreview(it);
  });
  ok(chip.indexOf("::before") >= 0, "the chip says which layer it is: " + chip.replace(/<[^>]+>/g, "").trim());

  /* ---------- C. decoration is still decoration ---------- */
  console.log("\n=== C. patterns, gradients and placeholders are NOT photos ===");
  const decoys = ["patterned", "Gradient-band", "plain-panel", "data-blob"];
  const hits = await page.evaluate(list => {
    const out = {};
    for (const cls of list){
      const cl = cls.replace(/^\./, "");
      let s = null;
      SECTIONS.forEach(x => { if (x.el.classList.contains(cl) || x.el.querySelector("." + cl)) s = x; });
      out[cls] = s ? s.ownItems.filter(i => i.kind === "image").length : -1;
    }
    return out;
  }, decoys);
  for (const cls of decoys){
    ok(hits[cls] === 0, "." + cls + " yields no IMAGE item (got " + hits[cls] + ")");
  }

  /* every edit goes through the real UI, never by poking the DOM behind
     the editor's back (a stale focused input fires `change` on removal). */
  const editPhoto = async (sel, value) => {
    const found = await page.evaluate(s => {
      const d = document.getElementById("frame").contentDocument;
      const el = d.querySelector(s);
      if (!el) return { err: "no such element" };
      const sec = SECTIONS.find(x => x.el.contains(el));
      if (!sec) return { err: "no section contains it" };
      ACTIVE = sec; VIEW = "own"; ACTIVE_CARD = null; ACTIVE_ITEM = el;
      renderStrip(); renderPanel(); paintSelection();
      const pool = ACTIVE.ownItems;
      let r = null;
      pool.forEach((it, i) => { if (it.el === el && it.bg) r = "own:" + i; });
      return r ? { ref: r } : { err: "no image item for it" };
    }, sel);
    if (!found.ref){ console.log("  (could not open " + sel + ": " + found.err + ")"); return null; }
    await page.locator(`.field[data-ref="${found.ref}"] .field-chip`).click();
    await page.waitForTimeout(150);
    await page.locator(`.field[data-ref="${found.ref}"].on input[data-f="src"]`).fill(value);
    await page.waitForTimeout(400);
    return found.ref;
  };

  /* ---------- D. write-back keeps everything else intact ---------- */
  console.log("\n=== D. write-back respects how the photo is stored ===");
  const styleBefore = await page.evaluate(() =>
    document.getElementById("frame").contentDocument.querySelector("style").textContent);

  /* hero-inline carries its photo in an INLINE SHORTHAND, so the write-back
     must edit that value in place and leave every other token alone. */
  const refInline = await editPhoto(".hero-inline", NEW_INLINE);
  ok(!!refInline, "the hero band's photo has an editable field");
  const inlineAfter = await page.evaluate(() => {
    const el = document.getElementById("frame").contentDocument.querySelector(".hero-inline");
    const cs = getComputedStyle(el);
    return { style: el.getAttribute("style"), size: cs.backgroundSize, pos: cs.backgroundPosition,
             imgs: el.querySelectorAll("img").length,
             kids: el.children.length, h2: (el.querySelector("h2") || {}).textContent || "" };
  });
  console.log("  " + inlineAfter.style.slice(0, 110));
  ok(inlineAfter.style.indexOf(NEW_INLINE) >= 0, "new url written into the shorthand");
  ok(/center/.test(inlineAfter.style) && /cover/.test(inlineAfter.style) && /no-repeat/.test(inlineAfter.style),
     "centre / cover / no-repeat survived inside the shorthand");
  ok(inlineAfter.size === "cover", "computed background-size is still cover");
  ok(inlineAfter.imgs === 0, "no <img> was injected");
  ok(inlineAfter.h2 === "Walk With Me", "the hero copy is untouched");
  ok(inlineAfter.kids === 3, "the band still has exactly its 3 children");

  const refCss = await editPhoto(".hero-css", NEW_CSS);
  ok(!!refCss, "the class-driven hero has an editable field");
  const cssAfter = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(".hero-css");
    return { inline: el.getAttribute("style") || "", computed: getComputedStyle(el).backgroundImage,
             rule: d.querySelector("style").textContent };
  });
  ok(cssAfter.inline.indexOf(NEW_CSS) >= 0, "class-driven: inline override added");
  ok(cssAfter.computed.indexOf(NEW_CSS) >= 0, "class-driven: the override is what renders");
  ok(cssAfter.rule === styleBefore, "class-driven: the stylesheet is byte-identical");

  /* ---------- E. a pseudo photo gets one rule, not a pile ---------- */
  console.log("\n=== E. the pseudo photo is rewritten with one appended rule ===");
  const refPseudo = await editPhoto(".band-pseudo", NEW_PSEUDO);
  ok(!!refPseudo, "the ::before photo has an editable field");
  const pseudoAfter = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(".band-pseudo");
    const st = d.getElementById("hmt-pseudo-bg");
    return {
      hook: el.getAttribute("data-hmt-bg"),
      ruleCount: st ? (st.textContent.match(/\[data-hmt-bg/g) || []).length : 0,
      ruleText: st ? st.textContent : "",
      inline: el.getAttribute("style") || "",
      computed: getComputedStyle(el, "::before").backgroundImage,
      ownRule: d.querySelector("style").textContent,
    };
  });
  ok(!!pseudoAfter.hook, "the element got a stable hook: data-hmt-bg=" + pseudoAfter.hook);
  ok(pseudoAfter.ruleCount === 1, "exactly one rule appended (got " + pseudoAfter.ruleCount + ")");
  ok(pseudoAfter.ruleText.indexOf(NEW_PSEUDO) >= 0, "the rule carries the new url");
  ok(pseudoAfter.computed.indexOf(NEW_PSEUDO) >= 0, "and it is what the ::before layer paints");
  ok(pseudoAfter.inline === "", "the element's own style attribute is untouched");
  ok(pseudoAfter.ownRule === styleBefore, "the page stylesheet is byte-identical");

  /* editing the same photo again must replace the line, not append another */
  await editPhoto(".band-pseudo", NEW_PSEUDO + "&v=2");
  const twice = await page.evaluate(() => {
    const st = document.getElementById("frame").contentDocument.getElementById("hmt-pseudo-bg");
    return { n: (st.textContent.match(/\[data-hmt-bg/g) || []).length, hasV2: st.textContent.indexOf("v=2") >= 0 };
  });
  ok(twice.n === 1, "a second edit keeps it to one rule (got " + twice.n + ")");
  ok(twice.hasV2, "and the newer url wins");

  /* ---------- F. export ---------- */
  console.log("\n=== F. the export carries it all ===");
  const out = await page.evaluate(() => serialize());
  ok(out.indexOf(NEW_INLINE) >= 0, "export has the hero shorthand url");
  ok(out.indexOf(NEW_CSS) >= 0, "export has the class-driven override");
  ok(out.indexOf(NEW_PSEUDO) >= 0 && out.indexOf("v=2") >= 0, "export has the pseudo rule");
  ok(out.indexOf("data-hmt-bg") >= 0, "export has the hook the rule targets");
  ok(out.indexOf("__edit-") < 0, "export leaks no editor marker class");
  ok(out.indexOf('class=""') < 0, "export has no empty class attributes");
  const svgKept = out.indexOf("<svg") >= 0 && out.indexOf("<circle") >= 0;
  ok(svgKept, "the svg badge inside the photo tile survived");

  await browser.close();
  console.log("\n================ " + passed + " passed, " + failed + " failed ================");
  process.exit(failed ? 1 : 0);
})();
