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
var help = require(__dirname + '/../help');
var libHelp = require(__dirname + '/../../dadi/lib/help');
var config = require(__dirname + '/../../config.js');

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port');
var apiHost = 'http://' + config.get('api.host') + ':' + config.get('api.port');

var token = JSON.stringify({
  "accessToken": "da6f610b-6f91-4bce-945d-9829cac5de71",
  "tokenType": "Bearer",
  "expiresIn": 2592000
});

describe('CacheInvalidationAPI', function (done) {

  var auth;

  beforeEach(function(done) {
    Server.start(function() {
      help.clearCache();

      var client = request(clientHost);
      client
      .get('/articles')
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

  afterEach(function(done) {
    http.clear_intercepts();
    Server.stop(function() {
      done();
    });
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
