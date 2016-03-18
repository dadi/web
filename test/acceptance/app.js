var fs = require('fs');
var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
// loaded customised fakeweb module
var fakeweb = require(__dirname + '/../fakeweb');
var http = require('http');
var _ = require('underscore');
var path = require('path');
var assert = require('assert');

var Server = require(__dirname + '/../../dadi/lib');
var Page = require(__dirname + '/../../dadi/lib/page');
var help = require(__dirname + '/../help');
var libHelp = require(__dirname + '/../../dadi/lib/help');
var config = require(__dirname + '/../../config.js');

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port');
var apiHost = 'http://' + config.get('api.host') + ':' + config.get('api.port');
var credentials = { clientId: config.get('auth.clientId'), secret: config.get('auth.secret') }

var token = JSON.stringify({
  "accessToken": "da6f610b-6f91-4bce-945d-9829cac5de71",
  "tokenType": "Bearer",
  "expiresIn": 1800
});

describe.skip('Application', function(done) {

  var auth;
  var body = '<html><body>Test</body></html>';

  beforeEach(function(done) {

    help.clearCache();

    // fake api available check
    http.register_intercept({
      hostname: config.get('api.host'),
      port: config.get('api.port'),
      path: '/',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    // fake token post
    http.register_intercept({
      hostname: config.get('api.host'),
      port: config.get('api.port'),
      path: '/token',
      method: 'POST',
      agent: new http.Agent({ keepAlive: true }),
      headers: { 'Content-Type': 'application/json' },
      body: token
    });

    done();
  });

  after(function(done) {
    help.clearCache();
    http.clear_intercepts();
    done()
  });

  afterEach(function(done) {
    http.clear_intercepts();
    help.stopServer(done);
  });

  it('should not error if the template is found when calling `view.render()`', function (done) {

    console.log(config.get('rewrites'))

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
