var path = require('path');
var should = require('should');
var sinon = require('sinon');
var log = require(__dirname + '/../../bantam/lib/log');
var e = require(__dirname + '/../../bantam/lib/event');
var help = require(__dirname + '/help');

describe('Event', function (done) {
  it('should export constructor', function (done) {
    e.Event.should.be.Function;
    done();
  });

  it('should export a `loadEvent()` function', function (done) {
    var pageName = 'test';
    var eventName = 'car-reviews';
    e(pageName, eventName, {}).loadEvent.should.be.Function;
    done();
  });

  it('should export a `run()` function', function (done) {
    var pageName = 'test';
    var eventName = 'car-reviews';
    e(pageName, eventName, {}).run.should.be.Function;
    done();
  });

  it('should export function that returns an instance', function (done) {
    e.should.be.Function;
    var pageName = 'test';
    var eventName = 'car-reviews';
    e(pageName, eventName, {}).should.be.an.instanceOf(e.Event);
    done();
  });

  it('should attach name to event', function (done) {
    var pageName = 'test';
    var eventName = 'car-reviews';
    e(pageName, eventName, {}).name.should.eql(eventName);
    done();
  });

  it('should attach page to event', function (done) {
    var pageName = 'test';
    var eventName = 'car-reviews';
    e(pageName, eventName, {}).page.should.eql(pageName);
    done();
  });

  it('should attach default `options` to event', function (done) {
    var pageName = 'test';
    var eventName = 'car-reviews';
    var newEvent = e(pageName, eventName, null);
    newEvent.options.should.eql({});
    done();
  });

  it('should attach specified `options` to event', function (done) {
    var pageName = 'test';
    var eventName = 'car-reviews';
    var newEvent = e(pageName, eventName, { "cache": true });
    newEvent.options.cache.should.be.true;
    done();
  });

  it('should throw error if specified page name is not specified', function (done) {
    var pageName = null;
    var eventName = 'car-reviews';

    should.throws(function() { e(pageName, eventName, {}) }, Error);

    done();
  });

  it('should run the attached event', function (done) {
    var pageName = 'test';
    var eventName = 'test_event';
    var newEvent = e(pageName, eventName, { "eventPath": path.join(__dirname, '../workspace/events') });

    var data = { test: true };
    newEvent.run({}, {}, data, function(err, result) {
      result.should.eql({ test: true, run: true });
      done();
    })
  });

  it('should log errors when they occur in the attached event', function (done) {

    var pageName = 'test';
    var eventName = 'test_event_error';
    var newEvent = e(pageName, eventName, { "eventPath": path.join(__dirname, '../workspace/events') });

    var data = { test: true };

    var logger = newEvent.log;
    var infoMethod = sinon.spy(logger, 'info');
    var errorMethod = sinon.spy(logger, 'error');

    newEvent.run({}, {}, data, function(err, result) {

      logger.info.restore();
      logger.error.restore();
      infoMethod.called.should.eql(true);
      errorMethod.called.should.eql(true);

      done();
    })
  });

  it('should load the referenced event file from the filesystem', function (done) {
    var pageName = 'test';
    var eventName = 'test_event';
    var newEvent = e(pageName, eventName, { "eventPath": path.join(__dirname, '../workspace/events') });

    var file = newEvent.loadEvent();
    var expected = require(path.join(__dirname, '../workspace/events/test_event.js'));

    file.should.eql(expected);
    done();
  })

  it('should throw an error if the referenced event file can\'t be found', function (done) {
    var pageName = 'test';
    var eventName = 'test_event_xxx';
    var newEvent = e(pageName, eventName, { "eventPath": path.join(__dirname, '../workspace/events') });

    should.throws(function() { newEvent.loadEvent() } );
    done();
  })

});
