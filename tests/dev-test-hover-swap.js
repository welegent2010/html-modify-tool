// Regression for the hover-swap detection bug.
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");
const { pathToFileURL } = require("url");
const EDITOR = pathToFileURL("/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/html-editor.html").href;
const FIXTURE = __dirname + "/_dev-hover-swap.html";

let passed = 0, failed = 0;
const ok = (cond, msg) => {
  if (cond){ passed++; console.log("  ok ", msg); }
  else     { failed++; console.log("  FAIL", msg); }
};

async function load(page){
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  await page.locator("#fileInput").setInputFiles(FIXTURE);
  await page.waitForTimeout(7000);
}

async function fillText(page, ref, value){
  const chip = page.locator(`.field[data-ref="${ref}"] .field-chip`);
  await chip.click();
  await page.waitForTimeout(250);
  const inp = page.locator(`.field[data-ref="${ref}"].on input[data-f="text"]`);
  await inp.fill(value);
  await page.waitForTimeout(700);
}

async function gotoSection(page, name){
  await page.evaluate(n => {
    const sec = SECTIONS.find(s => (s.name || "").toLowerCase().includes(n));
    ACTIVE = sec; VIEW = "own"; ACTIVE_CARD = null; ACTIVE_ITEM = null;
    renderStrip(); renderPanel(); paintSelection();
  }, name);
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", e => { failed++; console.log("  FAIL pageerror", e.message); });
  await page.goto(EDITOR);

  console.log("\n=== A. transform-based hover-swap rewrites BOTH labels ===");
  await load(page);
  await gotoSection(page, "transform");
  await fillText(page, "own:1", "Hello");
  const a = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const b = d.getElementById("b1");
    return {
      rest: b.querySelector(".rest").textContent,
      alt:  b.querySelector(".alt").textContent,
      count: b.querySelectorAll("span").length,
    };
  });
  ok(a.rest === "Hello", "rest label is 'Hello'");
  ok(a.alt === "Hello",  "alt label is 'Hello' too (was the bug)");
  ok(a.count === 2,      "no extra spans left behind");

  console.log("\n=== B. opacity-based hover-swap rewrites BOTH labels ===");
  await load(page);
  await gotoSection(page, "opacity");
  await fillText(page, "own:1", "World");
  const b = await page.evaluate(() => {
    const d = document.getElementById("frame").contentDocument;
    const e = d.getElementById("b2");
    return {
      rest: e.querySelector(".rest").textContent,
      alt:  e.querySelector(".alt").textContent,
      count: e.querySelectorAll("span").length,
    };
  });
  ok(b.rest === "World", "rest label is 'World'");
  ok(b.alt === "World",  "alt label is 'World' too");
  ok(b.count === 2,      "no empty spans left behind");

  console.log("\n=== C. stacked-field card stays 2 separate items (no merge) ===");
  await load(page);
  await gotoSection(page, "stacked");
  const c = await page.evaluate(() => {
    return [...document.querySelectorAll(".field")].map(f => ({
      ref: f.dataset.ref,
      kind: f.dataset.kind,
      text: f.querySelector(".ftxt") && f.querySelector(".ftxt").textContent.trim().slice(0, 30),
    }));
  });
  console.log("  chips:", c.map(x => x.ref + ":" + x.kind + ":" + x.text).join(" | "));
  ok(c.filter(x => x.text === "60 Mins").length === 1, "60 Mins is its own item");
  ok(c.filter(x => x.text === "All Levels").length === 1, "All Levels is its own item");

  console.log("\n=== D. editing one field does NOT touch its sibling ===");
  const timeRef = c.find(x => x.text === "60 Mins").ref;
  await fillText(page, timeRef, "90 Mins");
  const dState = await page.evaluate(() => {
    const dd = document.getElementById("frame").contentDocument;
    return [...dd.querySelectorAll(".card .meta span")].map(s => s.textContent.trim());
  });
  ok(dState[0] === "90 Mins",     "edited time is '90 Mins'");
  ok(dState[1] === "All Levels",  "sibling untouched");

  console.log("\n=== E. export is byte-clean ===");
  // Use the editor's own serialize() so markers are stripped the same way
  // a real download would be.
  const exportHtml = await page.evaluate(() => {
    return serialize() || "";
  });
  ok(!/class=""/.test(exportHtml),       'no class="" leftover');
  ok(!/__edit-(mark|on|hover|card)/.test(exportHtml), "no editor marker classes");
  ok(!/<span[^>]*>\s*<\/span>/.test(exportHtml), "no empty span leftovers");

  console.log("\n=== F. three-label hover-swap ===");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  const tripleHtml = `<!doctype html><html><body>
<section id="trip"><h2>Triple</h2>
  <a href="x" style="position:relative;display:inline-block;width:200px;height:40px">
    <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">One</span>
    <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">Two</span>
    <span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)">Three</span>
  </a>
</section>
</body></html>`;
  await page.locator("#pasteInput").evaluate((el, v) => { el.value = v; }, tripleHtml);
  await page.locator("#btnImport").click();  // ensure drawer is open (might have been collapsed)
  await page.waitForTimeout(100);
  // Paste render is wired to Ctrl/Cmd+Enter — plain Enter does nothing
  await page.locator("#pasteInput").press("Control+Enter");
  await page.waitForTimeout(7000);
  const fState = await page.evaluate(() => SECTIONS.map(s => ({ name: s.name, own: s.ownItems.length, cards: s.cards.length })));
  console.log("  sections:", JSON.stringify(fState));
  const fChips = await page.evaluate(() => [...document.querySelectorAll(".field")].map(f => ({
    ref: f.dataset.ref, kind: f.dataset.kind,
    text: f.querySelector(".ftxt") && f.querySelector(".ftxt").textContent.trim().slice(0, 30),
  })));
  console.log("  chips:", JSON.stringify(fChips));
  await gotoSection(page, "triple");
  // own:0 = h2 "Triple"; own:1 = <a> action item
  await fillText(page, "own:1", "All");
  const t = await page.evaluate(() => {
    const dd = document.getElementById("frame").contentDocument;
    return [...dd.querySelectorAll("a span")].map(s => s.textContent);
  });
  ok(t.every(s => s === "All"), "every label is 'All' (got: " + JSON.stringify(t) + ")");

  console.log(`\n========================================= PASS: ${passed}   FAIL: ${failed} =========================================`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();