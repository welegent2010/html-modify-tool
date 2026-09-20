// v6.9 audit — what does the NEW picture detector see that v6.7 did not?
//
//   box      = a childless photo box        (v6.7 behaviour, unchanged)
//   backdrop = a photo behind real content  (NEW — v6.7 skipped these)
//   pseudo   = a photo painted by ::before/::after (NEW)
//
// The point of this run is to eyeball every NEWLY reachable element on real
// pages: each one should be a picture a person would genuinely want to swap,
// never a gradient, a pattern, or a section-sized wrapper that merely has a
// tint. Keep this script: the same run is how v6.10 gets checked.
const { chromium } = require("/Users/xiaodongwang/.workbuddy/binaries/node/workspace/node_modules/playwright");
const { pathToFileURL } = require("url");
const fs = require("fs");
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

  const rows = [];
  const newbies = [];

  for (const f of pages){
    await page.evaluate(() => { ACTIVE = null; SECTIONS = []; });
    await page.locator("#fileInput").setInputFiles(SITE + f);
    await page.waitForTimeout(7000);

    const r = await page.evaluate(() => {
      const all = [];
      SECTIONS.forEach(s => { s.ownItems.forEach(i => all.push(i)); s.cards.forEach(c => c.items.forEach(i => all.push(i))); });
      const imgs = all.filter(it => it.kind === "image");
      const label = it => {
        const el = it.el;
        const cls = (typeof el.className === "string" ? el.className.trim() : "");
        return el.tagName.toLowerCase() + (cls ? "." + cls.split(/\s+/).slice(0,2).join(".") : "");
      };
      /* anything v6.7 could not reach: not a childless photo box */
      const fresh = imgs.filter(it => it.backdrop || it.pseudo).map(it => ({
        el: label(it), kind: it.pseudo ? "pseudo " + it.pseudo : "backdrop",
        w: Math.round(it.el.getBoundingClientRect().width),
        h: Math.round(it.el.getBoundingClientRect().height),
        size: getComputedStyle(it.el).backgroundSize,
        url: (imageSrc(it) || "").replace(/^https?:\/\//, "").split(/[?#]/)[0].split("/").slice(-1)[0],
      }));
      return {
        sections: SECTIONS.length,
        items: all.length,
        img: imgs.filter(it => !it.bg).length,
        box: imgs.filter(it => it.bg && !it.backdrop && !it.pseudo).length,
        back: fresh.filter(x => x.kind === "backdrop").length,
        pseudo: fresh.filter(x => x.kind.startsWith("pseudo")).length,
        fresh,
      };
    });

    rows.push([f, r.sections, r.items, r.img, r.box, r.back, r.pseudo]);
    r.fresh.forEach(x => newbies.push([f].concat([x.el, x.kind, x.w + "x" + x.h, x.size, x.url])));
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("page", 22) + pad("secs", 6) + pad("items", 7) + pad("<img>", 7) +
              pad("box", 5) + pad("backdrop", 10) + "pseudo");
  console.log("-".repeat(72));
  rows.forEach(r => console.log(
    pad(r[0], 22) + pad(r[1], 6) + pad(r[2], 7) + pad(r[3], 7) +
    pad(r[4], 5) + pad(r[5], 10) + r[6]));
  console.log("-".repeat(72));

  console.log("\nnewly reachable elements (v6.7 saw none of these):");
  if (!newbies.length) console.log("  none — the real pages carry no hidden backdrop photos");
  else newbies.forEach(n => console.log("  " + pad(n[0], 22) + pad(n[1].slice(0,34), 36) + pad(n[2], 12) + pad(n[3], 12) + pad(n[4], 14) + (n[5]||"")));

  await browser.close();
})();
