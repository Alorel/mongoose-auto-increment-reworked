const requiredDeps = [
  'typescript',
  'custom-tslint-formatters',
  'tslint'
];

const keysToCheck = [
  'dependencies',
  'peerDependencies',
  'devDependencies'
];

const pkg = require('../package.json');

for (const pkgKey of keysToCheck) {
  for (const dep of Object.keys(pkg[pkgKey])) {
    if (!requiredDeps.includes(dep)) {
      delete pkg[pkgKey][dep];
    }
  }
}

const path = require('path');
const fs = require('fs');

fs.writeFileSync(require.resolve('../package.json'), JSON.stringify(pkg, null, 2));