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
var Router = require(__dirname + '/../../dadi/lib/controller/router')
var libHelp = require(__dirname + '/../../dadi/lib/help');
var testHelper = require(__dirname + '/../help');

var config
var testConfigString
var configKey = path.resolve(path.join(__dirname, '/../../config'))

var connectionString

function getPage() {
  // create a page
  var name = 'test';
  var schema = testHelper.getPageSchema();
  var page = Page(name, schema);
  page.contentType = 'application/json';
  page.template = 'test.dust';
  page.routes[0].path = '/test';
  page.settings.cache = false;
  page.datasources = [];
  page.events = [];
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

    // reset config
    delete require.cache[configKey]
    config = require(configKey)

    testConfigString = fs.readFileSync(config.configPath()).toString()

    //console.log(testConfigString)
    config.loadFile(path.resolve(config.configPath()))

    connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

    done();
  });

  afterEach(function(done) {
    // remove temporary constraints file
    cleanupPath(constraintsPath, function() {
      // reset config
      fs.writeFileSync(config.configPath(), testConfigString)

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
    describe('Configurable', function(done) {

      it('should redirect to lowercased URL if the current request URL is not all lowercase', function(done) {
        var newTestConfig = JSON.parse(testConfigString)
        newTestConfig.api.enabled = false
        newTestConfig.rewrites = {
          forceLowerCase: true
        }

        fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))

        delete require.cache[configKey]
        config = require(configKey)
        config.loadFile(config.configPath())

        var page = getPage();
        var pages = [page]
        var options = testHelper.getPathOptions();
        var dsSchema = testHelper.getSchemaFromFile(options.datasourcePath, 'car-makes');
        sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

        testHelper.startServer(pages, function() {

          var client = request(connectionString);
          client
          .get('/TeSt')
          .end(function (err, res) {
            if (err) return done(err);

            datasource.Datasource.prototype.loadDatasource.restore();

            res.statusCode.should.eql(301)
            res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/test')

            //config.set('rewrites.forceLowerCase', false)
            cleanup(done);
          });
        });
      })

      it('should add a trailing slash and redirect if the current request URL does not end with a slash', function(done) {
        config.set('rewrites.forceTrailingSlash', true)

        var page = getPage();
        var pages = [page]
        var options = testHelper.getPathOptions();
        var dsSchema = testHelper.getSchemaFromFile(options.datasourcePath, 'car-makes');
        sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

        testHelper.startServer(pages, function() {

          var client = request(connectionString);
          client
          .get('/test')
          .end(function (err, res) {
            if (err) return done(err);

            datasource.Datasource.prototype.loadDatasource.restore();

            res.statusCode.should.eql(301)
            res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/test/')

            config.set('rewrites.forceTrailingSlash', false)
            cleanup(done);
          });
        });
      })

      it('should strip specified index pages from the current request URL', function(done) {
        config.set('rewrites.stripIndexPages', ['index.php', 'default.aspx'])
        config.set('rewrites.forceLowerCase', true)

        var page = getPage();
        var pages = [page]
        var options = testHelper.getPathOptions();
        var dsSchema = testHelper.getSchemaFromFile(options.datasourcePath, 'car-makes');
        sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

        testHelper.startServer(pages, function() {

          var client = request(connectionString);
          client
          .get('/tEsT/dEfaUlt.aspx')
          .end(function (err, res) {
            if (err) return done(err);

            datasource.Datasource.prototype.loadDatasource.restore();

            res.statusCode.should.eql(301)
            res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/test/')

            config.set('rewrites.stripIndexPages', [])
            config.set('rewrites.forceLowerCase', false)
            cleanup(done);
          });
        });
      })

      it('should add a trailing slash and lowercase the URL if both settings are true', function(done) {
        config.set('rewrites.forceLowerCase', true)
        config.set('rewrites.forceTrailingSlash', true)

        var page = getPage();
        var pages = [page]
        var options = testHelper.getPathOptions();
        var dsSchema = testHelper.getSchemaFromFile(options.datasourcePath, 'car-makes');
        sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

        testHelper.startServer(pages, function() {

          var client = request(connectionString);
          client
          .get('/tESt')
          .end(function (err, res) {
            if (err) return done(err);

            datasource.Datasource.prototype.loadDatasource.restore();

            res.statusCode.should.eql(301)
            res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/test/')

            config.set('rewrites.forceLowerCase', false)
            config.set('rewrites.forceTrailingSlash', false)
            cleanup(done);
          });
        });
      })
    })

    it('should redirect to new location if the current request URL is found in a datasource query result', function(done) {
      config.set('api.enabled', false);
      config.set('allowJsonView', true);
      config.set('loadDatasourceAsFile', false);
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
        .get(page.routes[0].path)
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
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'getCategories';
      var page = Page('test', schema);

      server.app.Router.constrain(page.routes[0].path, page.routes[0].constraint);

      should.exist(server.app.Router.constraints['/test'])

      done();
    });

    it('should throw error if the provided route specifies a missing constraint handler', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      schema.routes[0].path = '/test';
      schema.routes[0].constraint = 'XXX';
      var page = Page('test', schema);

      should.throws(function() { server.app.Router.constrain(page.routes[0].path, page.route.constraint); }, Error);

      done();
    });
  });

  describe.skip('Test Constraint', function(done) {
    it('should return true if the route does not have a constraint', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      schema.routes[0].path = '/test'
      var page = Page('test', schema);

      var req = {}, res = {};

      server.app.Router.testConstraint(page.routes[0].path, req, res, function(result) {
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
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'getCategories';
      var page = Page('test', schema);

      server.app.Router.constrain(page.routes[0].path, page.route.constraint);

      var req = { url: '/test' }, res = {};

      server.app.Router.testConstraint(page.routes[0].path, req, res, function(result) {
        result.should.eql(false);
        done();
      });

    });

    it.skip('should return true if the route constraint is a datasource returning data', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, {
        datasourcePath: path.resolve(__dirname + '/../app/datasources'),
        routesPath: path.resolve(__dirname + '/../app/routes')
      });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'categories';
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
      server.app.Router.constrain(page.routes[0].path, page.route.constraint);

      var req = { url: '/test', params: {} };
      var res = {};

      server.app.Router.testConstraint(page.routes[0].path, req, res, function(result) {
        libHelp.DataHelper.prototype.load.restore();
        result.should.eql(true);
        done();
      });

    });

    it.skip('should return false if the route constraint is a datasource returning nothing', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, {
        datasourcePath: path.resolve(__dirname + '/../app/datasources'),
        routesPath: path.resolve(__dirname + '/../app/routes')
      });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'categories';
      var page = Page('test', schema);

      var data = {
        results: []
      };

      var dsName = 'car-makes';
      var ds = datasource(page, dsName, testHelper.getPathOptions(), function() {});

      var dataHelper = new libHelp.DataHelper(ds, null);
      sinon.stub(libHelp.DataHelper.prototype, 'load').yields(null, JSON.stringify(data));

      server.app.Router.constrain(page.routes[0].path, page.route.constraint);

      var req = { url: '/test', params: {} };
      var res = {};

      server.app.Router.testConstraint(page.routes[0].path, req, res, function(result) {
        libHelp.DataHelper.prototype.load.restore();
        result.should.eql(false);
        done();
      });
    });

    it.skip('should return false if the route constraint is a datasource returning nonsense', function (done) {

      Server.app = api();
      var server = Server;

      Router(server, {
        datasourcePath: path.resolve(__dirname + '/../app/datasources'),
        routesPath: path.resolve(__dirname + '/../app/routes')
      });

      // create a page with a constrained route
      var schema = testHelper.getPageSchema();
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'categories';
      var page = Page('test', schema);

      var data = "{0";

      var dsName = 'car-makes';
      var ds = datasource(page, dsName, testHelper.getPathOptions(), function() {});

      var dataHelper = new libHelp.DataHelper(ds, null);
      sinon.stub(libHelp.DataHelper.prototype, 'load').yields(null, JSON.stringify(data));

      server.app.Router.constrain(page.routes[0].path, page.route.constraint);

      var req = { url: '/test', params: {} };
      var res = {};

      server.app.Router.testConstraint(page.routes[0].path, req, res, function(result) {
        libHelp.DataHelper.prototype.load.restore();
        result.should.eql(false);
        done();
      });
    });
  });

})
