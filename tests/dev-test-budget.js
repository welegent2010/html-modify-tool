// v6.6 regression — "改文字不能改排版"
//   A. a nav link keeps its length (and none of its siblings move)
//   B. a multi-line label (logo: SAMA / Yoga Studio) is split, not truncated
//   C. a label broken by <br> (hero h1) is replaced cleanly, break included
//   D. a button in a roomy row may breathe, but stops at the 20-char ceiling
//   E. the "n / max" badge tracks the input
//   F. nothing in the page's CSS is touched
//   G. none of the editor's bookkeeping leaks into the export
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");
const { pathToFileURL } = require("url");
const BASE = "/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/";
const EDITOR = pathToFileURL(BASE + "html-editor.html").href;
const PAGE = BASE + "html/site-files/index.html";

let passed = 0, failed = 0;
const ok = (cond, msg) => {
  if (cond){ passed++; console.log("  ok  " + msg); }
  else     { failed++; console.log("  FAIL " + msg); }
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", e => { failed++; console.log("  FAIL pageerror " + e.message); });
  await page.goto(EDITOR);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  await page.locator("#fileInput").setInputFiles(PAGE);
  await page.waitForTimeout(8000);

  const gotoSectionWith = sel => page.evaluate(s => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(s);
    const sec = SECTIONS.find(x => x.el.contains(el));
    ACTIVE = sec; VIEW = "own"; ACTIVE_CARD = null; ACTIVE_ITEM = null;
    renderStrip(); renderPanel(); paintSelection();
    return sec ? sec.name : null;
  }, sel);

  const refFor = sel => page.evaluate(s => {
    const d = document.getElementById("frame").contentDocument;
    const el = d.querySelector(s);
    let found = null, flags = null;
    ACTIVE.ownItems.forEach((it, i) => { if (it.el === el){ found = "own:" + i; flags = !!it.noText; } });
    return { ref: found, noText: flags };
  }, sel);

  const openField = async ref => { await page.locator(`.field[data-ref="${ref}"] .field-chip`).click(); await page.waitForTimeout(250); };
  const inputFor = ref => page.locator(`.field[data-ref="${ref}"].on input[data-f="text"]`);

  /* ---------- A. nav link ---------- */
  console.log("\n=== A. nav link keeps its length; siblings stay put ===");
  console.log("  section: " + await gotoSectionWith("header"));
  const navSnap = () => page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    return [...d.querySelectorAll("header nav a")].map(a => {
      const r = a.getBoundingClientRect();
      return { t: a.textContent.trim(), x: Math.round(r.left * 10) / 10, w: Math.round(r.width * 10) / 10 };
    });
  });
  const nav0 = await navSnap();
  const homeRef = (await refFor("header nav a")) .ref;
  await openField(homeRef);
  const navMax = +await inputFor(homeRef).getAttribute("maxlength");
  console.log("  'Home' maxlength =", navMax);
  ok(navMax >= 4 && navMax <= 6, "nav link budget is ~its own length (got " + navMax + ")");
  await inputFor(homeRef).fill("Homepage");
  await page.waitForTimeout(500);
  const navState = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const a = d.querySelector("header nav a");
    return { text: a.textContent.trim(), val: document.querySelector('.field.on input[data-f="text"]').value };
  });
  console.log("  after typing 'Homepage':", JSON.stringify(navState));
  ok(navState.text.length <= navMax, "DOM text clamped to the budget (got " + navState.text.length + ")");
  ok(navState.val === navState.text, "input shows exactly what the page shows");
  const nav1 = await navSnap();
  /* Header row is `justify-between`: a one-character grow re-balances the
     free space, so a sub-10px nudge of the links is the floor. The v6.5 bug
     moved them 15-30px AND collapsed the logo — that is what we guard. */
  const shifts = nav1.map((a, i) => Math.abs(a.x - nav0[i].x));
  const worst = Math.max(...shifts);
  console.log("  link shifts (px):", shifts.map(v => v.toFixed(1)).join(" "));
  ok(worst <= 10, "no nav link was thrown around (worst shift " + worst.toFixed(1) + "px, was 15-30px)");

  /* ---------- B. multi-line label ---------- */
  console.log("\n=== B. two-line logo is split, never truncated ===");
  const logoSel = 'header a[href="index.html"]';
  const logoRefInfo = await refFor(logoSel);
  console.log("  logo action ref:", JSON.stringify(logoRefInfo));
  ok(logoRefInfo.noText === true, "logo action item is URL-only (no destructive text field)");
  const logoChips = await page.evaluate(() => [...document.querySelectorAll(".field")].map(f => ({
    ref: f.dataset.ref, kind: f.dataset.kind, text: (f.querySelector(".ftxt") || {}).textContent || "" })));
  console.log("  chips:", logoChips.filter(c => /SAMA|Yoga/.test(c.text)).map(c => c.ref + ":" + c.kind + ":" + c.text).join(" | "));
  const samaRef = logoChips.find(c => c.text.trim() === "SAMA");
  const yogaRef = logoChips.find(c => c.text.trim() === "Yoga Studio");
  ok(!!samaRef, "'SAMA' is its own field");
  ok(!!yogaRef, "'Yoga Studio' is its own field");
  await openField(samaRef.ref);
  const logoBefore = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const a = d.querySelector('header a[href="index.html"]');
    return { h: Math.round(a.getBoundingClientRect().height),
             navLeft: Math.round(d.querySelector("header nav").getBoundingClientRect().left) };
  });
  await inputFor(samaRef.ref).fill("Aurora");
  await page.waitForTimeout(500);
  const logoState = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const a = d.querySelector('header a[href="index.html"]');
    return { spans: [...a.querySelectorAll("span")].map(s => s.textContent.trim()),
             h: Math.round(a.getBoundingClientRect().height),
             navLeft: Math.round(d.querySelector("header nav").getBoundingClientRect().left) };
  });
  logoState.h0 = logoBefore.h; logoState.navLeft0 = logoBefore.navLeft;
  console.log("  logo after editing line 1:", JSON.stringify(logoState));
  ok(logoState.spans.length === 2, "logo still has two spans (got " + logoState.spans.length + ")");
  ok(logoState.spans[1] === "Yoga Studio", "second line survived the edit");

  /* ---------- C. <br> inside a label ---------- */
  console.log("\n=== C. hero h1 broken by <br> is replaced cleanly ===");
  await gotoSectionWith("h1");
  const h1Ref = (await refFor("h1")).ref;
  await openField(h1Ref);
  await inputFor(h1Ref).fill("Move. Breathe. Return.");
  await page.waitForTimeout(500);
  const h1 = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const h = d.querySelector("h1");
    return { text: h.textContent.trim().replace(/\s+/g, " "), brs: h.querySelectorAll("br").length, nodes: h.childNodes.length };
  });
  console.log("  h1 after:", JSON.stringify(h1));
  ok(h1.text === "Move. Breathe. Return.", "h1 text is exactly the new value (no leftover tail)");
  ok(h1.brs === 0, "the <br> that separated the old runs is gone");

  /* ---------- D. button budget ---------- */
  console.log("\n=== D. hero button: roomy but capped at 20 ===");
  const btn = await refFor('section a[href="booking.html"]');
  await openField(btn.ref);
  const btnMax = +await inputFor(btn.ref).getAttribute("maxlength");
  console.log("  'Book a Class' maxlength =", btnMax);
  ok(btnMax === 20, "button ceiling is 20 characters (got " + btnMax + ")");
  await inputFor(btn.ref).fill("Book your very first class now please");
  await page.waitForTimeout(500);
  const btnState = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const a = d.querySelector('section a[href="booking.html"]');
    const r = a.getBoundingClientRect();
    return { text: a.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log("  after over-typing:", JSON.stringify(btnState));
  ok(btnState.text.length === 20, "clamped to 20 chars (got " + btnState.text.length + ")");
  ok(btnState.h <= 56, "button did not wrap to a second line (height " + btnState.h + ")");

  /* ---------- E. the badge ---------- */
  console.log("\n=== E. the n / max badge ===");
  const badge = await page.locator('.field.on [data-lim]').textContent();
  console.log("  badge:", JSON.stringify(badge));
  ok(new RegExp("^20\\s*/\\s*20$").test(badge.trim()), "badge reads '20 / 20' when full");
  ok(await page.locator('.field.on .lim.at').count() === 1, "badge turns amber at the ceiling");

  /* ---------- F. CSS untouched ---------- */
  console.log("\n=== F. the page's own CSS is never written ===");
  const cssClean = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const a = d.querySelector('section a[href="booking.html"]');
    return { styleAttr: a.getAttribute("style") };
  });
  ok(cssClean.styleAttr === null, "no inline style attribute was added");
  /* The ACTIVE section / item legitimately carries the editor's outline
     marker — strip those before counting "orphan" markers in the page. */
  const inj = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const skip = new Set();
    if (ACTIVE && ACTIVE.el) skip.add(ACTIVE.el);
    if (ACTIVE_ITEM) skip.add(ACTIVE_ITEM);
    const hits = [...d.querySelectorAll("[class]")].filter(e => {
      if (skip.has(e)) return false;
      return /__(edit|hilite)/.test(e.className);
    }).length;
    const empty = [...d.querySelectorAll('[class=""]')].length;
    return { hits, empty };
  });
  ok(inj.hits === 0, "no orphan editor markers in the page (got " + inj.hits + ")");

  /* ---------- G. export ---------- */
  console.log("\n=== G. export is clean ===");
  const out = await page.evaluate(() => serialize() || "");
  const src = require("fs").readFileSync(PAGE, "utf8");
  const count = s => (s.match(/<[^>]*class=""[^>]*>/g) || []).length;
  /* The Aura export ships a few class="" of its own — compare, don't blacklist. */
  console.log("  class=\"\" count — export: " + count(out) + "  source: " + count(src));
  ok(!/maxlength|data-max|data-lim|fld-h/.test(out), "no editor attributes in the export");
  ok(count(out) <= count(src), "no NEW empty class attributes (" + count(out) + " vs " + count(src) + " in the source)");
  ok(out.includes("Move. Breathe. Return."), "the h1 edit is in the export");
  ok(out.includes("Aurora"), "the logo edit is in the export");

  console.log("\n========================================");
  console.log("  " + passed + " passed, " + failed + " failed");
  console.log("========================================");
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("HARNESS FAIL:", e); process.exit(1); });
