var should = require('should');
var sinon = require('sinon');
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

  it('should load the referenced event file from the filesystem')
  it('should throw an error if the referenced event file can\'t be found')
  it('should throw an error if the referenced event file can\'t be loaded')


});
