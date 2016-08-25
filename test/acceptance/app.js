var fs = require('fs');
var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
var mkdirp = require('mkdirp');
var _ = require('underscore');
var path = require('path');
var assert = require('assert');
var nock = require('nock')

var Server = require(__dirname + '/../../dadi/lib');
var api = require(__dirname + '/../../dadi/lib/api');
var datasource = require(__dirname + '/../../dadi/lib/datasource');
var Page = require(__dirname + '/../../dadi/lib/page');
var help = require(__dirname + '/../help');
var libHelp = require(__dirname + '/../../dadi/lib/help');
var config = require(path.resolve(path.join(__dirname, '/../../config')));

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port');
var apiHost = 'http://' + config.get('api.host') + ':' + config.get('api.port');
var credentials = { clientId: config.get('auth.clientId'), secret: config.get('auth.secret') }

function cleanupPath(path, done) {
  try {
    var stats = fs.stat(path, function(err, stats) {
      if (stats.isFile()) {
        fs.unlinkSync(path)
        return done();
      }
      if (stats.isDirectory()) {
        fs.rmdirSync(path)
        return done();
      }
    })
  }
  catch (err) {
    console.log(err);
  }
}

describe.skip('Application', function(done) {

  beforeEach(function(done) {
    help.clearCache();

    // intercept the api test at server startup
    sinon.stub(libHelp, "isApiAvailable").yields(null, true);

    done();
  });

  after(function(done) {
    help.clearCache();
    nock.restore()
    help.stopServer(done);
  });

  afterEach(function(done) {
    libHelp.isApiAvailable.restore()
    nock.cleanAll()
    help.stopServer(done);
  });

  it('should not throw an error when starting the server with partial subdirectories', function(done) {

    var partialPath = __dirname + '/../app/partials/component1';

    mkdirp(partialPath, function(err, result) {

      var partial = "<h1>Test Partial</h1>\n\n";
      var filePath = partialPath + '/partial.js';
      fs.writeFileSync(filePath, partial);

      Server.app = api();
      Server.components = {};
      Server.start(function() {

        cleanupPath(filePath, function() {
          cleanupPath(partialPath, function() {
            // test the result
            //result.should.eql(expected);
            done();
          });
        });
      });
    })
  })

  it('should not error if the template is found when calling `view.render()`', function (done) {
    var host = 'http://' + config.get('api.host') + ':' + config.get('api.port')
    var authscope1 = nock(host)
      .post('/token')
      .times(3)
      .reply(200, {
        accessToken: 'xx'
      });

    var endpoint1 = '/1.0/library/categories?count=20&page=1&filter=%7B%22name%22:%22Crime%22%7D&fields=%7B%22name%22:1%7D&sort=%7B%22name%22:1%7D';
    var categoriesResult1 = JSON.stringify({ results: [ { name: 'Crime' } ] });
    var scope2 = nock(host)
      .get(endpoint1)
      .reply(200, categoriesResult1);

    // create page 1
    var page1 = Page('page1', help.getPageSchema());
    page1.datasources = ['categories_no_cache'];
    page1.template = 'test.dust';
    page1.routes[0].path = '/categories/:category';
    page1.events = [];
    //delete page1.route.constraint;

    var pages = [];
    pages.push(page1)

    help.startServer(pages, function() {

      var client = request(clientHost);

      client
      .get('/categories/Crime')
      // .expect('content-type', 'text/html')
      // .expect(200)
      .end(done);
    });
  });

  it('should throw an error if the template is not found when calling `view.render()`', function (done) {
    var host = 'http://' + config.get('api.host') + ':' + config.get('api.port')
    var authscope1 = nock(host)
      .post('/token')
      .times(3)
      .reply(200, {
        accessToken: 'xx'
      });

    var endpoint1 = '/1.0/library/categories?count=20&page=1&filter=%7B%22name%22:%22Crime%22%7D&fields=%7B%22name%22:1%7D&sort=%7B%22name%22:1%7D';
    var categoriesResult1 = JSON.stringify({ results: [ { name: 'Crime' } ] });
    var scope2 = nock(host)
      .get(endpoint1)
      .reply(200, categoriesResult1);

    // create page 1
    var page1 = Page('page1', help.getPageSchema());
    page1.datasources = ['categories_no_cache'];
    page1.template = 'testxxxxxxxx.dust';
    page1.routes[0].path = '/categories/:category';
    page1.events = [];
    //delete page1.route.constraint;

    var pages = [];
    pages.push(page1)

    help.startServer(pages, function() {

      var client = request(clientHost);

      client
      .get('/categories/Crime')
      .expect('content-type', 'application/json')
      .expect(500)
      .end(function(err, res) {
        //console.log(res.body)
        done()
      });
    });
  });

  it('should not redirect if the router redirect datasource returns unmatching results', function (done) {
    var host = 'http://' + config.get('api.host') + ':' + config.get('api.port')
    config.set('rewrites.datasource', 'redirects')

    var scope = nock(host)
      .post('/token')
      .times(2)
      .reply(200, {
        accessToken: 'xx'
      });

    var dsEndpoint = '/1.0/test/redirects?count=3&page=1&filter=%7B%22rule%22:%22/news/whatever?hello=world&foo=bar%22%7D&fields=%7B%7D&sort=%7B%7D';
    var dsResult = JSON.stringify({ results: [ {  _id: "56ec1c", source: "import", rule: "/car-reviews/alfa-romeo/4c-coupe/", replacement: "/alfa-romeo/4c/coupe/", redirectType: "301", stopProcessing: 1, apiVersion: "1.0" } ]});

    var scope2 = nock(host)
      .get(dsEndpoint)
      .reply(200, dsResult);

    // create page 1
    var page1 = Page('page1', help.getPageSchema());
    page1.datasources = [];
    page1.template = 'test.dust';
    page1.routes[0].path = '/news/:seoUrlNews?';
    page1.events = [];
    //delete page1.route.constraint;

    var pages = [];
    pages.push(page1)

    help.startServer(pages, function() {
      var client = request(clientHost);

      client
      .get('/news/whatever?hello=world&foo=bar')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        config.set('rewrites.datasource', '')

        done()
      })
    })
  });

  it('should renew datasource endpoints when new requests are made', function(done) {
    var host = 'http://' + config.get('api.host') + ':' + config.get('api.port')

    var authscope1 = nock(host)
      .post('/token')
      .times(4)
      .reply(200, {
        accessToken: 'xx'
      });

    var endpoint1 = '/1.0/library/categories?count=20&page=1&filter=%7B%22name%22:%22Crime%22%7D&fields=%7B%22name%22:1%7D&sort=%7B%22name%22:1%7D';
    var endpoint2 = '/1.0/library/categories?count=20&page=1&filter=%7B%22name%22:%22Horror%22%7D&fields=%7B%22name%22:1%7D&sort=%7B%22name%22:1%7D';

    var categoriesResult1 = JSON.stringify({ results: [ { name: 'Crime' } ] });
    var categoriesResult2 = JSON.stringify({ results: [ { name: 'Horror' } ] });

    var scope2 = nock(host)
      .get(endpoint1)
      .reply(200, categoriesResult1);

    var scope3 = nock(host)
      .get(endpoint2)
      .reply(200, categoriesResult2);

    // create page 1
    var page1 = Page('page1', help.getPageSchema());
    page1.datasources = ['categories_no_cache'];
    page1.template = 'test.dust';
    page1.routes[0].path = '/categories/:category';
    page1.events = [];
    //delete page1.route.constraint;

    var pages = [];
    pages.push(page1)

    help.startServer(pages, function() {

      //var spy = sinon.spy(libHelp, 'DataHelper');

      var client = request(clientHost);

      client
      .get('/categories/Crime')
      .end(function (err, res) {
        if (err) return done(err);

        // check the args that the data loader
        // was called with
        // var dataHelperArgs = spy.args[0];
        // spy.restore();
        // var datasourceArg = dataHelperArgs[0];
        // var urlArg = dataHelperArgs[1];

        //datasourceArg.endpoint.should.eql('http://' + config.get('api.host') + ':' + config.get('api.port') + endpoint1)
        res.text.should.eql('<h3>Crime</h3>');

        // NEXT CALL, DIFF PARAMS

        //spy = sinon.spy(libHelp, 'DataHelper');

        client
        .get('/categories/Horror')
        .end(function (err, res) {
          if (err) return done(err);

          // check the args that the data loader
          // was called with
          // dataHelperArgs = spy.args[0];
          // spy.restore();
          //
          // datasourceArg = dataHelperArgs[0];
          // urlArg = dataHelperArgs[1];

          //datasourceArg.endpoint.should.eql('http://' + config.get('api.host') + ':' + config.get('api.port') + endpoint2)
          res.text.should.eql('<h3>Horror</h3>');

          done()
        })
      })
    });
  })

  it('should use http when the datasource specifies http protocol', function(done) {
    var host = 'http://' + config.get('api.host') + ':' + config.get('api.port')
    var authscope1 = nock(host).post('/token').times(4).reply(200, { accessToken: 'xx' });

    var endpoint1 = '/1.0/library/categories?count=20&page=1&filter=%7B%22name%22:%22Crime%22%7D&fields=%7B%22name%22:1%7D&sort=%7B%22name%22:1%7D';
    var categoriesResult1 = JSON.stringify({ results: [ { name: 'Crime' } ] });
    var scope2 = nock(host).get(endpoint1).reply(200, categoriesResult1);

    var dsName = 'categories_no_cache';
    var options = help.getPathOptions();
    var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName);

    sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

    var page1 = Page('page1', help.getPageSchema());
    page1.datasources = ['categories_no_cache'];
    page1.template = 'test.dust';
    page1.routes[0].path = '/categories/:category';
    page1.events = [];

    var pages = [];
    pages.push(page1)

    help.startServer(pages, function() {
      //var spy = sinon.spy(libHelp, 'DataHelper');
      var client = request(clientHost);

      client
      .get('/categories/Crime')
      .expect('content-type', 'text/html')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        // check the args that the data loader was called with
        // var dataHelperArgs = spy.args[0];
        // spy.restore();
        datasource.Datasource.prototype.loadDatasource.restore()
        // var datasourceArg = dataHelperArgs[0];
        // var urlArg = dataHelperArgs[1];

        //spy.firstCall.thisValue.options.proto.should.eql('http')
        done()
      })
    })
  })

  it('should use https when the datasource specifies https protocol', function(done) {
    var host = 'http://' + config.get('api.host') + ':' + config.get('api.port')
    var authscope1 = nock(host).post('/token').times(4).reply(200, { accessToken: 'xx' });

    var endpoint1 = '/1.0/library/categories?count=20&page=1&filter=%7B%22name%22:%22Crime%22%7D&fields=%7B%22name%22:1%7D&sort=%7B%22name%22:1%7D';
    var categoriesResult1 = JSON.stringify({ results: [ { name: 'Crime' } ] });
    var scope2 = nock(host).get(endpoint1).reply(200, categoriesResult1);

    var dsName = 'categories_no_cache';
    var options = help.getPathOptions();
    var dsSchema = help.getSchemaFromFile(options.datasourcePath, dsName);
    dsSchema.datasource.source.protocol = 'https'

    sinon.stub(datasource.Datasource.prototype, "loadDatasource").yields(null, dsSchema);

    var page1 = Page('page1', help.getPageSchema());
    page1.datasources = ['categories_no_cache'];
    page1.template = 'test.dust';
    page1.routes[0].path = '/categories/:category';
    page1.events = [];

    var pages = [];
    pages.push(page1)

    help.startServer(pages, function() {
      //var spy = sinon.spy(libHelp, 'DataHelper');
      var client = request(clientHost);

      client
      .get('/categories/Crime')
      .expect('content-type', 'text/html')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        // check the args that the data loader was called with
        // var dataHelperArgs = spy.args[0];
        // spy.restore();
        datasource.Datasource.prototype.loadDatasource.restore()
        // var datasourceArg = dataHelperArgs[0];
        // var urlArg = dataHelperArgs[1];

        // spy.firstCall.thisValue.options.protocol.should.eql('https:')
        // spy.firstCall.thisValue.options.agent.protocol.should.eql('https:')
        done()
      })
    })
  })
})
