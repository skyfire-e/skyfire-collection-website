import { readFileSync } from 'fs';
const html = readFileSync('acrylic-page.html', 'utf8');

// Extract each section and analyze its columns
const sectionRegex = /<section[^>]*class="[^"]*yaqOZd[^"]*"[^>]*>([\s\S]*?)<\/section>/gi;
let secMatch;
let secIdx = 0;

while ((secMatch = sectionRegex.exec(html)) !== null) {
  const sectionContent = secMatch[1];
  secIdx++;
  
  // Skip first section (header/nav)
  if (secIdx === 1) continue;
  
  // Find column divs
  const colRegex = /<div[^>]*class="[^"]*(?:hJDwNd-|AhqUyc-)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  let colMatch;
  let colIdx = 0;
  let found = false;
  
  while ((colMatch = colRegex.exec(sectionContent)) !== null) {
    const colContent = colMatch[1];
    colIdx++;
    
    // Extract all C9DxTc text from this column
    const spanRegex = /<span[^>]*class="[^"]*C9DxTc[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    let spanMatch;
    const texts = [];
    while ((spanMatch = spanRegex.exec(colContent)) !== null) {
      const txt = spanMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (txt) texts.push(txt);
    }
    
    // Find image
    const imgMatch = colContent.match(/<img[^>]*src="([^"]*)"/);
    const imgSrc = imgMatch ? imgMatch[1].substring(0, 80) : 'none';
    
    if (texts.length > 0 && imgSrc !== 'none') {
      found = true;
      console.log(`Section ${secIdx}, Col ${colIdx}: [${texts.join(' | ')}] img=${imgSrc.substring(0, 60)}`);
    }
  }
  
  if (!found) {
    // Try alternate column detection
    const altColRegex = /<div[^>]*class="[^"]*cell[^"]*"[^>]*>/gi;
    const altCols = sectionContent.match(altColRegex);
    if (altCols) {
      console.log(`Section ${secIdx}: ${altCols.length} cell divs (no standard columns found)`);
    }
  }
}
