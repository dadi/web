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

describe('Cache', function(done) {
  describe('Invalidation API', function (done) {

    var auth;
    var body = '<html><body>Test</body></html>';

    beforeEach(function(done) {

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

      // fake test page load
      // http.register_intercept({
      //   hostname: config.get('server.host'),
      //   port: config.get('server.port'),
      //   path: '/test',
      //   method: 'GET',
      //   agent: new http.Agent({ keepAlive: true }),
      //   body: body
      // });


      var result = JSON.stringify({
        results: [
          {
            makeName: 'Ford'
          }
        ]
      });

      // fake api data request
      http.register_intercept({
        hostname: config.get('api.host'),
        port: config.get('api.port'),
        path: 'http://' + config.get('api.host') + ':' + config.get('api.port') + '/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}',
        method: 'GET',
        agent: new http.Agent({ keepAlive: true }),
        headers: { Authorization: 'Bearer da6f610b-6f91-4bce-945d-9829cac5de71', 'accept-encoding': 'gzip' },
        body: result
      });

      help.clearCache();

      help.startServer(function() {

        var client = request(clientHost);
        client
        .get('/test')
        .expect('content-type', 'text/html')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          console.log(res)
          res.headers['x-cache'].should.exist;
          res.headers['x-cache'].should.eql('HIT');
          done()
        })
      });

    });

    afterEach(function(done) {
      //superagentMock.unset();
      http.clear_intercepts();
      //help.clearCache();
      help.stopServer(done);
    });

    it('should flush only cached items matching the specified path', function (done) {

      config.set('api.enabled', true);

      http.register_intercept({
        hostname: '127.0.0.1',
        port: 3000,
        path: '/token',
        method: 'POST',
        agent: new http.Agent({ keepAlive: true }),
        headers: { 'Content-Type': 'application/json' },
        body: token
      });

      var client = request(clientHost);
      client
      .get('/articles')
      .expect('content-type', 'text/html')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('HIT');

        client
        .post('/api/flush')
        .send({path: '/articles'})
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.body.result.should.equal('success');
          done();
        });
      });
    });

    it('should flush all cached items when no path is specified', function (done) {

      config.set('api.enabled', true);

      http.register_intercept({
        hostname: '127.0.0.1',
        port: 3000,
        path: '/token',
        method: 'POST',
        agent: new http.Agent({ keepAlive: true }),
        headers: { 'Content-Type': 'application/json' },
        body: token
      });

      var client = request(clientHost);
      client
      .get('/articles')
      .expect('content-type', 'text/html')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        res.headers['x-cache'].should.exist;
        res.headers['x-cache'].should.eql('HIT');

        client
        .post('/api/flush')
        .send({path: '*'})
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);
          res.body.result.should.equal('success');

          done();
        });

      });
    });
  });
});
