const fs = require('fs');
const html = fs.readFileSync('1.html', 'utf8');

let openCount = 0;
let closeCount = 0;
const openRegex = /<div\b/g;
const closeRegex = /<\/div>/g;

for (const match of html.matchAll(openRegex)) {
  openCount++;
  console.log(`Open div at position ${match.index}`);
}

for (const match of html.matchAll(closeRegex)) {
  closeCount++;
  console.log(`Close div at position ${match.index}`);
}

console.log(`Total open: ${openCount}`);
console.log(`Total close: ${closeCount}`);
