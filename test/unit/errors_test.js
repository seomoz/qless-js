'use strict';

describe('qless.errors', () => {
  const lseErr = new qless.errors.LuaScriptError('foobar');

  it('can be tested with instanceof', () => {
    expect(lseErr instanceof qless.errors.LuaScriptError).to.eql(true);
    expect(lseErr instanceof qless.errors.ClassNotFound).to.eql(false);
  });

  it('has a descriptive name', () => {
    expect(lseErr.name).to.eql('qless.errors.LuaScriptError');
  });

  it('has a message and stack', () => {
    expect(lseErr.message).to.eql('foobar');
    expect(lseErr.stack).to.match(/errors_test.js/);
  });
});
