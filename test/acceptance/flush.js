var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
// var superagentconfig = require('../superagent-mock-config');
// var superagentMock = require('superagent-mock')(request, superagentconfig);

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

var token = JSON.stringify({
  "accessToken": "da6f610b-6f91-4bce-945d-9829cac5de71",
  "tokenType": "Bearer",
  "expiresIn": 1800
});

var fordResult = JSON.stringify({
  results: [
    {
      makeName: 'Ford'
    }
  ]
});

var toyotaResult = JSON.stringify({
  results: [
    {
      makeName: 'Toyota'
    }
  ]
});

describe('Cache', function(done) {
  describe('Invalidation API', function (done) {

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

      // fake api data request
      http.register_intercept({
        hostname: config.get('api.host'),
        port: config.get('api.port'),
        path: 'http://' + config.get('api.host') + ':' + config.get('api.port') + '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}',
        method: 'GET',
        agent: new http.Agent({ keepAlive: true }),
        headers: { Authorization: 'Bearer da6f610b-6f91-4bce-945d-9829cac5de71', 'accept-encoding': 'gzip' },
        body: fordResult,
        statusCode: 200
      });

      // create a page
      var name = 'test';
      var schema = help.getPageSchema();
      var page = Page(name, schema);
      var dsName = 'car-makes-unchained';
      var options = help.getPathOptions();

      page.datasources = ['car-makes-unchained'];
      page.template = 'test_cache_flush.dust';

      // add two routes to the page for testing specific path cache clearing
      page.route.paths[0] = '/test';
      page.route.paths[1] = '/extra_test';

      page.events = [];
      delete page.route.constraint;

      help.startServer(page, function() {

        var client = request(clientHost);

        client
        .get('/test')
        .expect('content-type', 'text/html')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.headers['x-cache'].should.exist;
          res.headers['x-cache'].should.eql('MISS');

          client
          .get('/extra_test')
          .expect('content-type', 'text/html')
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);
            res.headers['x-cache'].should.exist;
            res.headers['x-cache'].should.eql('MISS');
            done()
          })
        })
      });

    });

    afterEach(function(done) {
      http.clear_intercepts();
      help.clearCache();
      help.stopServer(done);
    });

    it('should flush only cached items matching the specified path', function (done) {

      config.set('api.enabled', true);

      // get cached version of the page
      var client = request(clientHost);
      client
      .get('/test')
      .expect('content-type', 'text/html')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('HIT');

        // clear cache for this path
        client
        .post('/api/flush')
        .send({path: '/test'})
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.body.result.should.equal('success');

          // get page again, should be uncached
          var client = request(clientHost);
          client
          .get('/test')
          .expect('content-type', 'text/html')
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            res.headers['x-cache'].should.exist;
            res.headers['x-cache'].should.eql('MISS');

            // get second route again, should still be cached
            var client = request(clientHost);
            client
            .get('/extra_test')
            .expect('content-type', 'text/html')
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);

              res.headers['x-cache'].should.exist;
              res.headers['x-cache'].should.eql('HIT');
              done();
            });
          });
        });
      });
    });

    it('should flush all cached items when no path is specified', function (done) {

      config.set('api.enabled', true);

      // get cached version of the page
      var client = request(clientHost);
      client
      .get('/test')
      .expect('content-type', 'text/html')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('HIT');

        // clear cache for this path
        client
        .post('/api/flush')
        .send({path: '*'})
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.body.result.should.equal('success');

          // get page again, should be uncached
          var client = request(clientHost);
          client
          .get('/test')
          .expect('content-type', 'text/html')
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            res.headers['x-cache'].should.exist;
            res.headers['x-cache'].should.eql('MISS');

            // get second route again, should still be cached
            var client = request(clientHost);
            client
            .get('/extra_test')
            .expect('content-type', 'text/html')
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);

              res.headers['x-cache'].should.exist;
              res.headers['x-cache'].should.eql('MISS');

              done();
            });
          });
        });
      });
    });

    it('should flush datasource files when flushing by path', function (done) {

      config.set('api.enabled', true);

      // remove original fake api data request
      http.unregister_intercept({
        hostname: config.get('api.host'),
        port: config.get('api.port'),
        path: 'http://' + config.get('api.host') + ':' + config.get('api.port') + '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}',
        method: 'GET',
        agent: new http.Agent({ keepAlive: true }),
        headers: { Authorization: 'Bearer da6f610b-6f91-4bce-945d-9829cac5de71', 'accept-encoding': 'gzip' },
        body: fordResult,
        statusCode: 200
      });

      // fake api data request
      http.register_intercept({
        hostname: config.get('api.host'),
        port: config.get('api.port'),
        path: 'http://' + config.get('api.host') + ':' + config.get('api.port') + '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}',
        method: 'GET',
        agent: new http.Agent({ keepAlive: true }),
        headers: { Authorization: 'Bearer da6f610b-6f91-4bce-945d-9829cac5de71', 'accept-encoding': 'gzip' },
        body: toyotaResult,
        statusCode: 200
      });

      // get cached version of the page
      var client = request(clientHost);
      client
      .get('/test')
      .expect('content-type', 'text/html')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('HIT');

        res.text.should.eql('<ul><li>Ford</li></ul>');

        // clear cache for this path
        client
        .post('/api/flush')
        .send({path: '/test'})
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.body.result.should.equal('success');

          // get page again, should be uncached and with different data
          var client = request(clientHost);
          client
          .get('/test')
          .expect('content-type', 'text/html')
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            res.headers['x-cache'].should.exist;
            res.headers['x-cache'].should.eql('MISS');

            res.text.should.eql('<ul><li>Toyota</li></ul>');

            done();
          });
        });
      });
    });

    it('should flush datasource files when flushing all', function (done) {

      config.set('api.enabled', true);

      // remove original fake api data request
      http.unregister_intercept({
        hostname: config.get('api.host'),
        port: config.get('api.port'),
        path: 'http://' + config.get('api.host') + ':' + config.get('api.port') + '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}',
        method: 'GET',
        agent: new http.Agent({ keepAlive: true }),
        headers: { Authorization: 'Bearer da6f610b-6f91-4bce-945d-9829cac5de71', 'accept-encoding': 'gzip' },
        body: fordResult,
        statusCode: 200
      });

      // fake api data request
      http.register_intercept({
        hostname: config.get('api.host'),
        port: config.get('api.port'),
        path: 'http://' + config.get('api.host') + ':' + config.get('api.port') + '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}',
        method: 'GET',
        agent: new http.Agent({ keepAlive: true }),
        headers: { Authorization: 'Bearer da6f610b-6f91-4bce-945d-9829cac5de71', 'accept-encoding': 'gzip' },
        body: toyotaResult,
        statusCode: 200
      });

      // get cached version of the page
      var client = request(clientHost);
      client
      .get('/test')
      .expect('content-type', 'text/html')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('HIT');

        res.text.should.eql('<ul><li>Ford</li></ul>');

        // clear cache for this path
        client
        .post('/api/flush')
        .send({path: '*'})
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.body.result.should.equal('success');

          // get page again, should be uncached and with different data
          var client = request(clientHost);
          client
          .get('/test')
          .expect('content-type', 'text/html')
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            res.headers['x-cache'].should.exist;
            res.headers['x-cache'].should.eql('MISS');

            res.text.should.eql('<ul><li>Toyota</li></ul>');

            done();
          });
        });
      });
    });
  });
});
