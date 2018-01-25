const version = require('../package').version;
const fs = require('fs');
const readmePath = require('path').resolve(__dirname, '../README.md');

const readmeContents = fs.readFileSync(readmePath, 'utf8')
  .replace(/\?branch=master/g, `?branch=${version}`);

fs.writeFileSync(readmePath, readmeContents);