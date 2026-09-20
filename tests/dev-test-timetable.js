/* Regression test — multi-line text rows made of stacked <span>s.

   The bug this locks down: a "card" whose fields are all <span> (e.g. a
   timetable slot: <span>09:00</span><span>Vinyasa Flow</span><span>Maya</span>,
   stacked with display:block) was treated as ONE text leaf, so the panel
   showed 09:00Vinyasa FlowMaya as a single editable value. Typing a space
   rewrote the first text node AND deleted the other two, collapsing three
   styled lines into one and inheriting the first line's font.

   v6.4: ownItems are collapsed by default.  "items" = number of chips;
   "current values" = chip preview text (always available).

   Covers:
     A. every stacked <span> field becomes its own chip
     B. no chip holds the concatenation of several fields
     C. editing one field leaves the sibling fields byte-identical
     D. the styled lines stay separate (block display survives)
     E. a hover-swap button <a><span>rest</span><span class=hover>hover</span></a>
        is still ONE item and still updates BOTH labels
     F. the exported HTML is clean (no markers, no empty class="")
*/
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");
const { pathToFileURL } = require("url");

const EDITOR  = pathToFileURL("/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/html-editor.html").href;
const FIXTURE = __dirname + "/_dev-timetable.html";
const SITE    = __dirname + "/../html/site-files/";

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log("  \u2713 " + msg); }
  else { fail++; console.log("  \u2717 FAIL: " + msg); }
}

async function waitForSections(page, min, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = await page.locator(".sec").count();
    if (n >= min) return n;
    await page.waitForTimeout(150);
  }
  return await page.locator(".sec").count();
}

const frameEval = (page, fn, arg) => page.evaluate(({ src, a }) => {
  const d = document.getElementById("frame").contentDocument;
  return new Function("d", "a", "return (" + src + ")(d, a)")(d, a);
}, { src: fn.toString(), a: arg === undefined ? null : arg });

/* chip preview = the always-rendered short label (works whether the field
   is expanded or not). The .ro CURRENT block only exists post-expansion. */
const currentValues = (page) => page.$$eval(".field .ftxt", els =>
  els.map(e => e.textContent.replace(/^\s*\(empty\)\s*$/i, "").trim()));

/* Fill a field's input — expanding the chip first if needed. */
async function editField(page, fieldRef, value){
  const field = page.locator(`.field[data-ref="${fieldRef}"]`);
  if (await field.locator(".field-edit").count() === 0){
    await field.locator(".field-chip").click();
  }
  await field.locator('[data-f="text"]').first().fill(value);
  await page.waitForTimeout(120);
}

/* Find the data-ref of the field whose chip preview contains needle.
   Returns "own:<i>" / "cd:<ci>:<ii>" — usable for the editor and tests. */
const refForPreview = (page, needle) => page.evaluate(t => {
  const f = [...document.querySelectorAll(".field")].find(el =>
    (el.querySelector(".ftxt") || {}).textContent.includes(t));
  return f ? f.dataset.ref : null;
}, needle);

