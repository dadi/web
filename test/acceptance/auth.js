var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
// loaded customised fakeweb module
var fakeweb = require(__dirname + '/../fakeweb');
var http = require('http');
var proxyquire =  require('proxyquire');
var _ = require('underscore');

var Controller = require(__dirname + '/../../dadi/lib/controller');
var Page = require(__dirname + '/../../dadi/lib/page');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var help = require(__dirname + '/../help');
var libHelp = require(__dirname + '/../../dadi/lib/help');
var config = require(__dirname + '/../../config.js');

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port');
var apiHost = 'http://' + config.get('api.host') + ':' + config.get('api.port');

var auth = require(__dirname + '/../../dadi/lib/auth');

var tokenResult = JSON.stringify({
  "accessToken": "da6f610b-6f91-4bce-945d-9829cac5de71",
  "tokenType": "Bearer",
  "expiresIn": 2592000
});

function startServer(done) {

  var options = {
    pagePath: __dirname + '/../app/pages',
    eventPath: __dirname + '/../app/events'
  };

  Server.app = api();
  Server.components = {};

  // create a page
  var name = 'test';
  var schema = help.getPageSchema();
  var page = Page(name, schema);

  page.template = 'test.dust';
  page.route.paths[0] = '/test';
  page.settings.cache = false;
  page.datasources = [];
  page.events = [];
  delete page.route.constraint;

  Server.start(function() {

    setTimeout(function() {

      // create a handler for requests to this page
      var controller = Controller(page, options);

      Server.addComponent({
          key: page.key,
          route: page.route,
          component: controller
      }, false);

      done();
    }, 200);
  });
}

describe.only('Auth', function (done) {

  before(function(done) {
    http.clear_intercepts();
    done();
  });

  beforeEach(function(done) {

    // intercept the api test at server startup
    sinon.stub(libHelp, "isApiAvailable").yields(null, true);
    done();
  });

  afterEach(function(done) {
    libHelp.isApiAvailable.restore();
    http.clear_intercepts();
    help.stopServer(done);
  });

  it('should attach to the provided server instance', function (done) {

    config.set('api.enabled', true);

    startServer(function() {
      Server.app = api();
      var server = Server;

      auth(server);
      server.app.all.length.should.eql(1);

      done();
    })
  });

  it('should return error if no token was obtained', function (done) {

    var oldClientId = config.get('auth.clientId');

    config.set('auth.clientId', 'wrongClient');
    config.set('api.enabled', true);

    startServer(function() {
      Server.app = api();
      var server = Server;

      auth(server);

      var client = request(clientHost);
      client
        .get('/')
        .set('Connection', 'keep-alive')
        .expect('content-type', 'text/html')
        .expect(500)
        .end(function (err, res) {
          res.text.indexOf('Credentials not found or invalid: The authorization process failed for the clientId/secret pair provided')
                  .should.be.above(-1);

          config.set('auth.clientId', oldClientId);

          done();
        });
    });    

  });

  it('should return error if api can\'t be reached', function (done) {

    var oldApiHost = config.get('api.host');

    config.set('api.host', 'invalid.url');
    config.set('api.enabled', true);

    startServer(function() {
      Server.app = api();
      var server = Server;

      auth(server);

      var client = request(clientHost);
      client
        .get('/')
        .set('Connection', 'keep-alive')
        .expect('content-type', 'text/html')
        .expect(404)
        .end(function (err, res) {
          console.log('');
          console.log('** ERR:', err);
          console.log('--> res:', res);
          console.log('');

          res.text.indexOf('URL not found: The request for URL \'http://invalid.url:' + config.get('api.port') + config.get('auth.tokenUrl') + '\' returned a 404')
                  .should.be.above(-1);

          config.set('api.host', oldApiHost);

          done();
        });
    });

  });

  /*it('should not error if valid credentials are supplied and a token is returned', function (done) {

    config.set('api.enabled', true);

    http.register_intercept({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/token',
      method: 'POST',
      agent: new http.Agent({ keepAlive: true }),
      headers: { 'Content-Type': 'application/json' },
      body: tokenResult
    });

    delete require.cache['../../dadi/lib/auth'];
    auth = proxyquire('../../dadi/lib/auth', {'http': http});

    startServer(function() {
      setTimeout(function() {

        var client = request(clientHost);
        client
        .get('/test')
        .expect('content-type', 'text/html')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          done();
        });
      }, 200);
    });
  });*/
});
