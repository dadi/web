var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
var _ = require('underscore');

var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var Page = require(__dirname + '/../../dadi/lib/page');
var Controller = require(__dirname + '/../../dadi/lib/controller');
var testHelper = require(__dirname + '/../help');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/../../dadi/lib/help');

var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

function startServer(page) {

  var options = {
    datasourcePath: __dirname + '/../app/datasources',
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

describe('Controller', function (done) {

  afterEach(function(done) {
    done();
  });

  it('should return a 404 if a page\'s requiredDatasources are not populated', function(done) {

    config.set('api.enabled', false);

    // create a page
    var name = 'test';
    var schema = testHelper.getPageSchema();
    var page = Page(name, schema);

    page.template = 'test.dust';
    page.route.paths[0] = '/test';
    page.settings.cache = false;

    page.datasources = ['categories'];
    page.events = [];
    page.requiredDatasources = ['categories'];
    delete page.route.constraint;

    startServer(page);

    // provide empty API response
    var results = { results: [] }

    sinon.stub(help, "getData").yields(null, results);

    var client = request(connectionString);

    client
    .get(page.route.paths[0])
    .expect(404)
    .end(function (err, res) {
      if (err) return done(err);
      help.getData.restore();
      cleanup(done);
    });
  })

  it('should return a 200 if a page\'s requiredDatasources are populated', function(done) {

    config.set('api.enabled', false);

    // create a page
    var name = 'test';
    var schema = testHelper.getPageSchema();
    var page = Page(name, schema);

    page.template = 'test.dust';
    page.route.paths[0] = '/test';
    page.settings.cache = false;

    page.datasources = ['categories'];
    page.events = [];
    page.requiredDatasources = ['categories'];
    delete page.route.constraint;

    startServer(page);

    // provide empty API response
    var results = { results: [{_id: 1, title: 'books'}] }

    sinon.stub(help, "getData").yields(null, results);

    var client = request(connectionString);

    client
    .get(page.route.paths[0])
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err);
      help.getData.restore();
      cleanup(done);
    });
  })

})
