const debug = require('debug')('mongoose-auto-increment-reworked');

debug('Picking library variant');

try {
  debug('Importing tslib');
  const tslib = require('tslib');
  
  if (tslib && tslib.__decorate) {
    debug('Tslib version supports __decorate. Picking with-tslib variant.');
    module.exports = require('./variants/with-tslib');
  } else {
    debug('Tslib version does not support __decorate. Picking ./index');
    module.exports = require('./index');
  }
} catch (e) {
  debug('Tslib failed with %s; picking ./index', e.message);
  module.exports = require('./index');
}