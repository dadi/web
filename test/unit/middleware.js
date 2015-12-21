var path = require('path');
var should = require('should');
var sinon = require('sinon');
var log = require(__dirname + '/../../dadi/lib/log');
var middleware = require(__dirname + '/../../dadi/lib/middleware');
var help = require(__dirname + '/../help');

describe('Middleware', function (done) {
  it('should export constructor', function (done) {
    middleware.Middleware.should.be.Function;
    done();
  });

  it('should export a `load()` function', function (done) {
    middleware('test', {}).load.should.be.Function;
    done();
  });

  it('should export a `init()` function', function (done) {
    middleware('test', {}).init.should.be.Function;
    done();
  });

  it('should export function that returns an instance', function (done) {
    middleware.should.be.Function;
    middleware('test', {}).should.be.an.instanceOf(middleware.Middleware);
    done();
  });

  it('should attach name', function (done) {
    middleware('test', {}).name.should.eql('test');
    done();
  });

  it('should attach default `options`', function (done) {
    middleware('test').options.should.eql({});
    done();
  });

  it('should attach specified `options`', function (done) {
    middleware('test',{cache: true}).options.cache.should.eql(true);
    done();
  });

  it('should throw error if specified page name is not specified', function (done) {
    var pageName = null;
    var eventName = 'car-reviews';

    should.throws(function() { e(pageName, eventName, {}) }, Error);

    done();
  });

  it('should use the attached middleware');

  it('should throw errors when they occur in the attached middleware');//, function (done) {

    //var mware = middleware('test', { "middlewarePath": path.join(__dirname, '../app/middleware') });

    // should.throws(function() {
    //   mware.init(app)({}, {}, data, function(err, result) {
    //   })
    // });
    //
    // done();

//  });

  it('should load the referenced middleware file from the filesystem', function (done) {

    var mware = middleware('test', { "middlewarePath": path.join(__dirname, '../app/middleware') });
    var file = mware.load();

    var expected = require(path.join(__dirname, '../app/middleware/test.js'));

    file.should.eql(expected);
    done();
  })

  it('should throw an error if the referenced middleware file can\'t be found', function (done) {

    var mware = middleware('MISSING', { "middlewarePath": path.join(__dirname, '../app/middleware') });
    var file = mware.loadEvent;

    should.throws(function() { mware.load() } );
    done();
  })

});
