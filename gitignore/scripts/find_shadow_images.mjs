import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/stone-dice';
const UPLOAD_DIR = 'uploads';

mkdirSync(UPLOAD_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

// Get ALL elements with image data by querying deeply into shadow roots
const imageData = await page.evaluate(() => {
  const results = [];
  
  function traverse(node, depth) {
    if (!node || !node.nodeType) return;
    
    // Element nodes
    if (node.nodeType === 1) {
      const el = node;
      
      // Check computed background-image
      try {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg.includes('sitesv-images')) {
          const url = bg.replace(/^url\(["']?|["']?\)$/g, '');
          const parentText = el.closest('section')?.textContent?.trim?.()?.slice(0, 200) || '';
          results.push({
            url,
            tag: el.tagName,
            text: parentText,
            depth,
            type: 'background',
          });
        }
      } catch(e) {}
      
      // Check <img> elements
      if (el.tagName === 'IMG' && el.src && el.src.includes('sitesv-images')) {
        results.push({
          url: el.src,
          tag: 'IMG',
          text: el.alt || '',
          depth,
          type: 'img',
        });
      }
      
      // Traverse shadow root
      if (el.shadowRoot) {
        traverse(el.shadowRoot, depth + 1);
      }
      
      // Traverse children
      for (let i = 0; i < el.children.length; i++) {
        traverse(el.children[i], depth + 1);
      }
    }
    
    // DocumentFragment / ShadowRoot
    if (node.nodeType === 11) {
      for (let i = 0; i < node.children.length; i++) {
        traverse(node.children[i], depth + 1);
      }
    }
  }
  
  traverse(document.body, 0);
  return results;
});

console.log(`Found ${imageData.length} image references:`);
imageData.forEach((d, i) => {
  const urlShort = d.url.length > 70 ? d.url.slice(0, 70) + '...' : d.url;
  const textShort = d.text ? d.text.slice(0, 100) : '';
  console.log(`  ${i+1}. [${d.type}] ${urlShort}`);
  if (textShort) console.log(`     text: "${textShort}"`);
});

// Now deduplicate by URL and find unique product images
const seen = new Set();
const unique = imageData.filter(d => {
  if (seen.has(d.url)) return false;
  seen.add(d.url);
  return true;
});

console.log(`\nUnique: ${unique.length}`);
unique.forEach((d, i) => {
  const textShort = d.text ? d.text.slice(0, 80) : '';
  console.log(`  ${i+1}. ${d.url.slice(0, 80)}... ${textShort ? '→ ' + textShort : ''}`);
});

await browser.close();
