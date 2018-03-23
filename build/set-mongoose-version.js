if (process.env.MONGOOSE) {
  const ver = parseInt(process.env.MONGOOSE, 10);
  const pkg = require('../package.json');
  
  const v = require('./version-is-tampered-with')();
  if (v) {
    console.log(`Version overridden by greenkeeper to ${v}. Skipping.`);
    process.exit(0);
  }
  
  switch (ver) {
    case 4:
      pkg.peerDependencies.mongoose = '^4.0.0';
      pkg.devDependencies.mongoose = '^4.0.0';
      pkg.dependencies['@types/mongoose'] = '^4.0.0';
      break;
    case 5:
      pkg.peerDependencies.mongoose = '^5.0.0';
      pkg.devDependencies.mongoose = '^5.0.0';
      pkg.dependencies['@types/mongoose'] = '^5.0.0';
      break;
    default:
      console.log('Skipping: MONGOOSE env variable invalid: ' + process.env.MONGOOSE);
      process.exit(0);
  }
  
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.resolve(__dirname, '../package.json'), JSON.stringify(pkg, null, 2));
  
  const util = require('util');
  console.log(util.inspect(
    {
      dependencies: pkg.dependencies,
      peerDependencies: pkg.peerDependencies,
      devDependencies: pkg.devDependencies
    },
    {colors: true}
  ))
} else {
  console.log('Skipping: MONGOOSE env variable absent or unsupported');
}