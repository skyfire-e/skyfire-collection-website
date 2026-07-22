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
await page.waitForNetworkIdle({ idleTime: 5000 });

const structure = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('img[src*="sitesv-images"]'));
  
  return imgs.map((img, idx) => {
    // Walk up the DOM tree to find the grid cell / content container
    let el = img.parentElement;
    let container = null;
    let depth = 0;
    
    while (el && depth < 8) {
      const tag = el.tagName.toLowerCase();
      const cls = el.className || '';
      
      // Check if this looks like a grid cell or content block
      if (tag === 'td' || tag === 'th' || cls.includes('cell') || cls.includes('grid') || cls.includes('column') || cls.includes('row') || tag === 'section') {
        container = el;
        break;
      }
      
      // If we reach body or main, stop
      if (tag === 'main' || tag === 'body' || el.getAttribute('role') === 'main') {
        container = el;
        break;
      }
      
      el = el.parentElement;
      depth++;
    }
    
    // Extract all text from the container
    const containerTexts = [];
    if (container) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text && text.length > 0) {
          containerTexts.push(text);
        }
      }
    }
    
    // Get the direct parent's text
    const parent = img.parentElement;
    const parentText = parent ? parent.textContent.trim() : '';
    
    // Get previous sibling's text (sometimes captions are before or after)
    const prevSib = img.previousElementSibling;
    const nextSib = img.nextElementSibling;
    
    return {
      idx,
      alt: img.alt,
      parentTag: parent?.tagName,
      parentClass: parent?.className?.slice(0, 200),
      containerTag: container?.tagName,
      containerClass: container?.className?.slice(0, 200),
      prevSibTag: prevSib?.tagName,
      prevSibText: prevSib?.textContent?.trim()?.slice(0, 200),
      nextSibTag: nextSib?.tagName,
      nextSibText: nextSib?.textContent?.trim()?.slice(0, 200),
      parentText: parentText.slice(0, 300),
      containerTexts: containerTexts.filter((t,i,a) => a.indexOf(t)===i).slice(0, 30),
    };
  });
});

writeFileSync('explore_structure2.json', JSON.stringify(structure, null, 2));
console.log(`Structure for ${structure.length} images`);
console.log('First image:');
console.log(JSON.stringify(structure[0], null, 2));
console.log('\nLast image:');
console.log(JSON.stringify(structure[structure.length - 1], null, 2));

await browser.close();
