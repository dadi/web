
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);

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
var help = require(__dirname + '/../help');
var config = require(__dirname + '/../../config');

var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

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
        route: page.route,
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

  afterEach(function(done) {
    config.set('sessions.store', '');
    done();
  });

  it('should set a session cookie', function(done) {

    config.set('api.enabled', false);
    config.set('sessions.enabled', true);
    config.set('sessions.name', 'dadiweb.sid');

    // create a page
    var name = 'test';
    var schema = help.getPageSchema();
    var page = Page(name, schema);

    page.contentType = 'application/json';
    page.template = 'session.dust';
    page.route.paths[0] = '/session';
    page.datasources = [];
    page.events = ['session'];
    delete page.route.constraint;

    startServer(page);

    var client = request(connectionString);

    client
    .get(page.route.paths[0])
    .expect(200)
    .expect('content-type', page.contentType)
    .expect(help.shouldSetCookie('dadiweb.sid'))
    .end(function (err, res) {
        if (err) return done(err);
        cleanup(done);
    });
  })

  it('should have a session object attached to the request', function(done) {

    config.set('api.enabled', false);
    config.set('sessions.enabled', true);
    config.set('sessions.name', 'dadiweb.sid');

    // create a page
    var name = 'test';
    var schema = help.getPageSchema();
    var page = Page(name, schema);

    page.contentType = 'application/json';
    page.template = 'session.dust';
    page.route.paths[0] = '/session';
    page.datasources = [];
    page.events = ['session'];
    delete page.route.constraint;

    startServer(page);

    var client = request(connectionString);

    client
    .get(page.route.paths[0])
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

    config.set('api.enabled', false);
    config.set('sessions.enabled', false);
    config.set('sessions.name', 'dadiweb.sid');

    // create a page
    var name = 'test';
    var schema = help.getPageSchema();
    var page = Page(name, schema);

    page.contentType = 'application/json';
    page.template = 'session.dust';
    page.route.paths[0] = '/session';
    page.datasources = [];
    page.events = ['session'];
    delete page.route.constraint;

    startServer(page);

    var client = request(connectionString);

    client
    .get(page.route.paths[0])
    .expect(200)
    .expect('content-type', page.contentType)
    .expect(help.shouldNotHaveHeader('Set-Cookie'))
    .end(function (err, res) {
        if (err) return done(err);

        cleanup(done);
    });
  })

  describe('Store', function(done) {
    it('should use an in-memory store if none is specified', function(done) {
      config.set('sessions.enabled', true);
      config.set('sessions.store', '');

      (Server.getSessionStore(config.get('sessions')) === null).should.eql(true);

      done();
    });

    it('should use a MongoDB store if one is specified', function(done) {

      config.set('sessions.store', 'mongodb://localhost:27017/test');

      var store = Server.getSessionStore(config.get('sessions'));
      (typeof store).should.eql('object');
      store.options.url.should.eql('mongodb://localhost:27017/test');

      done();
    });

    it('should use a Redis store if one is specified');

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
      page.route.paths[0] = '/session';
      page.datasources = [];
      page.events = ['session'];
      delete page.route.constraint;

      should.throws(function() { startServer(page); }, Error);

      cleanup(done);
    })
  });

})
