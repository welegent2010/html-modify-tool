/* Regression test for the "indicator row" (Seats ●●○○) control.
   v6.4: ownItems are collapsed by default; this test now expands the
   field's chip before each meter assertion.

   Covers:
     A. class-driven row   — <span class="dots"><i class="on"></i>…</span>
     B. inline-style row   — <b style="background:#F5BD63"> vs #4A443C
     C. 5-bar row          — count is read from the DOM, not assumed to be 4
     D. decoy row          — uniform colour must produce NO control
     E. control survives collapsing to 0 (cached recipe) and re-opening
     F. the label next to the row is still a normal editable text item
     G. export stays clean (no editor markers, exact bar markup)
*/
const { chromium } = require("playwright");

const EDITOR = "file:///Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html%20modify%20tool/html-editor.html";
const FIXTURE = __dirname + "/_dev-seats.html";

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

/* class attribute of every bar in a row (null when there is no class) */
const barClasses = (page, sel) => frameEval(page,
  (d, s) => [...d.querySelectorAll(s)].map(b => b.getAttribute("class")), sel);

const barColors = (page, sel) => frameEval(page,
  (d, s) => [...d.querySelectorAll(s)].map(b => d.defaultView.getComputedStyle(b).backgroundColor), sel);

const chip = (page, i) => page.locator(`.card-chip[data-card-i="${i}"]`);
async function back(page) {
  await page.locator("#backToSection").click();
  await page.waitForTimeout(160);
}
async function openCard(page, i) {
  await chip(page, i).click();
  await page.waitForTimeout(220);
}
async function openSection(page, i) {
  await page.locator(".sec").nth(i).click();
  await page.waitForTimeout(200);
}

/* In v6.4 the field with the meter is collapsed by default. Walk every
   field's chip until we find the one whose expansion reveals a .meter —
   that's the field we want to drive. Returns the ref of that field. */
