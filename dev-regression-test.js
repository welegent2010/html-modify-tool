// v6 full regression suite
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");

const TOOL = "file:///Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/html-editor.html";
const DIR = "/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/html/";

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; console.log("  ✗ FAIL: " + msg); }
}

// wait until at least n section chips exist (page may grow as Tailwind loads)
async function waitForSecs(page, n, timeout = 14000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const c = await page.locator(".sec").count();
    if (c >= n) return c;
    await page.waitForTimeout(300);
  }
  return await page.locator(".sec").count();
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("  [pageerror]", e.message));
  page.on("dialog", d => d.accept());

  await page.goto(TOOL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);

  console.log("\n=== A. Sample hero (no cards) ===");
  await page.locator("#fileInput").setInputFiles(DIR + "_example-hero.html");
  await waitForSecs(page, 1);
  await page.waitForTimeout(500);
  ok(await page.locator(".sec").count() > 0, "sections detected");
  ok(await page.locator(".item").count() > 0, "own items listed");
  ok(await page.locator(".card-chip").count() === 0, "no card chips on non-card page");
  ok(await page.locator(".item-h .tag").count() === 0, "no duplicate .tag row");

  console.log("\n=== B. classes.html — sections & cards ===");
  await page.locator("#fileInput").setInputFiles(DIR + "site-files/classes.html");
  const secCount = await waitForSecs(page, 7);
  await page.waitForTimeout(600);
  ok(secCount >= 7, "8 sections detected (got " + secCount + ")");

  // Click the "A practice for every moment" section
  const targetIdx = await page.evaluate(() => {
    const chips = [...document.querySelectorAll(".sec")];
    return chips.findIndex(c => /practice for every/.test(c.title));
  });
  ok(targetIdx >= 0, "found 'practice for every moment' section");

  await page.locator(".sec").nth(targetIdx).click();
  await page.waitForTimeout(500);
  ok(await page.locator(".card-chip").count() === 6, "6 card chips (got " + await page.locator(".card-chip").count() + ")");
  ok(await page.locator(".item").count() === 2, "OWN shows only 2 section items");
  ok((await page.locator("#backToSection").count()) === 0, "no BACK in OWN view");

  const chipLabels = await page.evaluate(() => [...document.querySelectorAll(".card-chip .cl")].map(e => e.textContent.trim()));
  ok(chipLabels.includes("Vinyasa Flow"), "card chip labelled 'Vinyasa Flow'");
  ok(chipLabels.includes("Prenatal Yoga"), "card chip labelled 'Prenatal Yoga'");

  console.log("\n=== C. focus one card ===");
  await page.locator(".card-chip").nth(0).click();
  await page.waitForTimeout(500);
  ok(await page.locator(".item").count() === 6, "card 1 has 6 items (got " + await page.locator(".item").count() + ")");
  ok(await page.locator("#backToSection").count() === 1, "BACK button present");
  ok(await page.locator(".card-chip").count() === 0, "card nav hidden in focused view");
  const cardHead = await page.locator(".card-head b").textContent();
  ok(/Card 1/.test(cardHead), "header says Card 1");

  // Verify gold outline is on the card inside the iframe
  const marked = await page.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    return doc.querySelectorAll(".__edit-card").length;
  });
  ok(marked === 1, "exactly one card highlighted in preview (got " + marked + ")");

  // Verify section outline also applied
  const secOutline = await page.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    return doc.querySelectorAll(".__edit-on").length;
  });
  ok(secOutline === 1, "section outline applied");

  console.log("\n=== D. edit a value inside the card ===");
  const ta = page.locator(".item textarea").first();
  ok(await ta.count() > 0, "card has a textarea");
  await ta.fill("MODIFIED_TITLE_V6");
  await page.waitForTimeout(400);
  const inIframe = await page.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    return doc.body.textContent.includes("MODIFIED_TITLE_V6");
  });
  ok(inIframe, "edit reflected inside preview iframe");

  console.log("\n=== E. BACK to section ===");
  await page.locator("#backToSection").click();
  await page.waitForTimeout(400);
  ok(await page.locator(".card-chip").count() === 6, "card nav restored after BACK");
  ok(await page.locator("#backToSection").count() === 0, "BACK gone in OWN view");

  console.log("\n=== F. click a card in the preview ===");
  const frame = page.frameLocator("#frame");
  await frame.locator("img").nth(3).click({ timeout: 4000 }).catch(e => console.log("    (img click err)", e.message.split("\n")[0]));
  await page.waitForTimeout(500);
  ok(await page.locator("#backToSection").count() === 1, "preview card click opened a card panel");

  console.log("\n=== G. export preserves edits ===");
  const exported = await page.evaluate(() => {
    const textareas = [...document.querySelectorAll(".item textarea")];
    return textareas.length;
  });
  const html = await page.evaluate(async () => {
    // trigger the export logic by reading serialize indirectly — call export and intercept the Blob
    return new Promise(res => {
      const orig = URL.createObjectURL;
      URL.createObjectURL = (blob) => { 
        blob.text().then(t => res(t));
        return orig.call(URL, blob);
      };
      document.getElementById("btnExport").click();
      setTimeout(() => res("(timeout)"), 3000);
    });
  });
  ok(html.includes("MODIFIED_TITLE_V6"), "exported HTML contains the edit");
  ok(!html.includes("__edit-card"), "exported HTML has no injected selection classes");
  ok(!html.includes("__hilite"), "exported HTML has no injected highlight style");

  console.log("\n=== H. RESET clears everything ===");
  await page.locator("#btnReset").click();
  await page.waitForTimeout(700);
  ok(await page.locator(".sec").count() === 0, "sections cleared");
  ok(await page.locator(".item").count() === 0, "items cleared");
  ok(await page.evaluate(() => document.getElementById("stageEmpty").style.display !== "none"), "empty stage shown");
  ok(await page.locator("#btnReset").isDisabled(), "RESET disabled");
  ok(await page.locator("#btnExport").isDisabled(), "EXPORT disabled");
  const ls = await page.evaluate(() => localStorage.getItem("htmlModifyTool_v4"));
  ok(ls === null, "localStorage cleared");

  console.log("\n=== I. reload after reset stays empty ===");
  await page.reload();
  await page.waitForTimeout(900);
  ok(await page.locator(".sec").count() === 0, "still empty after reload");

  console.log("\n=== J. rapid document switching ===");
  await page.locator("#fileInput").setInputFiles(DIR + "site-files/classes.html");
  const n1 = await waitForSecs(page, 7);
  await page.locator("#fileInput").setInputFiles(DIR + "_example-hero.html");
  const n2 = await waitForSecs(page, 1);
  await page.locator("#fileInput").setInputFiles(DIR + "site-files/index.html");
  const n3 = await waitForSecs(page, 1);
  ok(n1 >= 7 && n2 >= 1 && n3 >= 1, "three consecutive loads all produced sections (" + [n1, n2, n3].join("/") + ")");
  const fname = await page.locator("#filename").textContent();
  ok(/index\.html/.test(fname), "filename tracks last loaded file");

  console.log("\n=== K. click never navigates ===");
  const urlBefore = await page.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    return doc.location.href;
  });
  await page.frameLocator("#frame").locator("a").first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  const urlAfter = await page.evaluate(() => {
    const doc = document.querySelector("#frame").contentDocument;
    return doc.location.href;
  });
  ok(urlBefore === urlAfter, "iframe URL unchanged after clicking a link");

  await browser.close();
  console.log("\n========================================");
  console.log("PASS: " + pass + "   FAIL: " + fail);
  console.log("========================================");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("HARNESS FAIL:", e); process.exit(1); });