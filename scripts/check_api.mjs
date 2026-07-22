const http = require('http');
http.get('http://localhost:3000/api/items?section=dice&category=stone-dice', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const items = JSON.parse(data);
    console.log(items.length + ' items');
    items.forEach(i => console.log('  ' + i.title + ': ' + (i.images ? i.images.length : '0') + ' images'));
    console.log('Server OK');
  });
});
