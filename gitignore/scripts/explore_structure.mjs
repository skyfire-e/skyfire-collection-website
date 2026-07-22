import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const url = 'https://sites.google.com/view/skyf1re/dice/metal-dice';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForNetworkIdle({ idleTime: 3000 });

// Get full HTML structure around images
const structure = await page.evaluate(() => {
  // Find the main content area
  const main = document.querySelector('[role="main"]') || document.querySelector('main') || document.body;
  
  // Get all image containers - images seem to be inside grid cells
  const imgs = Array.from(main.querySelectorAll('img[src*="sitesv-images"]'));
  
  return imgs.map((img, idx) => {
    // Walk up to find a reasonable container
    let el = img.parentElement;
    let depth = 0;
    const path = [];
    while (el && el !== main && depth < 6) {
      path.push({
        tag: el.tagName,
        id: el.id,
        class: el.className?.slice(0, 150),
        textContent: el.textContent?.trim()?.slice(0, 200),
        childCount: el.children.length,
      });
      el = el.parentElement;
      depth++;
    }
    
    // Find the nearest text sibling or adjacent element
    const parent = img.parentElement;
    const grandparent = parent?.parentElement;
    const container = grandparent?.parentElement;
    
    // Get all text from siblings and nearby elements
    const allText = [];
    if (container) {
      const textNodes = container.querySelectorAll('*');
      textNodes.forEach(n => {
        const t = n.textContent?.trim();
        if (t && n.children.length === 0 && t.length > 1) {
          allText.push(t);
        }
      });
    }
    
    return {
      idx,
      imgSrc: img.src?.slice(0, 200),
      imgAlt: img.alt,
      imgWidth: img.naturalWidth,
      imgHeight: img.naturalHeight,
      parentTag: parent?.tagName,
      parentClass: parent?.className?.slice(0, 150),
      grandparentTag: grandparent?.tagName,
      grandparentClass: grandparent?.className?.slice(0, 150),
      containerTag: container?.tagName,
      containerClass: container?.className?.slice(0, 150),
      nearbyText: allText.filter((t, i, a) => a.indexOf(t) === i).slice(0, 20),
      ancestorPath: path,
    };
  });
});

writeFileSync('explore_structure.json', JSON.stringify(structure, null, 2));
console.log(`Found ${structure.length} images`);
console.log(JSON.stringify(structure.slice(0, 3), null, 2));

await browser.close();
