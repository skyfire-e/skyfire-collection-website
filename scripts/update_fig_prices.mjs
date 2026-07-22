import http from 'http';

const BASE = 'http://localhost:3000';

const priceMap = {
  'Wizard Hat d20 Parchment': 15,
  "Wizard Shadow with Demon's Eye Orb d20": 15,
  '5d6 Poison Vials Vicious Venom': 35,
  'Rogue Set Nightshade': 48,
  "Grappling Hook, Rope, Skeleton Key Burglar's Bundle": 25,
  'd20 Lock & Pick Cold Iron': 25,
  'Rejuventaion Potion Set': 25,
  'Shadow Kingdom Crown Set': 35,
  'Cleric Set Celestial Ivory': 19,
  'Warrior Reforged Set Steel Grey': 19,
  'Wizard Set Dragonfire': 19,
  '7d4 Bless Die': 9,
  '5d4 Hallowed Hand Grenade': 9,
  '3d20 Gems': 9,
  'Wizard Hat & Spellbook Wizardstone': 9,
};

const loginReq = http.request(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const cookies = res.headers['set-cookie'];
    http.get(BASE + '/api/items?section=dice&category=acrylic-figurines', { headers: { Cookie: cookies } }, (r2) => {
      let d = '';
      r2.on('data', c => d += c);
      r2.on('end', () => {
        const items = JSON.parse(d);
        let done = 0, errors = 0;
        function next(i) {
          if (i >= items.length) {
            console.log('\nDone. Updated ' + done + ' items' + (errors ? ', ' + errors + ' unmatched' : ''));
            return;
          }
          const item = items[i];
          const price = priceMap[item.title];
          if (price === undefined) {
            console.log('NO MATCH: "' + item.title + '"');
            errors++;
            next(i + 1);
            return;
          }
          const fd = JSON.stringify({ price });
          const req = http.request(BASE + '/api/items/' + item.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: cookies },
          }, (r3) => {
            let d2 = '';
            r3.on('data', c => d2 += c);
            r3.on('end', () => {
              const r = JSON.parse(d2);
              console.log((done+1) + '. ' + r.title + ' $' + r.price);
              done++;
              next(i + 1);
            });
          });
          req.write(fd);
          req.end();
        }
        next(0);
      });
    });
  });
});
loginReq.write(JSON.stringify({ username: 'admin', password: 'admin123' }));
loginReq.end();
