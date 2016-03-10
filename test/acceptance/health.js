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
var config = require(__dirname + '/../../config.js');

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port');
var apiHost = 'http://' + config.get('api.host') + ':' + config.get('api.port');

var token = JSON.stringify({
  "accessToken": "da6f610b-6f91-4bce-945d-9829cac5de71",
  "tokenType": "Bearer",
  "expiresIn": 2592000
});

describe('Health', function (done) {

  beforeEach(function(done) {
    Server.start(function() {
      done();
    });
  });

  afterEach(function(done) {
    http.clear_intercepts();
    Server.stop(function() {
      done();
    });
  });
  
  it('should allow "/status" request without token', function (done) {
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
    .get('/status')
    .expect('content-type', 'application/json')
    .expect(200, done);
  });
});
