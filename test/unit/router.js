var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
var _ = require('underscore');

var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var datasource = require(__dirname + '/../../dadi/lib/datasource');
var Page = require(__dirname + '/../../dadi/lib/page');
var Controller = require(__dirname + '/../../dadi/lib/controller');
var Router = require(__dirname + '/../../dadi/lib/controller/router');
var libHelp = require(__dirname + '/../../dadi/lib/help');
var testHelper = require(__dirname + '/../help');
var config = require(__dirname + '/../../config');

var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

function getPage() {
  // create a page
  var name = 'test';
  var schema = testHelper.getPageSchema();
  var page = Page(name, schema);
  page.contentType = 'application/json';
  page.template = 'test.dust';
  page.route.paths[0] = '/test';
  page.settings.cache = false;
  page.datasources = [];
  page.events = [];
  delete page.route.constraint;
  return page;
}

function cleanup(done) {
  Server.stop(function() {
    done();
  });
}

function cleanupPath(path, done) {
  try {
    fs.unlink(path, function() {
      done();
    });
  }
  catch (err) {
    console.log(err);
  }
}

var constraintsPath = __dirname + '/../app/routes/constraints.js';

describe('Router', function (done) {

  beforeEach(function(done) {
    // write a temporary constraints file
    var constraints = "";
    constraints += "module.exports.getCategories = function (req, res, callback) {  \n";
    constraints += "  return callback(false);\n";
    constraints += "};\n";

    fs.writeFileSync(constraintsPath, constraints);

    done();
  });

  afterEach(function(done) {
    // remove temporary constraints file
    cleanupPath(constraintsPath, function() {
      done();
    });
  });

  it('should attach to the provided server instance', function (done) {
    Server.app = api();
    var server = Server;

    Router(server, {});
    server.app.Router.should.exist;

    done();
  });

  it('should assign null to handlers if no js file found', function (done) {

    Server.app = api();
    var server = Server;

    Router(server, {});

    server.app.Router.handlers.should.eql([]);

    done();
  });

  it('should assign handlers if js file found', function (done) {

    Server.app = api();
    var server = Server;

    Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

    server.app.Router.handlers['getCategories'].should.exist;

    done();
  });

  describe('Redirects/Rewrites', function(done) {
    it('should redirect to new location if the current request URL is found in a datasource query result', function(done) {
      config.set('api.enabled', false);
      config.set('allowJsonView', true);
      config.set('rewrites.datasource', 'redirects');

      var page = getPage();
      var pages = [page]

      var options = testHelper.getPathOptions();
      var dsSchema = testHelper.getSchemaFromFile(options.datasourcePath, 'car-makes');
      sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

      testHelper.startServer(pages, function() {

        // provide API response
        var redirectResults = { results: [{"rule": "/test", "replacement": "/books", "redirectType":301}] }
        sinon.stub(libHelp.DataHelper.prototype, 'load').yields(null, redirectResults);

        var client = request(connectionString);

        client
        .get(page.route.paths[0])
        .end(function (err, res) {
          if (err) return done(err);

          libHelp.DataHelper.prototype.load.restore();
          datasource.Datasource.prototype.loadDatasource.restore();

          res.statusCode.should.eql(301)
          res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/books')

          config.set('rewrites.datasource', '');

          cleanup(done);
        });
      });
    })
  })

  describe('Add Constraint', function(done) {
    it('should add a constraint if the provided route specifies a constraint handler', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'getCategories';
      var page = Page('test', schema);

      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      server.app.Router.constraints['/test'].should.exist;

      done();
    });

    it('should throw error if the provided route specifies a missing constraint handler', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'XXX';
      var page = Page('test', schema);

      should.throws(function() { server.app.Router.constrain(page.route.paths[0], page.route.constraint); }, Error);

      done();
    });
  });

  describe('Test Constraint', function(done) {
    it('should return true if the route does not have a constraint', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      var page = Page('test', schema);

      var req = {}, res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        result.should.eql(true);
        done();
      });

    });

    it('should return false if the route constraint returns false', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'getCategories';
      var page = Page('test', schema);

      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      var req = { url: '/test' }, res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        result.should.eql(false);
        done();
      });

    });

    it('should return true if the route constraint is a datasource returning data', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, {
        datasourcePath: path.resolve(__dirname + '/../app/datasources'),
        routesPath: path.resolve(__dirname + '/../app/routes')
      });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'categories';
      var page = Page('test', schema);

      var data = {
        results: [
          { "_id": 1, "name": "Cat 1" }
        ]
      };

      var dsName = 'car-makes';
      var ds = datasource(page, dsName, testHelper.getPathOptions(), function() {});

      var dataHelper = new libHelp.DataHelper(ds, null);
      sinon.stub(libHelp.DataHelper.prototype, 'load').yields(null, JSON.stringify(data));
      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      var req = { url: '/test', params: {} };
      var res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        libHelp.DataHelper.prototype.load.restore();
        result.should.eql(true);
        done();
      });

    });

    it('should return false if the route constraint is a datasource returning nothing', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, {
        datasourcePath: path.resolve(__dirname + '/../app/datasources'),
        routesPath: path.resolve(__dirname + '/../app/routes')
      });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'categories';
      var page = Page('test', schema);

      var data = {
        results: []
      };

      var dsName = 'car-makes';
      var ds = datasource(page, dsName, testHelper.getPathOptions(), function() {});

      var dataHelper = new libHelp.DataHelper(ds, null);
      sinon.stub(libHelp.DataHelper.prototype, 'load').yields(null, JSON.stringify(data));

      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      var req = { url: '/test', params: {} };
      var res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        libHelp.DataHelper.prototype.load.restore();
        result.should.eql(false);
        done();
      });
    });

    it('should return false if the route constraint is a datasource returning nonsense', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, {
        datasourcePath: path.resolve(__dirname + '/../app/datasources'),
        routesPath: path.resolve(__dirname + '/../app/routes')
      });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      delete schema.route.path;
      schema.route.paths = ['/test'];
      schema.route.constraint = 'categories';
      var page = Page('test', schema);

      var data = "{0";

      var dsName = 'car-makes';
      var ds = datasource(page, dsName, testHelper.getPathOptions(), function() {});

      var dataHelper = new libHelp.DataHelper(ds, null);
      sinon.stub(libHelp.DataHelper.prototype, 'load').yields(null, JSON.stringify(data));

      server.app.Router.constrain(page.route.paths[0], page.route.constraint);

      var req = { url: '/test', params: {} };
      var res = {};

      server.app.Router.testConstraint(page.route.paths[0], req, res, function(result) {
        libHelp.DataHelper.prototype.load.restore();
        result.should.eql(false);
        done();
      });
    });
  });

})
