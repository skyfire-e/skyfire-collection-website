import puppeteer from 'puppeteer-core';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('https://sites.google.com/view/skyf1re/dice/metal-figurines', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

const pioneer = await page.evaluate(() => {
  const allSpans = document.querySelectorAll('.C9DxTc');
  for (const sp of allSpans) {
    if (sp.textContent.includes('Pioneer')) {
      // Walk up to find the column
      let el = sp.parentElement;
      while (el && !el.className.includes('hJDwNd') && !el.className.includes('AhqUyc')) {
        el = el.parentElement;
      }
      if (!el) return { text: sp.textContent.trim(), parent: 'not found' };
      
      const col = el;
      const imgs = col.querySelectorAll('img');
      const bgDivs = col.querySelectorAll('.nQBJnb');
      const h2 = col.querySelectorAll('h2');
      const p = col.querySelectorAll('p');
      
      return {
        text: sp.textContent.trim(),
        imgCount: imgs.length,
        bgCount: bgDivs.length,
        h2Count: h2.length,
        pCount: p.length,
        h2Texts: Array.from(h2).map(h => h.textContent.trim()),
        pTexts: Array.from(p).map(p => p.textContent.trim()),
        imgSrcs: Array.from(imgs).map(i => i.src.substring(0, 60)),
        bgSrcs: Array.from(bgDivs).map(d => d.style.backgroundImage.substring(0, 60)),
        colHtml: col.innerHTML.substring(0, 500),
      };
    }
  }
  return null;
});

console.log(JSON.stringify(pioneer, null, 2));
await browser.close();
