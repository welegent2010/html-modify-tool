/* Regression test for the v6.4 collapsed-field chip layout.
   The user's complaint: "right rail dumps everything; click selection anxiety".
   The new contract:
     - default state of the panel is empty (panel-empty hint)
     - clicking a section chip lists every ownItem as a collapsed chip —
       one row each, a kind badge, a short preview, a chevron
     - clicking a chip opens the editor (CURRENT + inputs + meter); any
       previously opened chip closes
     - clicking a card chip opens a card view where the SAME collapse
       rules apply
   This file exercises that contract on classes.html + a couple of other
   real pages, with strict assertions about how many editors are open
   at any moment.
*/
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");
const { pathToFileURL } = require("url");

const EDITOR = pathToFileURL("/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/html-editor.html").href;
const SITE   = "/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/html/site-files/";

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log("  \u2713 " + msg); }
  else { fail++; console.log("  \u2717 FAIL: " + msg); }
}

const frameEval = (page, fn, arg) => page.evaluate(({ src, a }) => {
  const d = document.getElementById("frame").contentDocument;
  return new Function("d", "a", "return (" + src + ")(d, a)")(d, a);
}, { src: fn.toString(), a: arg === undefined ? null : arg });

async function waitForSecs(page, n, ms = 14000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const c = await page.locator(".sec").count();
    if (c >= n) return c;
    await page.waitForTimeout(150);
  }
  return await page.locator(".sec").count();
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", e => console.log("  [pageerror]", e.message, (e.stack || "").split("\n").slice(0,3).join(" | ")));

  await page.goto(EDITOR);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);

  console.log("\n=== A. before any click — panel is empty ===");
  ok(await page.locator("#panelBody .panel-empty").count() === 1, "panel shows the empty hint");
  ok(await page.locator(".field").count() === 0, "no fields rendered before any click");

  await page.locator("#fileInput").setInputFiles(SITE + "classes.html");
  await waitForSecs(page, 7);
  await page.waitForTimeout(800);
  const empty1 = await page.locator("#panelBody .panel-empty").count();
  const fields1 = await page.locator(".field").count();
  const edits1 = await page.locator(".field-edit").count();
  console.log("    [diag] empty=", empty1, "fields=", fields1, "edits=", edits1);
  ok(empty1 === 0, "panel populated after page load (first section selected)");
  ok(fields1 > 0, `first section surfaces as ${fields1} collapsed chips`);
  ok(edits1 === 0, "every chip is collapsed — no editor expanded yet");

  console.log("\n=== B. clicking a section chip lists chips only ===");
  const secIndex = await page.$$eval(".sec", els => els.findIndex(e => /practice for every/i.test(e.textContent)));
  ok(secIndex >= 0, "found 'practice for every' section");
  await page.locator(".sec").nth(secIndex).click();
  await page.waitForTimeout(300);

  const fieldsSec = await page.locator(".field").count();
  const editsSec  = await page.locator(".field-edit").count();
  const cardsSec  = await page.locator(".card-chip").count();
  ok(fieldsSec >= 1, `ownItems surface as chips (${fieldsSec})`);
  ok(editsSec === 0, `zero editors open after section click (got ${editsSec})`);
  ok(cardsSec >= 6, `card navigation also rendered as chips (${cardsSec})`);

  /* chips carry a kind badge + preview text + chevron */
  const firstChipShape = await page.evaluate(() => {
    const f = document.querySelector(".field");
    return {
      kind: f && f.querySelector(".kind") && f.querySelector(".kind").textContent.trim(),
      preview: f && f.querySelector(".ftxt") && f.querySelector(".ftxt").textContent.trim(),
      chevron: f && f.querySelector(".fc-arrow") && f.querySelector(".fc-arrow").textContent.trim(),
    };
  });
  ok(firstChipShape.kind && firstChipShape.kind.length > 0, "chip carries a kind badge");
  ok(firstChipShape.preview && firstChipShape.preview.length > 0, "chip carries a preview");
  ok(firstChipShape.chevron === "\u25be", "chevron points down when collapsed");

  console.log("\n=== C. opening one field closes nothing else (there were none) ===");
  await page.locator(".field").nth(0).locator(".field-chip").click();
  await page.waitForTimeout(250);
  ok(await page.locator(".field.on").count() === 1, "exactly one field is open after the first click");
  ok(await page.locator(".field-edit").count() === 1, "exactly one .field-edit is rendered");

  const openedArrow = await page.locator(".field.on .fc-arrow").textContent();
  ok(openedArrow === "\u25b4", `arrow flips up when open (got "${openedArrow}")`);

  console.log("\n=== D. opening a second chip closes the first ===");
  await page.locator(".field").nth(1).locator(".field-chip").click();
  await page.waitForTimeout(250);
  ok(await page.locator(".field.on").count() === 1, "still exactly one open after switching");
  ok(await page.locator(".field-edit").count() === 1, "still exactly one rendered editor");
  const openedIdx = await page.evaluate(() =>
    [...document.querySelectorAll(".field")].findIndex(f => f.classList.contains("on")));
  ok(openedIdx === 1, "the second chip is the one open now");

  console.log("\n=== E. card view also starts fully collapsed ===");
  await page.locator(".card-chip").nth(0).click();
  await page.waitForTimeout(300);
  ok(await page.locator(".card-chip").count() === 0, "card nav hidden in focused view");
  ok(await page.locator(".field-edit").count() === 0, "card view: no editors open at entry");
  const cardFields = await page.locator(".field").count();
  ok(cardFields >= 5, `card view: every field is a chip row (${cardFields})`);

  console.log("\n=== F. card edit doesn\u2019t leak into a second editor ===");
  await page.locator('.field[data-kind="text"]').first().locator(".field-chip").click();
  await page.waitForTimeout(250);
  const ta = page.locator('.field.on input[data-f="text"]').first();
  /* v6.6 budget: the card title box only fits so many characters, and the
     browser drops anything past maxlength — keep the fixture inside it. */
  const editVal = "EDITED_COL";
  await ta.fill(editVal);
  await page.waitForTimeout(250);
  ok(await page.locator(".field.on").count() === 1, "still one open during typing");

  /* navigate to the BACK control to return to the section overview */
  await page.locator("#backToSection").click();
  await page.waitForTimeout(250);
  ok(await page.locator("#backToSection").count() === 0, "BACK left the card view");
  ok(await page.locator(".field-edit").count() === 0, "BACK left every editor closed");

  console.log("\n=== G. content of the edit survived the round-trip ===");
  const live = await frameEval(page, d => {
    const h3 = [...d.querySelectorAll("h3")].find(el => el.textContent.trim() === "EDITED_COL");
    return !!h3;
  });
  ok(live, "the edit landed inside the iframe");

  console.log("\n=== H. high-density section (header) is also collapsed ===");
  /* classes page header has the most links of any section; verify the
     panel survives that without forcing every input open */
  await page.locator(".sec").nth(0).click();
  await page.waitForTimeout(350);
  const headerFields = await page.locator(".field").count();
  const headerEdits  = await page.locator(".field-edit").count();
  ok(headerFields > 8, `header has ${headerFields} own fields`);
  ok(headerEdits === 0, "header ships fully collapsed");
  ok(headerEdits < headerFields, "fewer open editors than chips");

  console.log(`\n================ ${pass} passed, ${fail} failed ================`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
