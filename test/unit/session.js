var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);

var fs = require('fs');
var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
var _ = require('underscore');

var session = require('express-session');
var mongoStore;
if (nodeVersion < 1) {
  mongoStore = require('connect-mongo/es5')(session);
}
else {
  mongoStore = require('connect-mongo')(session);
}

var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var Page = require(__dirname + '/../../dadi/lib/page');
var Controller = require(__dirname + '/../../dadi/lib/controller');
var Preload = require(__dirname + '/../../dadi/lib/datasource/preload');
var help = require(__dirname + '/../help');
var path = require('path')
var remoteProvider = require(__dirname + '/../../dadi/lib/providers/remote')

var config
var testConfigString
var configKey = path.resolve(path.join(__dirname, '/../../config'))

var connectionString

function startServer(page) {

  var options = {
    pagePath: __dirname + '/../app/pages',
    eventPath: __dirname + '/../app/events'
  };

  Server.app = api();
  Server.components = {};
  Server.start(function() {
    // create a handler for requests to this page
    var controller = Controller(page, options);

    Server.addComponent({
        key: page.key,
        routes: page.routes,
        component: controller
    }, false);
  });
}

function cleanup(done) {
  Server.stop(function() {
    done();
  });
}

describe('Session', function (done) {
  before(function(done) {
    Preload().reset()
    // reset config
    delete require.cache[configKey]
    config = require(configKey)
    testConfigString = fs.readFileSync(config.configPath()).toString()
    done()
  })

  beforeEach(function(done) {
    // reset config
    delete require.cache[configKey]
    config = require(configKey)

    config.loadFile(path.resolve(config.configPath()))

    connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

    done();
  });

  afterEach(function(done) {
    fs.writeFileSync(config.configPath(), testConfigString)
    delete require.cache[configKey]
    config = require(configKey)
    config.loadFile(config.configPath())

    done();
  });

  it('should set a session cookie', function(done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.api.enabled = false
    newTestConfig.sessions = {
      enabled: true,
      name: 'dadiweb.sid'
    }

    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    delete require.cache[configKey]
    config = require(configKey)
    config.loadFile(config.configPath())

    // create a page
    var name = 'test';
    var schema = help.getPageSchema();
    var page = Page(name, schema);

    page.contentType = 'application/json';
    page.template = 'session.dust';
    page.routes[0].path = '/session';
    page.datasources = [];
    page.events = ['session'];

    // provide API response
    var results = { results: [{"make": "ford"}] }
    var providerStub = sinon.stub(remoteProvider.prototype, 'load')
    providerStub.yields(null, results)

    startServer(page);

    var client = request(connectionString);

    client
    .get(page.routes[0].path)
    .expect(200)
    .expect('content-type', page.contentType)
    .expect(help.shouldSetCookie('dadiweb.sid'))
    .end(function (err, res) {
      if (err) return done(err);

      providerStub.restore()
      cleanup(done);
    });
  })

  it('should have a session object attached to the request', function(done) {
    var newTestConfig = JSON.parse(testConfigString)
    newTestConfig.api.enabled = false
    newTestConfig.sessions = {
      enabled: true,
      name: 'dadiweb.sid'
    }

    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    delete require.cache[configKey]
    config = require(configKey)
    config.loadFile(config.configPath())

    // create a page
    var name = 'test';
    var schema = help.getPageSchema();
    var page = Page(name, schema);

    page.contentType = 'application/json';
    page.template = 'session.dust';
    page.routes[0].path = '/session';
    page.datasources = [];
    page.events = ['session'];

    startServer(page);

    var client = request(connectionString);

    client
    .get(page.routes[0].path)
    .expect(200)
    .expect('content-type', page.contentType)
    .end(function (err, res) {
        if (err) return done(err);

        var data = JSON.parse(JSON.stringify(res.body));
        (data.session_id !== null).should.eql(true);

        cleanup(done);
    });
  })

  it('should not set a session cookie if sessions are disabled', function(done) {
    var newTestConfig = JSON.parse(testConfigString)
    delete newTestConfig.data
    newTestConfig.api.enabled = false
    newTestConfig.sessions = {
      enabled: false,
      name: 'dadiweb.sid'
    }

    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

    delete require.cache[configKey]
    config = require(configKey)
    config.loadFile(config.configPath())

    // create a page
    var name = 'test';
    var schema = help.getPageSchema();
    var page = Page(name, schema);

    page.contentType = 'application/json';
    page.template = 'session.dust';
    page.routes[0].path = '/session';
    page.datasources = [];
    page.events = ['session'];

    startServer(page);

    var client = request(connectionString);

    client
    .get(page.routes[0].path)
    .expect(help.shouldNotHaveHeader('Set-Cookie'))
    .end(function (err, res) {
        if (err) return done(err);

        cleanup(done);
    });
  })

  describe('Store', function(done) {
    it('should use an in-memory store if none is specified', function(done) {
      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.api.enabled = false
      newTestConfig.sessions = {
        enabled: true,
        store: ''
      }

      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

      delete require.cache[configKey]
      config = require(configKey)
      config.loadFile(config.configPath())

      ;(Server.getSessionStore(config.get('sessions')) === null).should.eql(true);

      done();
    });

    it('should use a MongoDB store if one is specified', function(done) {

      config.set('sessions.store', 'mongodb://localhost:27017/test');

      var store = Server.getSessionStore(config.get('sessions'));
      (typeof store).should.eql('object');
      store.options.url.should.eql('mongodb://localhost:27017/test');

      done();
    });

    it('should use a Redis store if one is specified', function(done) {

      config.set('sessions.store', 'redis://localhost:6379');

      var store = Server.getSessionStore(config.get('sessions'));
      (typeof store).should.eql('object');
      store.client.address.should.eql('localhost:6379');

      done();
    });

    it('should throw error if an in-memory session store is used in production', function(done) {

      config.set('api.enabled', false);
      config.set('sessions.enabled', true);
      config.set('sessions.name', 'dadiweb.sid');
      config.set('sessions.store', '');
      config.set('env', 'production');

      // create a page
      var name = 'test';
      var schema = help.getPageSchema();
      var page = Page(name, schema);

      page.contentType = 'application/json';
      page.template = 'session.dust';
      page.routes[0].path = '/session';
      page.datasources = [];
      page.events = ['session'];

      should.throws(function() { startServer(page); }, Error);

      config.set('env', 'test');

      cleanup(done);
    })
  });

})
