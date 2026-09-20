// v6.7 audit — how many pictures does each real page actually contain, and
// how many of them were INVISIBLE to the editor before v6.7?
//
//   img   = <img> elements                      (always detected)
//   bg    = picture boxes styled with a         (new in v6.7)
//           background-image url()
//
// "invisible" is the number of bg pictures that the old scan() — which only
// looked for <img> — could not see at all. Every one of them was a photo the
// user could not swap.
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");
const { pathToFileURL } = require("url");
const fs = require("fs");
const path = require("path");
const ROOT = "/Users/xiaodongwang/Documents/pptprofilo/do/workbaddy/html/html modify tool/";
const EDITOR = pathToFileURL(ROOT + "html-editor.html").href;
const SITE = ROOT + "html/site-files/";

(async () => {
  const pages = fs.readdirSync(SITE).filter(f => /\.html?$/i.test(f)).sort();
  if (!pages.length){ console.log("no pages in " + SITE); process.exit(0); }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(EDITOR);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);

  let totImg = 0, totBg = 0, totItems = 0;
  const rows = [];

  for (const f of pages){
    await page.evaluate(() => { ACTIVE = null; SECTIONS = []; });
    await page.locator("#fileInput").setInputFiles(SITE + f);
    await page.waitForTimeout(7000);

    const r = await page.evaluate(() => {
      const all = [];
      const walk = items => items.forEach(it => all.push(it));
      SECTIONS.forEach(s => { walk(s.ownItems); s.cards.forEach(c => walk(c.items)); });
      const imgs = all.filter(it => it.kind === "image");
      return {
        sections: SECTIONS.length,
        items: all.length,
        img: imgs.filter(it => !it.bg).length,
        bg: imgs.filter(it => it.bg).length,
        bgCss: imgs.filter(it => it.bg && it.bgSrc === "css").length,
        texts: all.filter(it => it.kind === "text").length,
        actions: all.filter(it => it.kind === "action").length,
        names: SECTIONS.map(s => s.name).slice(0, 3).join(" / "),
      };
    });

    totImg += r.img; totBg += r.bg; totItems += r.items;
    rows.push([f, r.sections, r.items, r.img, r.bg, r.bgCss, r.texts, r.actions]);
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("page", 22) + pad("secs", 6) + pad("items", 7) + pad("<img>", 7) +
              pad("bg", 5) + pad("bg:css", 8) + pad("text", 7) + "action");
  console.log("-".repeat(72));
  rows.forEach(r => console.log(
    pad(r[0], 22) + pad(r[1], 6) + pad(r[2], 7) + pad(r[3], 7) +
    pad(r[4], 5) + pad(r[5], 8) + pad(r[6], 7) + r[7]));
  console.log("-".repeat(72));
  console.log(pad("TOTAL", 22) + pad("", 6) + pad(totItems, 7) + pad(totImg, 7) + pad(totBg, 5));
  console.log("");
  console.log("pages:                 " + pages.length);
  console.log("image items total:     " + (totImg + totBg));
  console.log("  of which <img>:      " + totImg);
  console.log("  of which bg photos:  " + totBg + "   \u2190 invisible before v6.7");

  await browser.close();
})();
