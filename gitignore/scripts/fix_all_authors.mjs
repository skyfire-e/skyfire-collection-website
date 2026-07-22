import { readFileSync, writeFileSync } from 'fs';

const items = JSON.parse(readFileSync('data/items.json', 'utf8'));

// Full source data for ALL dice categories
// Format: { title: correct_author }
const source = {
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
    '3d6 18mm': 'Alchemy Gothic',
  },
  'resin-dice': {
    'Steampunk Cogs': '',
    'Space Galaxy': 'sharp edge',
    'Skyfire': 'sharp edge',
    'Watermelon': '',
    'Aquamarine-Black': 'sharp edge',
    'Fruits': 'Bescon',
    'Blood Drops': 'sharp edge',
    'Seabed': 'Bescon',
    'Purple Universe': 'Fantasy Miniatures',
    'Cyan Crystal': 'Fantasy Miniatures',
    'Liquid Core Eyes': 'cusdie',
    'Purple Crystal': 'cusdie',
    'Resin Prototype d6 Die': 'CyberDiceGames',
    'Green Dragon Eye': 'Endless Charm',
    '6d6 3d printed Orkish dice': '',
    'Sperm': 'liquid core',
  },
  'wooden-dice': {
    'Brown Wood': 'cusdie',
    'Witcher Composite Dice': 'Q-workshop (plastic+wood)',
  },
  'acrylic-dice': {
    'Andromeda': '',
    'Dwarven': 'Q-workshop',
    'Celtic 2d4': 'Q-Workshop',
    'Tricolor Marble': '',
    'Blood Splatter': '',
    'Transparent Blue-Red': 'Q-Workshop',
    'White Pearl': 'Q-Workshop',
    'Standard Black': '',
    'Cyberpunk RED': 'Q-Workshop',
    'Orange': '',
    'Green Blue': '',
    'Green Black': '',
    'Blue Dotted': '',
    'Blue-Black': '',
    'Blue-White': '',
    'Witcher': 'Q-Workshop',
    'Witcher Yennefer': 'Q-Workshop',
    'Bone Macabre': 'Q-Workshop',
    'Dark Green': '',
    'Sicarius Smoke': 'DiceEnvy',
    'Reddish Honey': '',
    'Blue Marble': '10d8',
    'Acid Green': '',
    'Purple Green': '',
    'Coffee': '',
    'Green Marble': '',
    'Yellow Marble': '',
    'Classic small 50d6': '8mm',
    'Nutella': '',
    'Turquoise Marble': '',
    'Honey Glitter': '',
    'Bloody': '',
    'Barbie Pink': '',
    'd100': '',
    'Rainbow': '',
    'Golden': '',
    'Micro Dice': '',
    'Dragon Eye': 'replica, 5d20',
    'Witcher Cat School Composite': 'metal+plastic by Q-workshop',
    'Witcher Triss': 'Q-workshop',
    'Orks 7 edition 20d6': 'Games Workshop',
    'Orks 9 edition 20d6': 'Games Workshop',
    'Orks Kill Team Dice 20d6': 'Games Workshop',
    'Various un-set': '',
    'Classic 5': '',
    'Skaven Dice 2019': 'Games Workshop',
    'Skaven Bloodbowl Dice Set': 'Games Workshop',
    'Death Guard Dice 20d6': 'Games Workshop',
    'Gloomspite Gitz Squig Dice 20d6': 'Games Workshop',
    'Necrons Dice 20d6': 'Games Workshop',
    'End Times Skaven Dice 10d6': 'Games Workshop',
    'Ork Flyboyz Dice 20d6': 'Games Workshop',
    'Skaven Bloodbowl Warpstone Green': 'Games Workshop',
    'Snotling Bloodbowl Dice Set': 'Games Workshop',
    'Huge Witcher d6': 'Q-workshop',
    'Standard d6': '',
    'Gloomspite Gitz Dice 20d6': 'Games Workshop',
    'Helloween': 'cusdie',
  },
  'acrylic-figurines': {
    'Wizard Hat d20': 'PolyHero Parchment',
    "Wizard Shadow with Demon's Eye Orb d20": 'PolyHero',
    '5d6 Poison Vials': 'PolyHero Vicious Venom',
    'Rogue Set': 'PolyHero Nightshade',
    'Grappling Hook, Rope, Skeleton Key': "PolyHero Burglar's Bundle",
    'd20 Lock & Pick': 'PolyHero Cold Iron',
    'Rejuventaion Potion Set': '',
    'Shadow Kingdom Crown Set': '',
    'Cleric Set': 'PolyHero Celestial Ivory',
    'Warrior Reforged Set': 'PolyHero Steel Grey',
    'Wizard Set': 'PolyHero Dragonfire',
    '7d4 Bless Die': 'PolyHero',
    '5d4 Hallowed Hand Grenade': 'PolyHero',
    '3d20 Gems': 'PolyHero',
    'Wizard Hat & Spellbook': 'PolyHero Wizardstone',
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
  },
  'stone-dice': {
    'Moon Style': 'Aquamarine Zircon',
    'Anubis': '',
    'Blood Red': 'Garnet Zircon',
    'Black': 'Raised Obsidian',
    'Cat Style': 'Dichroic Glass',
    'Micro dice': 'Semiprecious stones',
  },
};

// Also handle the resin-dice Led Lighted duplicates
// First Led Lighted (index 0): author ""
// Second Led Lighted (index 1): author "rechargeable"

const fixed = [];
const notFound = [];

items.forEach(item => {
  const catMap = source[item.category];
  if (!catMap) return; // skip miniatures etc.
  
  // Handle special cases
  if (item.category === 'resin-dice') {
    if (item.title === 'Led Lighted') {
      const allLed = items.filter(i => i.category === 'resin-dice' && i.title === 'Led Lighted');
      const idx = allLed.indexOf(item);
      const correct = idx === 0 ? '' : 'rechargeable';
      if (item.author !== correct) {
        fixed.push(`${item.category}: "${item.title}" [#${idx+1}] author "${item.author}" -> "${correct}"`);
        item.author = correct;
      }
      return;
    }
    if (item.title === 'Liquid Core Sperm') {
      const correct = 'liquid core';
      item.title = 'Sperm';
      if (item.author !== correct) {
        fixed.push(`${item.category}: "Liquid Core Sperm" -> "Sperm" author "${correct}"`);
        item.author = correct;
      }
      return;
    }
  }
  
  if (item.category === 'metal-dice' && item.title === 'Metal Dice Item') {
    item.title = '3d6 18mm';
    item.author = 'Alchemy Gothic';
    fixed.push(`${item.category}: "Metal Dice Item" -> "3d6 18mm" author "Alchemy Gothic"`);
    return;
  }
  
  const correctAuthor = catMap[item.title];
  if (correctAuthor !== undefined) {
    if (item.author !== correctAuthor) {
      fixed.push(`${item.category}: "${item.title}" author "${item.author}" -> "${correctAuthor}"`);
      item.author = correctAuthor;
    }
  } else {
    notFound.push(`${item.category}: "${item.title}"`);
  }
});

writeFileSync('data/items.json', JSON.stringify(items, null, 2), 'utf8');

console.log('FIXED:');
fixed.forEach(f => console.log('  ' + f));
if (notFound.length) {
  console.log('\nNOT IN SOURCE MAP:');
  notFound.forEach(n => console.log('  ' + n));
}
console.log('\nTotal: ' + items.length + ' items');
console.log('Fixed: ' + fixed.length + ' author mismatches');
