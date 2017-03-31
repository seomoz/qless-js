'use strict';

const expect = require('expect.js');
const sinon = require('sinon');
const Process = require('process');

const logger = require('../lib/logger.js');

describe('Logger', () => {
  const formatter = logger.transports.console.formatter;
  const clock = sinon.useFakeTimers(1490648407152);
  const prefix = `${new Date()} | PID ${Process.pid}`;

  afterAll(() => clock.restore());

  it('puts the date in the log', () => {
    const options = {
      level: 'info',
      message: 'message',
    };
    const expected = `${prefix} | INFO | message`;
    expect(formatter(options)).to.eql(expected);
  });

  it('handles metadata', () => {
    const options = {
      level: 'info',
      message: 'message',
      meta: {
        some: 'example',
      },
    };
    const expected = `${prefix} | INFO | message | {"some":"example"}`;
    expect(formatter(options)).to.eql(expected);
  });

  it('handles exception metdata', () => {
    const options = {
      level: 'info',
      message: 'message',
      meta: {
        stack: 'Example stack trace',
      },
    };
    const expected = `${prefix} | INFO | message\nExample stack trace`;
    expect(formatter(options)).to.eql(expected);
  });
});
