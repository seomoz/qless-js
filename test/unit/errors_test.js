'use strict';

describe('qless.errors', () => {
  const jcfErr = new qless.errors.JobCantFail('foobar');

  it('can be tested with instanceof', () => {
    expect(jcfErr instanceof qless.errors.JobCantFail).to.eql(true);
    expect(jcfErr instanceof qless.errors.ClassNotFound).to.eql(false);
  });

  it('can be a subclass of a another error', () => {
    expect(jcfErr instanceof qless.errors.LuaScriptError).to.eql(true);
  });

  it('has a descriptive name', () => {
    expect(jcfErr.name).to.eql('qless.errors.JobCantFail');
  });

  it('has a message and stack', () => {
    expect(jcfErr.message).to.eql('foobar');
    expect(jcfErr.stack).to.match(/errors_test.js/);
  });
});
