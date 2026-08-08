const fs = require('fs');
const html = fs.readFileSync('1.html', 'utf8');

const positionsToFind = [95357, 95364, 99068]; // positions we need to find
let lineNumber = 1;
let currentPosition = 0;
let i = 0;

while (currentPosition < html.length && i < positionsToFind.length) {
  const char = html[currentPosition];
  if (char === '\n') {
    lineNumber++;
  }
  if (currentPosition === positionsToFind[i]) {
    console.log(`Position ${positionsToFind[i]} is on line ${lineNumber}`);
    i++;
  }
  currentPosition++;
}
