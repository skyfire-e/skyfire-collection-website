import { readFileSync, writeFileSync } from 'fs';

const items = JSON.parse(readFileSync('data/items.json', 'utf8'));

// Verify resin prices
console.log('Resin dice:');
const resin = items.filter(i => i.category === 'resin-dice');
resin.forEach((i, idx) => console.log('  ' + (idx+1) + '. "' + i.title + '" price=' + (i.price || '?')));

// Verify metal figurines
console.log('\nMetal figurines:');
const mf = items.filter(i => i.category === 'metal-figurines');
mf.forEach((i, idx) => console.log('  ' + (idx+1) + '. "' + i.title.substring(0,40) + '" price=' + (i.price || '?')));

// Fix: metal figurines prices are shifted (backup has 13, missing Pioneer at pos 7)
// Correct prices for the 13 backup items (Pioneer at pos 7 is missing):
const correctMetalFig = ['102','175','200','40','30','26','100','20','10','10','60','80','25'];
const mf2 = mf.filter(i => !i.title.toLowerCase().includes('pioneer') && !i.title.toLowerCase().includes('martial'));
console.log('\nNon-Pioneer metal fig: ' + mf2.length);
let fixed = 0;
mf2.forEach((item, idx) => {
  if (idx < correctMetalFig.length && item.price !== correctMetalFig[idx]) {
    console.log('  Fix ' + item.title.substring(0,30) + ': $' + item.price + ' -> $' + correctMetalFig[idx]);
    item.price = correctMetalFig[idx];
    fixed++;
  }
});

// Fix resin: items 16 and 17 should be $25 and $7 respectively
const resinFix = ['25', '7']; // Green Dragon Eye = $25, 6d6 Orkish = $7
const resinItems = items.filter(i => i.category === 'resin-dice');
if (resinItems.length === 17) {
  // Items at indices 15 and 16
  const gde = resinItems[15]; // Green Dragon Eye
  const ork = resinItems[16]; // 6d6 Orkish
  console.log('\nResin fix: ' + gde.title.substring(0,30) + ' price=' + gde.price + ' -> $25');
  console.log('Resin fix: ' + ork.title.substring(0,30) + ' price=' + ork.price + ' -> $7');
  gde.price = '25';
  ork.price = '7';
}

writeFileSync('data/items.json', JSON.stringify(items, null, 2), 'utf8');
console.log('\nFixed ' + fixed + ' metal figurine prices');
console.log('Total: ' + items.length);
