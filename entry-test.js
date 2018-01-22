const {expect} = require('chai');

describe('Entry', () => {
  let mod;
  
  before('Require module', () => {
    mod = require('./entry');
  });
  
  it('Should export MongooseAutoIncrementID', () => {
    expect(mod.MongooseAutoIncrementID).not.to.be.undefined;
  });
});