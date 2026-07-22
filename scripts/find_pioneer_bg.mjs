import puppeteer from 'puppeteer-core';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('https://sites.google.com/view/skyf1re/dice/metal-figurines', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

const data = await page.evaluate(() => {
  // Find section with Pioneer
  let targetCol = null;
  const allCols = document.querySelectorAll('[class*="hJDwNd-"]');
  for (const col of allCols) {
    if (col.textContent.includes('Pioneer')) {
      targetCol = col;
      break;
    }
  }
  if (!targetCol) return 'No column found';
  
  // Get ALL background images from ALL elements
  const allEls = targetCol.querySelectorAll('*');
  const bgImages = [];
  allEls.forEach(el => {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      bgImages.push({
        tag: el.tagName,
        className: el.className.substring(0, 60),
        bg: bg.substring(0, 120),
      });
    }
  });
  
  // Also check nQBJnb specifically 
  const nqb = targetCol.querySelectorAll('.nQBJnb');
  const nqbData = [];
  nqb.forEach(el => {
    const bg = window.getComputedStyle(el).backgroundImage;
    nqbData.push({
      bg: bg,
      style: el.getAttribute('style') || '',
      html: el.innerHTML.substring(0, 100),
    });
  });
  
  // Also check any style attributes for background
  const styleBgs = [];
  allEls.forEach(el => {
    const s = el.getAttribute('style');
    if (s && s.includes('background')) {
      styleBgs.push({ tag: el.tagName, style: s.substring(0, 150) });
    }
  });
  
  // Get the full column HTML
  return {
    nqbData,
    styleBgs,
    bgImages,
    colHtml: targetCol.innerHTML.substring(0, 2000),
  };
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
