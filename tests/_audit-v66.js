// v6.6 audit — which real-page elements does the NEW "stacked label" rule
// split that the OLD one kept as a single item?  Every hit must be a genuine
// multi-line label (each line separately editable), never a false positive:
// a false positive costs the user a text field, a false negative destroys
// content (it did: the "SAMA / Yoga Studio" logo lost its second line).
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");
const { pathToFileURL } = require("url");
const BASE = "/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/";
const EDITOR = pathToFileURL(BASE + "html-editor.html").href;
const PAGES = ["index", "classes", "about", "coaching", "membership", "retreat",
               "booking", "blog", "contact", "shop", "members", "legal", "404", "link-inbio"];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on("pageerror", e => console.log("  PAGEERROR", e.message));
  await page.goto(EDITOR);

  let totalDiff = 0;
  for (const name of PAGES){
    await page.evaluate(() => localStorage.clear());
    await page.reload(); await page.waitForTimeout(300);
    await page.locator("#fileInput").setInputFiles(BASE + "html/site-files/" + name + ".html");
    await page.waitForTimeout(7000);

    const rep = await page.evaluate(() => {
      const doc = document.getElementById("frame").contentDocument;
      const win = doc.defaultView;

      /* ---- v6.5 judge: direct element children with block-level display ---- */
      function oldStacked(el){
        const kids = [];
        for (const c of el.children){
          if (c.tagName === "BR" || c.tagName.indexOf("ICONIFY") === 0) continue;
          if (!c.textContent || !c.textContent.trim()) continue;
          kids.push(c);
        }
        let n = 0;
        for (const c of kids){
          const cs = win.getComputedStyle(c);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const d = cs.display;
          if (d === "block" || d === "flex" || d === "grid" || d === "list-item" ||
              d === "table" || d === "table-row" || d === "flow-root") n++;
        }
        return n;
      }

      const diffs = [];
      let oldRunning = 0, newRunning = 0;
      SECTIONS.forEach(sec => {
        for (const ch of [...sec.el.children]){
          if (ch.tagName !== "A" && ch.tagName !== "BUTTON") continue;
          const o = oldStacked(ch) >= 2;
          const n = stackedTextBlocks(ch) >= 2;
          if (o !== n){
            diffs.push({
              tag: ch.tagName,
              cls: String(ch.className).slice(0, 60),
              text: ch.textContent.trim().replace(/\s+/g, " ").slice(0, 50),
              oldSplit: o, newSplit: n,
              lines: stackedTextBlocks(ch),
              kids: ch.children.length,
              rect: (() => { const r = ch.getBoundingClientRect(); return Math.round(r.width) + "x" + Math.round(r.height); })(),
            });
          }
        }
      });
      return {
        diffs,
        own: SECTIONS.reduce((a, s) => a + s.ownItems.length, 0),
        cards: SECTIONS.reduce((a, s) => a + s.cards.length, 0),
        secs: SECTIONS.length,
      };
    });

    const flag = rep.diffs.length ? "  <-- " + rep.diffs.length + " changed" : "";
    console.log(`${name.padEnd(11)} sections=${rep.secs} ownItems=${rep.own} cards=${rep.cards}${flag}`);
    for (const d of rep.diffs){
      totalDiff++;
      console.log(`   · <${d.tag.toLowerCase()}> ${d.rect} kids=${d.kids} lines=${d.lines} oldSplit=${d.oldSplit} newSplit=${d.newSplit} ${JSON.stringify(d.text)}`);
      console.log(`     class="${d.cls}"`);
    }
  }
  console.log("\nTOTAL elements whose treatment changed: " + totalDiff);
  await browser.close();
})();
