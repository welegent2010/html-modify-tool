/* Regression test for the "typing appends instead of replacing" bug.
   Covers the markup shapes that triggered it:
     1. <a>plain text</a>
     2. <a><span>label</span><iconify-icon/></a>                       (label + icon)
     3. <a><span>Explore Class</span><span>Explore Classes</span></a>  (hover swap)
     4. <p>simple text</p>
     5. <h4><span>19:30</span><span>Slow Flow</span></h4> inside a card (text leaf w/ nested spans)
   Plus char-by-char typing, repeated edits, icon survival, export cleanliness.
*/
const { chromium } = require("playwright");

const EDITOR = "file:///Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html%20modify%20tool/html-editor.html";
const FIXTURE = __dirname + "/html/_dev-text-replace.html";

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

const frameText = (page, sel) => page.evaluate(s => {
  const d = document.getElementById("frame").contentDocument;
  const el = d.querySelector(s);
  return el ? el.textContent : null;
}, sel);

const frameCount = (page, sel) => page.evaluate(s => {
  const d = document.getElementById("frame").contentDocument;
  return d.querySelectorAll(s).length;
}, sel);

/* find the panel .field chip whose preview text contains `t`
   (v6.4: chip rows are collapsed by default — the .ro "CURRENT" block
   only exists inside the expanded .field-edit) */
const refForOldText = (page, t) => page.evaluate(text => {
  const fields = [...document.querySelectorAll(".field")];
  const hit = fields.find(el => {
    const ftxt = el.querySelector(".ftxt");
    return ftxt && ftxt.textContent.includes(text);
  });
  return hit ? hit.dataset.ref : null;
}, t);

