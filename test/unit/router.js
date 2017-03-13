var fs = require('fs');
var nock = require('nock')
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
  nock.cleanAll()

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

    var host = 'http://' + config.get('api.host') + ':' + config.get('api.port')
    var host2 = 'http://127.0.0.1:3000'
    var scope1 = nock(host).post('/token').reply(200, { accessToken: 'xx' })
    var scope2 = nock(host2).post('/token').reply(200, { accessToken: 'xx' })

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
    describe('Configurable', function(done) {
      config.set('api.enabled', false);

      it('should redirect to lowercased URL if the current request URL is not all lowercase', function (done) {
        config.set('rewrites.forceLowerCase', true)

        var pages = testHelper.setUpPages()
        pages[0].datasources = ['car-makes']

        testHelper.startServer(pages, function() {
          var client = request(connectionString)
          client
          .get('/TeSt')
          .end(function (err, res) {
            if (err) return done(err)

            res.statusCode.should.eql(301)
            res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/test')
            config.set('rewrites.forceTrailingSlash', false)
            cleanup(done);
          })
        })
      })

      it('should not redirect to lowercased URL if only URL parameters are not lowercase', function (done) {
        config.set('rewrites.forceLowerCase', true)

        var pages = testHelper.setUpPages()
        pages[0].datasources = ['car-makes-unchained']

        // provide API response
        var results = { results: [{'make': 'ford'}] }
        var scope1 = nock(connectionString).get(/test/).reply(200, results)

        testHelper.startServer(pages, function() {
          var client = request(connectionString)
          client
          .get('/test?p=OMG')
          .end(function (err, res) {
            if (err) return done(err)

            should.not.exist(res.headers.location)
            res.statusCode.should.eql(200)
            config.set('rewrites.forceTrailingSlash', false)
            cleanup(done);
          })
        })
      })

      it('should not lowercase URL parameters when redirecting to lowercase URL', function (done) {
        config.set('rewrites.forceLowerCase', true)

        var pages = testHelper.setUpPages()
        pages[0].datasources = ['car-makes-unchained']

        // provide API response
        var results = { results: [{'make': 'ford'}] }

        testHelper.startServer(pages, function() {
          var client = request(connectionString)
          client
          .get('/tEsT?p=OMG')
          .end(function (err, res) {
            if (err) return done(err)

            res.statusCode.should.eql(301)
            res.headers.location.should.eql('http://127.0.0.1:5000/test?p=OMG')
            config.set('rewrites.forceTrailingSlash', false)
            cleanup(done);
          })
        })
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

    it('should add Cache-Control headers to redirects', function(done) {
      config.set('api.enabled', false);
      config.set('allowJsonView', true);
      config.set('loadDatasourceAsFile', false);
      config.set('rewrites.datasource', 'redirects');
      config.set('headers.cacheControl', { '301': 'no-cache' });

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
          should.exist(res.headers['cache-control'])
          res.headers['cache-control'].should.eql('no-cache')
          res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/books')

          config.set('rewrites.datasource', '');
          config.set('headers.cacheControl', null);

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
