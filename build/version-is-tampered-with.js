function versionIsTamperedWith() {
  const pkg = require('../package');
  const keys = ['devDependencies', 'peerDependencies'];
  const expected = '^4.0.0 || ^5.0.0';
  
  for (const k of keys) {
    const val = pkg[k].mongoose;
    if (val !== expected) {
      return val;
    }
  }
  
  return false;
}

module.exports = versionIsTamperedWith;

if (process.argv.indexOf('--echo') !== -1) {
  console.log(versionIsTamperedWith() || '0')
}

if (process.argv.indexOf('--exit') !== -1) {
  process.exit(versionIsTamperedWith() ?  1 : 0);
}