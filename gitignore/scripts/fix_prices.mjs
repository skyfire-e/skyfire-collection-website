import { readFileSync, writeFileSync } from 'fs';

const items = JSON.parse(readFileSync('data/items.json', 'utf8'));

// Fix resin-dice: swap prices of last two items
const resin = items.filter(i => i.category === 'resin-dice');
if (resin.length === 17) {
  const last = resin[16]; // 6d6 Orkish - has $25 (should be $7)
  const secondLast = resin[15]; // Green Dragon Eye - has $7 (should be $25)
  const tmp = last.price;
  last.price = secondLast.price;
  secondLast.price = tmp;
  console.log('Fixed resin prices: ' + secondLast.title + ' = $' + secondLast.price + ', ' + last.title + ' = $' + last.price);
}

// Add Pioneer Martian Dice to metal-figurines
const metalFig = items.filter(i => i.category === 'metal-figurines');
console.log('\nMetal figurines: ' + metalFig.length + ' items');
const hasPioneer = metalFig.some(i => i.title.toLowerCase().includes('pioneer') || i.title.toLowerCase().includes('martial'));
if (!hasPioneer) {
  // Find the image files
  const { existsSync } = await import('fs');
  const imgs = [];
  for (let j = 1; j <= 5; j++) {
    const f = 'uploads/metal-figurines-14-' + j + '.jpg';
    if (existsSync(f)) imgs.push('/' + f);
  }
  // Also check backup_scraped
  if (imgs.length === 0) {
    const { copyFileSync } = await import('fs');
    // Copy the backup image if it exists
    for (let j = 1; j <= 5; j++) {
      const src = 'backup_scraped/metal-figurines-14-' + j + '.jpg';
      const dst = 'uploads/metal-figurines-14-' + j + '.jpg';
      if (existsSync(src)) {
        copyFileSync(src, dst);
        imgs.push('/uploads/metal-figurines-14-' + j + '.jpg');
      }
    }
  }
  
  const newItem = {
    id: Date.now(),
    section: 'dice',
    category: 'metal-figurines',
    title: 'Pioneer Martial Dice',
    author: '',
    price: '144',
    recaster: '',
    combatPoints: '',
    status: '',
    image: imgs.length > 0 ? imgs[0] : '/images/default.svg',
    images: imgs,
    createdAt: new Date().toISOString()
  };
  items.push(newItem);
  console.log('Added Pioneer Martian Dice with price $144, images: ' + imgs.length);
}

// Fix metal-figurines prices that might be shifted - actually they seem correct
// But verify the sequence
const metalFigSorted = items.filter(i => i.category === 'metal-figurines');
console.log('\nMetal figurines after fix:');
metalFigSorted.forEach((i, idx) => console.log('  ' + (idx+1) + '. ' + i.title.substring(0,30) + ' $' + (i.price || '?')));

writeFileSync('data/items.json', JSON.stringify(items, null, 2), 'utf8');
console.log('\nDone. Total items: ' + items.length);
