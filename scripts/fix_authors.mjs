import { readFileSync, writeFileSync } from 'fs';

const items = JSON.parse(readFileSync('data/items.json', 'utf8'));

// Source website data: { title: author }
const correct = {
  'metal-dice': {
    'Dragon': '(hollow)',
    'Dwarven': 'Q-workshop',
    'Edge Boss': 'EnvyDice',
    'Ancient Dragon Gold': 'EasyRoller',
    'Legendary Metals': 'gold, copper, bronze, silver',
    "Assassin's Dice": 'DarkElfDice',
    'Anodized Red': 'aluminum',
    'Skeletons Red': '',
    'Skeletons White': '',
    'Octopus-shaped': 'cusdie',
    'Sword and Shield': 'cusdie',
    'Spiders Web': '(hollow)',
    'Big d20 Edge Skulls': '(hollow)',
    'Cogs': '(hollow)',
    'Dagger Style': 'cusdie',
    'Labyrinth': '(hollow)',
    'Silver Snowflakes': '(hollow)',
    'Edge Skulls': '(hollow)',
    'Dragon Scale': 'cusdie',
    'Spiked Cogs': 'cusdie',
    'Skulls on edges': '',
    'Colorful Framed': '',
    'Skeleton-shaped': 'cusdie',
    '9d6': 'CyberDiceGames',
    'Underwater': 'Bioshock, Ctulhu, Chaos',
    'Stone Stamps': 'cusdie',
    'Elven Ligature': 'cusdie',
    'Flowers': 'cusdie',
    '7d6': 'CyberDiceGames',
  },
  'resin-dice': {
    'Steampunk Cogs': '',
    'Space Galaxy': 'sharp edge',
    'Skyfire': 'sharp edge',
    'Watermelon': '',
    'Aquamarine-Black': 'sharp edge',
    'Fruits': 'Bescon',
    'Blood Drops': 'sharp edge',
    'Led Lighted': '',
    'Seabed': 'Bescon',
    'Led Lighted': '',  // first one has no author, second has "rechargeable" - handled by count
    'Purple Universe': 'Fantasy Miniatures',
    'Cyan Crystal': 'Fantasy Miniatures',
    'Liquid Core Eyes': 'cusdie',
    'Purple Crystal': 'cusdie',
    'Resin Prototype d6 Die': 'CyberDiceGames',
    'Green Dragon Eye': 'Endless Charm',
    '6d6 3d printed Orkish dice': '',
  },
  'wooden-dice': {
    'Brown Wood': 'cusdie',
    'Witcher Composite Dice': 'Q-workshop (plastic+wood)',
  },
  'metal-figurines': {
    'Necromancer set': 'CyberDiceGames',
    'Vortex Bronze': '',
    'Floating Bronze': '',
    'Silver d100': '(hollow)',
    'Ancient Golden d100': '',
    'Dragon Scale d60': '',
    'Pioneer Martial Dice': '',
    'Aztec Gods': 'CyberDiceGames',
    'Arcanum set copy': 'aliexpress',
    'Dice Sword': '',
    'DnD Class Coins': '4',
    'Red Steampunk Spheres': '',
    'Golden Atoms': '',
    'Spiky Dragon-themed': 'cusdie',
  }
};

// Map by title for resin special case (Led Lighted has duplicates)
const resinLedLighted = { 0: '', 1: 'rechargeable' };

const fixed = [];
const missing = [];
const junk = [];

items.forEach(item => {
  if (!correct[item.category]) return; // skip categories not in our map

  const map = correct[item.category];
  
  // Handle special cases
  if (item.category === 'resin-dice' && item.title === 'Led Lighted') {
    // Find which index this is
    const allLed = items.filter(i => i.category === 'resin-dice' && i.title === 'Led Lighted');
    const idx = allLed.indexOf(item);
    const correctAuthor = resinLedLighted[idx];
    if (item.author !== correctAuthor) {
      fixed.push(`${item.category}: "${item.title}" author "${item.author}" -> "${correctAuthor}"`);
      item.author = correctAuthor;
    }
    return;
  }
  
  // Fix Sperm title
  if (item.category === 'resin-dice' && item.title === 'Liquid Core Sperm') {
    item.title = 'Sperm';
    item.author = 'liquid core';
    fixed.push(`${item.category}: "Liquid Core Sperm" -> "Sperm" author "liquid core"`);
    return;
  }
  
  // Rename and fix "Metal Dice Item" -> "3d6 18mm"
  if (item.category === 'metal-dice' && item.title === 'Metal Dice Item') {
    const oldTitle = item.title;
    item.title = '3d6 18mm';
    item.author = 'Alchemy Gothic';
    fixed.push(`${item.category}: "${oldTitle}" -> "3d6 18mm" author "Alchemy Gothic"`);
    return;
  }
  
  const correctAuthor = map[item.title];
  if (correctAuthor !== undefined) {
    if (item.author !== correctAuthor) {
      fixed.push(`${item.category}: "${item.title}" author "${item.author}" -> "${correctAuthor}"`);
      item.author = correctAuthor;
    }
  } else {
    if (item.category !== 'metal-dice' && item.category !== 'resin-dice') {
      // Only report if we expected to find it
      missing.push(`${item.category}: "${item.title}" not found in source map`);
    }
  }
});

writeFileSync('data/items.json', JSON.stringify(items, null, 2), 'utf8');

console.log('Fixes applied:');
fixed.forEach(f => console.log('  ' + f));
if (missing.length) {
  console.log('\nNot in source map:');
  missing.forEach(m => console.log('  ' + m));
}
console.log('\nTotal: ' + items.length + ' items');
