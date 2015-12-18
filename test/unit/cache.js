var should = require('should');
var sinon = require('sinon');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var cache = require(__dirname + '/../../dadi/lib/cache');
var datasource = require(__dirname + '/../../dadi/lib/datasource');
var page = require(__dirname + '/../../dadi/lib/page');
var help = require(__dirname + '/../help');
var config = require(__dirname + '/../../config.js');

describe('Cache', function (done) {
  it('should be a function', function (done) {
    cache.should.be.Function;
    done();
  });

  it('should take a server instance as an argument', function (done) {
    var server = sinon.mock(Server);
    server.object.app = api();

    var method = sinon.spy(server.object.app, 'use');
    cache(server.object).init();

    method.called.should.eql(true);

    server.object.app.use.restore();
    done();
  });

  it('should cache if the app\'s config settings allow', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    var originalCacheSettings = config.get('caching');

    var configStub = sinon.stub(config, 'get');
    configStub.withArgs('caching.directory.enabled').returns(true);
    configStub.withArgs('caching.directory.path').returns(originalCacheSettings.directory.path);
    configStub.withArgs('caching.directory.extension').returns(originalCacheSettings.directory.extension);

    cache(server.object).enabled.should.eql(true);

    configStub.restore();

    done();
  });

  it('should not cache if the app\'s config settings don\'t allow', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    var originalCacheSettings = config.get('caching');

    var configStub = sinon.stub(config, 'get');
    configStub.withArgs('caching.directory.enabled').returns(Boolean('false'));
    configStub.withArgs('caching.directory.path').returns(originalCacheSettings.directory.path);
    configStub.withArgs('caching.directory.extension').returns(originalCacheSettings.directory.extension);

    cache(server.object).enabled.should.eql(true);

    configStub.restore();

    done();
  });

  it('should not cache if the url key can\'t be found in the loaded keys', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        route: {
          paths: ['/actualUrl']
        },
        settings: {
          cache: true
        }
      }
    };

    var req = {
      paths: ['/fakeUrl'],
      url: 'http://www.example.com/fakeUrl'
    };

    cache(server.object).cachingEnabled(req).should.eql(false);

    done();
  });

  it('should cache if the url key can be found in the loaded keys and it allows caching', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        route: {
          paths: ['/actualUrl']
        },
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
  });

  it('should not cache if the url key can be found in the loaded keys but it does not specify options', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        route: {
          paths: ['/actualUrl']
        },
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

    done();
  });

  it('should not cache if the url key can be found in the loaded keys but ?json=true exists in the query', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        route: {
          paths: ['/actualUrl']
        },
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
  });

  it('should cache if the url key can be found in the loaded keys and ?json=false exists in the query', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        route: {
          paths: ['/actualUrl']
        },
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
  });

  it('should not cache if the url key can be found in the loaded keys but it does not allow caching', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        route: {
          paths: ['/actualUrl']
        },
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

    done();
  });
});
