import { readFileSync, writeFileSync, existsSync } from 'fs';

const itemsFile = 'data/items.json';
const items = JSON.parse(readFileSync(itemsFile, 'utf8'));
const settings = JSON.parse(readFileSync('data/settings.json', 'utf8'));

console.log('Current items:', items.length);

// 1. Add stone dice
const stoneMapping = JSON.parse(readFileSync('stone-dice-mapping.json', 'utf8'));
console.log('\nAdding stone dice:', stoneMapping.length);
stoneMapping.forEach((m, i) => {
  const imgs = m.images.filter(f => existsSync('uploads/' + f));
  items.push({
    id: Date.now() + i,
    section: 'dice',
    category: 'stone-dice',
    title: m.title,
    author: m.author || '',
    price: '',
    recaster: '',
    combatPoints: '',
    status: '',
    image: imgs.length > 0 ? '/uploads/' + imgs[0] : settings.defaultImage,
    images: imgs.map(f => '/uploads/' + f),
    createdAt: new Date().toISOString()
  });
});

// 2. Check resin-dice from backup - need to add 18th if missing
const resinBackup = JSON.parse(readFileSync('backup_scraped/items.json', 'utf8'))
  .filter(i => i.category === 'resin-dice');
console.log('\nResin dice in backup:', resinBackup.length);

// The backup has 17 resin items. We need 18. Check if the last resin item has an extra image.
// Actually the backup might already be correct. Let me check.

// 3. Check metal-figurines
const metalFigBackup = JSON.parse(readFileSync('backup_scraped/items.json', 'utf8'))
  .filter(i => i.category === 'metal-figurines');
console.log('Metal figurines in backup:', metalFigBackup.length);

// The backup has 13 metal-figurines. We need 14 (Pioneer Martian Dice was added later).
// Check if Pioneer Martian Dice is in the backup
const pioneer = metalFigBackup.filter(i => i.title.toLowerCase().includes('martial') || i.title.toLowerCase().includes('pioneer'));
console.log('Pioneer in backup:', pioneer.length);

// If Pioneer isn't in backup, check backup for it with different title
const pioneerAll = JSON.parse(readFileSync('backup_scraped/items.json', 'utf8'))
  .filter(i => i.title.toLowerCase().includes('martial') || i.title.toLowerCase().includes('pioneer'));
console.log('Pioneer anywhere in backup:', pioneerAll.length, pioneerAll.map(i => i.title));

// Check what image files exist for pioneer
const pioneerFiles = [];
for (let i = 1; i <= 5; i++) {
  for (let j = 1; j <= 5; j++) {
    const f = `metal-figurines-${i}-${j}.jpg`;
    if (existsSync('uploads/' + f)) pioneerFiles.push(f);
    if (existsSync('backup_scraped/' + f)) pioneerFiles.push('backup: ' + f);
  }
}
console.log('Pioneer files check done');

// Save
writeFileSync(itemsFile, JSON.stringify(items, null, 2), 'utf8');
console.log('\nFinal items:', items.length);