async function expandMeterField(page){
  const n = await page.locator(".field").count();
  for (let i = 0; i < n; i++){
    await page.locator(".field").nth(i).locator(".field-chip").click();
    await page.waitForTimeout(140);
    if (await page.locator(".meter").count() > 0){
      return await page.locator(".field").nth(i).getAttribute("data-ref");
    }
  }
  return null;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  await page.goto(EDITOR);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);

  await page.locator("#fileInput").setInputFiles(FIXTURE);
  const n = await waitForSections(page, 2);
  ok(n >= 2, `fixture loaded — ${n} sections detected`);

  /* =========================================================
     A. class-driven row, card 1 (2 of 4 lit)
     ========================================================= */
  console.log("\n=== A. class-driven row — Seats ●●○○ ===");
  {
    const chips = await page.locator(".card-chip").count();
    ok(chips === 5, `5 card chips in section 1 (got ${chips})`);
    await openCard(page, 0);
    ok(await page.locator(".meter").count() === 0, "no meter rendered yet (collapsed default)");

    const meterRef = await expandMeterField(page);
    ok(!!meterRef, "found the field carrying the indicator by clicking chips");

    const bars = await page.locator(".meter-bar").count();
    ok(bars === 4, `control rendered with 4 blocks (got ${bars})`);
    ok((await page.locator(".meter-bar.on").count()) === 2, "2 of them read as lit");
    const readout = (await page.locator(".meter-h .v").textContent()).trim();
    ok(readout === "2 / 4 LIT", `readout shows the detected count (got "${readout}")`);

    /* click block #3 → 3 lit */
    await page.locator('.meter-bar[data-i="2"]').click();
    await page.waitForTimeout(120);
    let cls = await barClasses(page, "#c1 .dots i");
    ok(JSON.stringify(cls) === JSON.stringify(["on", "on", "on", null]),
      `page updated to 3 lit (${JSON.stringify(cls)})`);
    ok((await page.locator(".meter-bar.on").count()) === 3, "panel mirrors 3 lit");

    /* click block #1 → 1 lit */
    await page.locator('.meter-bar[data-i="0"]').click();
    await page.waitForTimeout(120);
    cls = await barClasses(page, "#c1 .dots i");
    ok(JSON.stringify(cls) === JSON.stringify(["on", null, null, null]),
      `page updated to 1 lit (${JSON.stringify(cls)})`);

    /* clicking the last lit block dims it */
    await page.locator('.meter-bar[data-i="0"]').click();
    await page.waitForTimeout(120);
    cls = await barClasses(page, "#c1 .dots i");
    ok(JSON.stringify(cls) === JSON.stringify([null, null, null, null]),
      `clicking the last lit block turns it off (${JSON.stringify(cls)})`);
    ok((await page.locator(".meter-bar.on").count()) === 0, "panel mirrors 0 lit");

    /* D. going all the way to 0 must not lose the control */
    ok((await page.locator(".meter-bar").count()) === 4, "control still there at 0 lit");

    /* E. collapse + leave + come back — the recipe is cached, and the row
          no longer offers two colours to learn from */
    await back(page);
    await openCard(page, 0);
    ok(await page.locator(".meter").count() === 0, "field collapsed again after BACK");
    await expandMeterField(page);
    ok((await page.locator(".meter-bar").count()) === 4,
      "control rebuilt after leaving and re-opening (cached recipe)");
    ok((await page.locator(".meter-bar.on").count()) === 0, "still reads 0 / 4");

    /* quick actions */
    await page.locator('.meter-q[data-q="max"]').click();
    await page.waitForTimeout(120);
    ok((await barClasses(page, "#c1 .dots i")).every(c => c === "on"), "ALL lights every block");
    await page.locator('.meter-q[data-q="0"]').click();
    await page.waitForTimeout(120);
    ok((await barClasses(page, "#c1 .dots i")).every(c => c === null), "NONE dims every block");

    /* back to 2 for the export assertion */
    await page.locator('.meter-bar[data-i="1"]').click();
    await page.waitForTimeout(120);
    cls = await barClasses(page, "#c1 .dots i");
    ok(JSON.stringify(cls) === JSON.stringify(["on", "on", null, null]),
      `back to 2 lit (${JSON.stringify(cls)})`);

    /* F. the word next to the row is still an ordinary text item */
    const labelRef = await page.evaluate((r) => {
      const item = [...document.querySelectorAll(".field")].find(el => el.dataset.ref === r);
      return item ? item.dataset.ref : null;
    }, meterRef);
    ok(labelRef === meterRef, "the same item carries both the indicator and the label");
    const before = await frameEval(page, d => d.querySelector("#c1 .seats").textContent.trim());
    ok(before === "Seats", `label reads "Seats" (got "${before}")`);
    await page.locator(`.field[data-ref="${labelRef}"] [data-f="text"]`).fill("Places");
    await page.waitForTimeout(160);
    const after = await frameEval(page, d => d.querySelector("#c1 .seats").textContent.trim());
    ok(after === "Places", `label replaced, not appended (got "${after}")`);
    ok((await frameEval(page, d => d.querySelectorAll("#c1 .dots i").length)) === 4,
      "the 4 blocks survived the label edit");
    cls = await barClasses(page, "#c1 .dots i");
    ok(JSON.stringify(cls) === JSON.stringify(["on", "on", null, null]),
      "lit state survived the label edit");
  }

  /* =========================================================
     B. other cards — counts are read from the DOM
     ========================================================= */
  console.log("\n=== B. per-card counts ===");
  {
    await back(page);
    await openCard(page, 1);
    await expandMeterField(page);
    ok((await page.locator(".meter-bar").count()) === 4, "card 2 has 4 blocks");
    ok((await page.locator(".meter-bar.on").count()) === 3, "card 2 reads 3 lit");

    await back(page);
    await openCard(page, 2);
    await expandMeterField(page);
    ok((await page.locator(".meter-bar").count()) === 5, "card 3 has 5 blocks (not assumed)");
    ok((await page.locator(".meter-bar.on").count()) === 1, "card 3 reads 1 lit");
    await page.locator('.meter-bar[data-i="4"]').click();
    await page.waitForTimeout(120);
    const c3 = await barClasses(page, "#c3 .dots.wide i");
    ok(JSON.stringify(c3) === JSON.stringify(["on", "on", "on", "on", "on"]),
      `card 3 set to 5 lit (${JSON.stringify(c3)})`);
  }

  /* =========================================================
     C. inline-style row
     ========================================================= */
  console.log("\n=== C. inline-style row ===");
  {
    await back(page);
    await openCard(page, 3);
    await expandMeterField(page);
    ok((await page.locator(".meter-bar").count()) === 3, "card 4 has 3 blocks");
    ok((await page.locator(".meter-bar.on").count()) === 1, "card 4 reads 1 lit");

    await page.locator('.meter-bar[data-i="1"]').click();
    await page.waitForTimeout(120);
    const cols = await barColors(page, "#c4 .bar-row b");
    ok(cols[0] === cols[1], "first two blocks share the lit colour");
    ok(cols[1] !== cols[2], "third block keeps the dim colour");
    ok(cols[0] === "rgb(245, 189, 99)", `lit colour is the page's gold (got ${cols[0]})`);

    const inline = await frameEval(page, d =>
      [...d.querySelectorAll("#c4 .bar-row b")].map(b => b.style.background)
    );
    ok(inline[1] !== inline[2], "the inline style itself was rewritten, not a class added");
    ok((await frameEval(page, d =>
      d.querySelectorAll("#c4 .bar-row b.on, #c4 .bar-row b.is-on").length)) === 0,
      "no invented class was bolted onto the inline-style bars");
  }

  /* =========================================================
     D. opacity-driven row — same colour, dimmed with opacity
     ========================================================= */
  console.log("\n=== D. opacity-driven row ===");
  {
    const opacities = (page) => frameEval(page,
      d => [...d.querySelectorAll("#c5 .caps i")].map(x => d.defaultView.getComputedStyle(x).opacity));

    await back(page);
    await openCard(page, 4);
    await expandMeterField(page);
    ok((await page.locator(".meter-bar").count()) === 4, "card 5 has 4 blocks");
    ok((await page.locator(".meter-bar.on").count()) === 2, "card 5 reads 2 lit");

    await page.locator('.meter-bar[data-i="3"]').click();
    await page.waitForTimeout(120);
    let op = await opacities(page);
    ok(op.every(v => v === "1"), `all four lit (${JSON.stringify(op)})`);

    await page.locator('.meter-q[data-q="0"]').click();
    await page.waitForTimeout(120);
    op = await opacities(page);
    ok(op.every(v => Number(v) < 1), `NONE dims all four (${JSON.stringify(op)})`);

    await page.locator('.meter-bar[data-i="1"]').click();
    await page.waitForTimeout(120);
    op = await opacities(page);
    ok(Number(op[1]) === 1 && Number(op[2]) < 1, `back to 2 lit (${JSON.stringify(op)})`);
  }

  /* =========================================================
     E. decoy — a uniform decorative row gets no control
     ========================================================= */
  console.log("\n=== E. uniform decoy row ===");
  {
    await back(page);
    await openSection(page, 1);
    /* no field has been expanded yet; expected: zero .meter in the DOM */
    const meters = await page.locator(".meter").count();
    ok(meters === 0, `no indicator control on the decoy section (got ${meters})`);
    const statusItem = await page.evaluate(() => {
      const item = [...document.querySelectorAll(".field")].find(el => {
        const t = el.querySelector(".ftxt");
        return t && t.textContent.includes("Status");
      });
      return item ? !!item.querySelector(".meter") : null;
    });
    ok(statusItem === false || statusItem === null, "the Status chip carries no indicator block even after expansion");
  }

  /* =========================================================
     F. export
     ========================================================= */
  console.log("\n=== F. autosaved document ===");
  {
    await page.waitForTimeout(1200);
    const saved = await page.evaluate(() => {
      const out = [];
      for (const k of Object.keys(localStorage)) {
        try {
          const v = JSON.parse(localStorage.getItem(k));
          if (v && v.current) out.push(v.current);
        } catch (e) {}
      }
      return out.join("\n");
    });
    ok(saved.length > 0, "autosave produced a document");
    ok(saved.includes("<i class=\"on\"></i><i class=\"on\"></i><i></i><i></i>"),
      "card 1 exports the exact 2-of-4 markup");
    ok(saved.includes("<i class=\"on\"></i><i class=\"on\"></i><i class=\"on\"></i><i class=\"on\"></i><i class=\"on\"></i>"),
      "card 3 exports 5 lit blocks");
    ok(saved.includes("Places"), "contains the renamed label");
    ok((saved.match(/opacity:\s*1(?![\d.])/g) || []).length === 2,
      "card 5 exports exactly 2 lit blocks (opacity driven)");
    ok(!saved.includes("__edit-"), "no editor markers leaked into the export");
    const empties = saved.match(/<[^>]*class=""[^>]*>/g);
    ok(!empties, "no empty class=\"\" attributes left behind" +
      (empties ? " — " + empties.slice(0, 6).join("  |  ") : ""));
  }

  console.log(`\n========================================`);
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log(`========================================`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
