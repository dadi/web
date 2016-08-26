var should = require('should');
var sinon = require('sinon');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var cache = require(__dirname + '/../../dadi/lib/cache');
var datasource = require(__dirname + '/../../dadi/lib/datasource');
var page = require(__dirname + '/../../dadi/lib/page');
var help = require(__dirname + '/../help');
var path = require('path')
var config = require(path.resolve(path.join(__dirname, '/../../config')))

describe.skip('Cache', function (done) {
  it('should be a function', function (done) {
    cache.should.be.Function;
    done();
  });

  it('should take a server instance as an argument', sinon.test(function (done) {
    var server = sinon.mock(Server);
    server.object.app = api();

    var method = sinon.spy(server.object.app, 'use');
    cache.reset()
    cache(server.object).init();

    method.called.should.eql(true);
    done();
  }))

  it('should cache if the app\'s config settings allow', sinon.test(function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    var originalCacheSettings = config.get('caching');

    var configStub = sinon.stub(config, 'get');
    configStub.withArgs('caching.directory.enabled').returns(true);
    configStub.withArgs('caching.directory.path').returns(originalCacheSettings.directory.path);
    configStub.withArgs('caching.directory.extension').returns(originalCacheSettings.directory.extension);

    var e = cache(server.object).enabled
    e.should.eql(true);
    done()
  }))

  it('should not cache if the app\'s config settings don\'t allow', sinon.test(function (done) {
    var server = sinon.mock(Server);
    server.object.app = api();

    var originalCacheSettings = config.get('caching');

    var configStub = sinon.stub(config, 'get');
    configStub.withArgs('caching.directory.enabled').returns(Boolean('false'));
    configStub.withArgs('caching.directory.path').returns(originalCacheSettings.directory.path);
    configStub.withArgs('caching.directory.extension').returns(originalCacheSettings.directory.extension);

    cache(server.object).enabled.should.eql(true);
    done();
  }))

  it('should not cache if the url key can\'t be found in the loaded keys', sinon.test(function (done) {
    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        settings: {
          cache: true
        }
      }
    };

    var req = {
      paths: ['/fakeUrl'],
      url: 'http://www.example.com/fakeUrl'
    };
    cache.reset()
    cache(server.object).cachingEnabled(req).should.eql(false);

    done();
  }))

  it('should cache if the url key can be found in the loaded keys and it allows caching', sinon.test(function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        settings: {
          cache: true
        }
      }
    };

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl'
    };

    cache(server.object).cachingEnabled(req).should.eql(true);

    done();
  }))

  it('should not cache if the url key can be found in the loaded keys but it does not specify options', sinon.test(function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        xxx: {
          cache: false
        }
      }
    };

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl'
    };

    cache(server.object).cachingEnabled(req).should.eql(false);

    done()
  }))

  it('should not cache if the url key can be found in the loaded keys but ?json=true exists in the query', sinon.test(function (done) {
    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        xxx: {
          cache: false
        }
      }
    };

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl?json=true'
    };

    cache(server.object).cachingEnabled(req).should.eql(false);

    done();
  }))

  it('should cache if the url key can be found in the loaded keys and ?json=false exists in the query', sinon.test(function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        settings: {
          cache: true
        }
      }
    };

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl?json=false'
    };

    cache(server.object).cachingEnabled(req).should.eql(true);

    done();
  }))

  it('should not cache if the url key can be found in the loaded keys but it does not allow caching', sinon.test(function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        settings: {
          cache: false
        }
      }
    };

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl'
    };

    cache(server.object).cachingEnabled(req).should.eql(false);
    done()
  }))
})