/* expand a field's chip, then fill its text input */
async function editField(page, ref, value) {
  const field = page.locator(`.field[data-ref="${ref}"]`);
  if (await field.count() === 0){
    const all = await page.$$eval(".field", els => els.map(el => ({
      ref: el.dataset.ref, kind: el.dataset.kind,
      preview: (el.querySelector(".ftxt") || {}).textContent,
    })));
    console.log("    [editField] ref=" + ref + " NOT FOUND. Current chips:", JSON.stringify(all));
    return;
  }
  if (await field.locator(".field-edit").count() === 0){
    await field.locator(".field-chip").click();
  }
  await field.locator('[data-f="text"]').first().fill(value);
  await page.waitForTimeout(80);
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

  /* ---------- 1. plain link ---------- */
  console.log("\n=== 1. plain <a>Contact us</a> ===");
  {
    const ref = await refForOldText(page, "Contact us");
    ok(!!ref, "found the item for the plain link");
    if (ref) {
      await editField(page, ref, "Reach out");
      const t = await frameText(page, ".plain");
      ok(t === "Reach out", `text replaced (got "${t}")`);
      ok(!t.includes("Contact"), "old label is gone");
    }
  }

  /* ---------- 2. span label + icon ---------- */
  console.log("\n=== 2. <a><span>Book a Class</span><iconify-icon/></a> ===");
  {
    const ref = await refForOldText(page, "Book a Class");
    ok(!!ref, "found the item for the CTA");
    if (ref) {
      await editField(page, ref, "Reserve a Spot");
      const t = await frameText(page, ".cta");
      ok(t === "Reserve a Spot", `text replaced (got "${t}")`);
      ok(!t.includes("Book"), "old label is gone");
      ok((await frameCount(page, ".cta iconify-icon")) === 1, "icon element survived");
    }
  }

  /* ---------- 3. hover-swap double span (the button that doubled) ---------- */
  console.log("\n=== 3. <a><span>Explore Class</span><span>Explore Classes</span></a> ===");
  {
    const ref = await refForOldText(page, "Explore Class");
    ok(!!ref, "found the item for the swap button");
    if (ref) {
      await editField(page, ref, "Browse Classes");
      const t = await frameText(page, ".swap");
      ok(t === "Browse Classes", `text replaced, not appended (got "${t}")`);
      ok(!t.includes("Explore"), "old label is gone");
      ok((t.match(/Browse Classes/g) || []).length === 1, "no duplicate of the new value");
    }
  }

  /* ---------- 4. simple paragraph ---------- */
  console.log("\n=== 4. <p class=\"calm\">A calm room</p> ===");
  {
    const ref = await refForOldText(page, "A calm room");
    ok(!!ref, "found the item for the paragraph");
    if (ref) {
      await editField(page, ref, "Sunlit studio");
      const t = await frameText(page, "p.calm");
      ok(t === "Sunlit studio", `text replaced (got "${t}")`);
    }
  }

  /* ---------- 5. repeat edits on the same field ---------- */
  console.log("\n=== 5. editing the same field three times ===");
  {
    const ref = await refForOldText(page, "Reach out");
    ok(!!ref, "found the previously edited item");
    if (ref) {
      await editField(page, ref, "Call us");
      await editField(page, ref, "Say hello");
      await editField(page, ref, "Write to us");
      const t = await frameText(page, ".plain");
      ok(t === "Write to us", `last value wins, no residue (got "${t}")`);
    }
  }

  /* ---------- 6. char-by-char typing ---------- */
  console.log("\n=== 6. typing character by character ===");
  {
    const ref = await refForOldText(page, "Sunlit studio");
    ok(!!ref, "found the paragraph item again");
    if (ref) {
      const chip = page.locator(`.field[data-ref="${ref}"] .field-chip`);
      await chip.click();
      await page.waitForTimeout(120);
      const input = page.locator(`.field[data-ref="${ref}"] [data-f="text"]`);
      await input.fill("");
      await input.pressSequentially("Morning light", { delay: 25 });
      await page.waitForTimeout(120);
      const t = await frameText(page, "p.calm");
      ok(t === "Morning light", `final text exact after 13 keystrokes (got "${t}")`);
    }
  }

  /* ---------- 7. card view: nested spans inside a card heading ---------- */
  console.log("\n=== 7. card heading <h4><span>19:30</span><span>Slow Flow</span></h4> ===");
  {
    const chips = await page.locator(".card-chip").count();
    ok(chips === 3, `3 card chips listed in the section (got ${chips})`);
    if (chips === 3) {
      await page.locator(".card-chip").first().click();
      await page.waitForTimeout(200);
      const inCard = await page.locator("#backToSection").count();
      ok(inCard === 1, "single-card panel opened");

      const ref = await refForOldText(page, "19:30");
      ok(!!ref, "found the item for the card heading");
      if (ref) {
        await editField(page, ref, "20:00 Yin & Restore");
        const t = await frameText(page, ".grid .card .time");
        ok(t === "20:00 Yin & Restore", `text replaced (got "${t}")`);
        ok(!t.includes("19:30"), "old time is gone");
        ok(!t.includes("Slow Flow"), "old title is gone");

        /* blur refreshes the derived labels so the panel never shows the
           old heading next to the new value */
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        await page.waitForTimeout(150);
        const sub = await page.locator(".card-sub").textContent();
        ok(sub.trim() === "20:00 Yin & Restore", `card subtitle refreshed (got "${sub.trim()}")`);
      }
    }
  }

  /* ---------- 8. export cleanliness ---------- */
  console.log("\n=== 8. autosaved document ===");
  {
    await page.waitForTimeout(1000);
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
    ok(saved.includes("Write to us"), "contains the newest link label");
    ok(saved.includes("20:00 Yin"), "contains the newest card heading");
    ok(!saved.includes("Explore Classes"), "no stale hover-swap label in the export");
    ok(!saved.includes("Slow Flow"), "no stale card heading in the export");
    ok(!saved.includes("Contact us"), "no stale plain-link label in the export");
    ok(!saved.includes("__edit"), "no editor marker classes leaked into the export");
  }

  console.log(`\n================ ${pass} passed, ${fail} failed ================`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
