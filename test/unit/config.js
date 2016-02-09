
var sinon = require('sinon');
var fs = require('fs');
var should = require('should');
var request = require('supertest');
var _ = require('underscore');

var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var Page = require(__dirname + '/../../dadi/lib/page');
var Controller = require(__dirname + '/../../dadi/lib/controller');
var help = require(__dirname + '/../help');
var config = require(__dirname + '/../../config');

var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');
var testConfigPath = './config/config.test.json';
var domainConfigPath;

function loadConfig(server) {
  domainConfigPath = './config/' + server.host + ':' + server.port + '.json';

  try {
    var testConfig = JSON.parse(fs.readFileSync(testConfigPath, { encoding: 'utf-8'}));
    testConfig.app.name = 'Domain Loaded Config';
    fs.writeFileSync(domainConfigPath, JSON.stringify(testConfig, null, 2));
  }
  catch (err) {
    console.log(err);
  }
}

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

  try {
    fs.unlinkSync(domainConfigPath);
  }
  catch (err) {
    console.log(err);
  }

  Server.stop(function() {
    done();
  });
}

describe('Config', function (done) {

  afterEach(function(done) {
    done();
  });

  it('should load a domain specific config file if available', function(done) {

    config.set('api.enabled', false);
    loadConfig(config.get('server'));

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

        config.get('app.name').should.eql('Domain Loaded Config');

        cleanup(done);
    });
  });
});