async function openSection(page, i) {
  await page.locator(".sec").nth(i).click();
  await page.waitForTimeout(220);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", e => console.log("  [pageerror]", e.message));

  await page.goto(EDITOR);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);

  await page.locator("#fileInput").setInputFiles(FIXTURE);
  const n = await waitForSections(page, 1);
  ok(n >= 1, `fixture loaded \u2014 ${n} section(s)`);

  console.log("\n=== A. stacked spans are separate chips ===");
  await openSection(page, 0);
  const items = await currentValues(page);
  console.log("  items:", JSON.stringify(items));
  ok(items.length === 11, `expected 11 chips (h2 + 3 slots x3 + button), got ${items.length}`);
  ok(items.indexOf("09:00") >= 0, "09:00 is its own chip");
  ok(items.indexOf("Sunrise Vinyasa Flow") >= 0, "the class name is its own chip");
  ok(items.indexOf("Maya") >= 0, "the teacher is its own chip");
  ok(items.some(v => v.indexOf("Explore Classes") === 0), "the hover-swap button is one chip");
  ok(await page.locator(".field-edit").count() === 0, "OWN view starts with zero editors expanded");

  console.log("\n=== B. no chip is a concatenation of several fields ===");
  ok(!items.some(v => /^09:00Sunrise/.test(v) || v === "09:00Sunrise Vinyasa FlowMaya"),
     "no chip holds the merged slot text");
  ok(!items.some(v => v.replace(/\s+/g, "") === "0900SunriseVinyasaFlowMaya"),
     "no chip holds the whitespace-stripped merged text");

  console.log("\n=== C. editing one field leaves its siblings alone ===");
  const before = await frameEval(page, d => ({
    t: d.querySelector(".slot .t").textContent,
    n: d.querySelector(".slot .n").textContent,
    p: d.querySelector(".slot .p").textContent,
  }));
  ok(before.t === "09:00" && before.n === "Sunrise Vinyasa Flow" && before.p === "Maya",
     `baseline intact (${before.t} / ${before.n} / ${before.p})`);

  const timeRef = await refForPreview(page, "09:00");
  ok(!!timeRef, "found the 09:00 field ref");
  await editField(page, timeRef, "09:00 ");
  await page.waitForTimeout(220);

  /* clicking a second chip must close the first one (no two editors up) */
  const expandedCount = await page.locator(".field-edit").count();
  ok(expandedCount === 1, `exactly one editor expanded after the edit (got ${expandedCount})`);

  const after = await frameEval(page, d => {
    const s = d.querySelector(".slot");
    return {
      t: s.querySelector(".t").textContent,
      n: s.querySelector(".n").textContent,
      p: s.querySelector(".p").textContent,
      disp: d.defaultView.getComputedStyle(s.querySelector(".t")).display,
    };
  });
  console.log("  after edit:", JSON.stringify(after));
  ok(after.n === "Sunrise Vinyasa Flow", "sibling class name unchanged");
  ok(after.p === "Maya", "sibling teacher unchanged");
  ok(after.t.indexOf("Sunrise") < 0, "the time field did NOT absorb the other fields");

  console.log("\n=== D. the layout stays multi-line ===");
  ok(after.disp === "block", `time field is still display:block (got ${after.disp})`);
  const lines = await frameEval(page, d => {
    const s = d.querySelector(".slot");
    return [".t", ".n", ".p"].map(k => {
      const r = s.querySelector(k).getBoundingClientRect();
      return Math.round(r.top);
    });
  });
  ok(new Set(lines).size === 3, `the three fields still occupy three rows (tops ${lines.join(", ")})`);

  console.log("\n=== E. hover-swap button keeps its v6.1 behaviour ===");
  const bRef = await refForPreview(page, "Explore Classes");
  ok(!!bRef, `button chip found (ref ${bRef})`);
  await editField(page, bRef, "Browse All Classes");
  const btn = await frameEval(page, d => {
    const a = d.querySelector("a.btn");
    return { text: a.textContent.replace(/\s+/g, " ").trim() };
  });
  console.log("  hover-swap:", JSON.stringify(btn));
  ok(btn.text === "Browse All Classes", `label replaced exactly (got "${btn.text}")`);
  ok((btn.text.match(/Browse All Classes/g) || []).length === 1, "no duplicate of the new label");
  ok(btn.text.indexOf("Explore") < 0, "no stale copy left behind");

  console.log("\n=== F. export is clean ===");
  const saved = await page.evaluate(() => (typeof serialize === "function" ? serialize() : ""));
  ok(saved.length > 0, "editor serialiser produced a document");
  ok(!/class=""/.test(saved), 'no empty class="" left behind');
  ok(!/__edit/.test(saved), "no editor marker classes in the export");
  ok(/Sunrise Vinyasa Flow/.test(saved), "the untouched class name survived the export");
  ok(/Browse All Classes/.test(saved), "the button rename survived the export");
  ok(!/Explore Classes/.test(saved), "no stale hover label in the export");

  /* ---------- G. the real page ---------- */
  console.log("\n=== G. real page (classes.html) — edit one field, siblings stay ===");
  await page.locator("#fileInput").setInputFiles(SITE + "classes.html");
  await waitForSections(page, 8);
  await page.waitForTimeout(2000);
  const si = await page.$$eval(".sec", els => els.findIndex(e => /practice for every/i.test(e.textContent)));
  await page.locator(".sec").nth(si).click();
  await page.waitForTimeout(350);
  await page.locator('.card-chip[data-card-i="0"]').click();
  await page.waitForTimeout(350);
  ok(await page.locator(".field-edit").count() === 0, "card view also starts collapsed");

  const meta = await currentValues(page);
  ok(meta.indexOf("60 Mins") >= 0, '"60 Mins" is its own chip on the real page');
  ok(meta.indexOf("All Levels") >= 0, '"All Levels" is its own chip on the real page');
  ok(!meta.some(v => v.replace(/\s+/g, "") === "60MinsAllLevels"), "the two no longer share one chip");

  const pickFn = (d, t) => {
    const el = [...d.querySelectorAll("div.flex.flex-col")].find(e =>
      e.children.length === 2 &&
      [...e.children].every(c => c.tagName === "SPAN") &&
      e.textContent.includes(t) && e.textContent.includes("All Levels"));
    return el ? [...el.children].map(c => c.textContent.trim().replace(/\s+/g, " ")) : null;
  };
  const b4 = await frameEval(page, pickFn, "60 Mins");
  ok(JSON.stringify(b4) === JSON.stringify(["60 Mins", "All Levels"]), `baseline ${JSON.stringify(b4)}`);

  const durRef = await refForPreview(page, "60 Mins");
  await editField(page, durRef, "90 Mins");

  const aft = await frameEval(page, pickFn, "90 Mins");
  console.log("  after edit:", JSON.stringify(aft));
  ok(aft && aft[0] === "90 Mins", "the edited duration took the new value");
  ok(aft && aft[1] === "All Levels", "the sibling level label is byte-identical");
  ok(aft && aft.length === 2, "the wrapper still holds exactly two children");

  await browser.close();
  console.log("\n========================================");
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log("========================================");
  process.exit(fail ? 1 : 0);
})();
