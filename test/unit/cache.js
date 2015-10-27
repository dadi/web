var should = require('should');
var sinon = require('sinon');
var api = require(__dirname + '/../../bantam/lib/api');
var Server = require(__dirname + '/../../bantam/lib');
var cache = require(__dirname + '/../../bantam/lib/cache');
var datasource = require(__dirname + '/../../bantam/lib/datasource');
var page = require(__dirname + '/../../bantam/lib/page');
var help = require(__dirname + '/help');
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

    var req = {
      url: 'http://www.example.com/fakeUrl'
    }

    cache(server.object).cachingEnabled(req).should.eql(false);
    
    done();
  });

  it('should cache if the url key can be found in the loaded keys and it allows caching', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        settings: {
          cache: true
        }
      }
    };

    var req = {
      url: 'http://www.example.com/actualUrl'
    }

    cache(server.object).cachingEnabled(req).should.eql(true);
        
    done();
  });

  it('should not cache if the url key can be found in the loaded keys but it does not specify options', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        xxx: {
          cache: false
        }
      }
    };

    var req = {
      url: 'http://www.example.com/actualUrl'
    }

    cache(server.object).cachingEnabled(req).should.eql(false);
        
    done();
  });

  it('should not cache if the url key can be found in the loaded keys but it does not allow caching', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    server.object.components['/actualUrl'] = {
      page: {
        settings: {
          cache: false
        }
      }
    };

    var req = {
      url: 'http://www.example.com/actualUrl'
    }

    cache(server.object).cachingEnabled(req).should.eql(false);
        
    done();
  });

  it('should attach default `route` to page if not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    delete schema.route;
    page(name, schema).route.should.eql( { 'paths': ['/test'] } );
    done();
  });

  it('should attach specified `route` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    page(name, schema).route.should.eql( { 'paths': ['/car-reviews/:make/:model'] } );
    done();
  });

  it('should attach default `template` to page if not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    delete schema.template;
    page(name, schema).template.should.eql('test.dust');
    done();
  });

  it('should attach specified `template` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    page(name, schema).template.should.eql('car-reviews.dust');
    done();
  });

  it('should attach default `contentType` to page if not specified', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    delete schema.contentType;
    page(name, schema).contentType.should.eql('text/html');
    done();
  });

  it('should attach specified `contentType` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.contentType = 'application/xml'
    page(name, schema).contentType.should.eql('application/xml');
    done();
  });

  it('should attach specified `settings` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.settings.should.exist;
    p.settings.cache.should.exist;
    p.settings.cache.should.be.true;
    done();
  });

  it('should attach specified `datasources` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.datasources.should.exist;
    p.datasources.should.eql(["car-makes"]);
    done();
  });

  it('should attach specified `events` to page', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    var p = page(name, schema);
    p.events.should.exist;
    p.events.should.eql(["car-reviews"]);
    done();
  });

  it('should throw error if specified `route` is not an object', function (done) {
    var name = 'test';
    var schema = help.getPageSchema();
    schema.route = "/test";

    should.throws(function() { page(name, schema) }, Error);
    
    done();
  });

});
