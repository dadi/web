var fs = require('fs');
var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
var mkdirp = require('mkdirp');
var _ = require('underscore');
var path = require('path');
var assert = require('assert');

var Server = require(__dirname + '/../../dadi/lib');
var api = require(__dirname + '/../../dadi/lib/api');
var Page = require(__dirname + '/../../dadi/lib/page');
var help = require(__dirname + '/../help');
var libHelp = require(__dirname + '/../../dadi/lib/help');
var config = require(__dirname + '/../../config.js');

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

    // fake api available check
    help.addHttpInterceptForApiCheck();
    done();
  });

  after(function(done) {
    help.clearCache();
    done()
  });

  afterEach(function(done) {
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

    var endpoint1 = '/1.0/library/categories?count=20&page=1&filter={"name":"Crime"}&fields={"name":1}&sort={"name":1}';
    var categoriesResult1 = JSON.stringify({ results: [ { name: 'Crime' } ] });
    help.addHttpIntercept(endpoint1, 200, categoriesResult1);

    // create page 1
    var page1 = Page('page1', help.getPageSchema());
    page1.datasources = ['categories_no_cache'];
    page1.template = 'test.dust';
    page1.route.paths[0] = '/categories/:category';
    page1.events = [];
    delete page1.route.constraint;

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

    var endpoint1 = '/1.0/library/categories?count=20&page=1&filter={"name":"Crime"}&fields={"name":1}&sort={"name":1}';
    var categoriesResult1 = JSON.stringify({ results: [ { name: 'Crime' } ] });
    help.addHttpIntercept(endpoint1, 200, categoriesResult1);

    // create page 1
    var page1 = Page('page1', help.getPageSchema());
    page1.datasources = ['categories_no_cache'];
    page1.template = 'testxxxxxxxx.dust';
    page1.route.paths[0] = '/categories/:category';
    page1.events = [];
    delete page1.route.constraint;

    var pages = [];
    pages.push(page1)

    help.startServer(pages, function() {

      var client = request(clientHost);

      client
      .get('/categories/Crime')
      .expect('content-type', 'text/html')
      .expect(500)
      .end(done);
    });
  });

  it('should renew datasource endpoints when new requests are made', function(done) {

    var endpoint1 = '/1.0/library/categories?count=20&page=1&filter={"name":"Crime"}&fields={"name":1}&sort={"name":1}';
    var endpoint2 = '/1.0/library/categories?count=20&page=1&filter={"name":"Horror"}&fields={"name":1}&sort={"name":1}';

    var categoriesResult1 = JSON.stringify({ results: [ { name: 'Crime' } ] });
    var categoriesResult2 = JSON.stringify({ results: [ { name: 'Horror' } ] });

    // fake api data requests
    help.addHttpIntercept(endpoint1, 200, categoriesResult1);
    help.addHttpIntercept(endpoint2, 200, categoriesResult2);

    // create page 1
    var page1 = Page('page1', help.getPageSchema());
    page1.datasources = ['categories_no_cache'];
    page1.template = 'test.dust';
    page1.route.paths[0] = '/categories/:category';
    page1.events = [];
    delete page1.route.constraint;

    var pages = [];
    pages.push(page1)

    help.startServer(pages, function() {

      var spy = sinon.spy(libHelp, 'DataHelper');

      var client = request(clientHost);

      client
      .get('/categories/Crime')
      // .expect('content-type', 'text/html')
      // .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        // check the args that the data loader
        // was called with
        var dataHelperArgs = spy.args[0];
        spy.restore();
        var datasourceArg = dataHelperArgs[0];
        var urlArg = dataHelperArgs[1];

        datasourceArg.endpoint.should.eql('http://' + config.get('api.host') + ':' + config.get('api.port') + endpoint1)
        res.text.should.eql('<h3>Crime</h3>');

        // NEXT CALL, DIFF PARAMS

        spy = sinon.spy(libHelp, 'DataHelper');

        client
        .get('/categories/Horror')
        // .expect('content-type', 'text/html')
        // .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          // check the args that the data loader
          // was called with
          dataHelperArgs = spy.args[0];
          spy.restore();

          datasourceArg = dataHelperArgs[0];
          urlArg = dataHelperArgs[1];

          datasourceArg.endpoint.should.eql('http://' + config.get('api.host') + ':' + config.get('api.port') + endpoint2)
          res.text.should.eql('<h3>Horror</h3>');

          done()
        })
      })
    });
  })
});
