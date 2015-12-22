var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
var nock = require('nock');
var _ = require('underscore');


var Controller = require(__dirname + '/../../dadi/lib/controller');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var auth = require(__dirname + '/../../dadi/lib/auth');
var help = require(__dirname + '/../help');
var libHelp = require(__dirname + '/../../dadi/lib/help');
var config = require(__dirname + '/../../config.js');

var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

function startServer() {

  var options = {
    pagePath: __dirname + '/../app/pages',
    eventPath: __dirname + '/../app/events'
  };

  Server.app = api();
  Server.components = {};
  Server.start(function() {

  });
}

describe('Auth', function (done) {

  after(function(done) {

    nock.cleanAll();
    nock.restore();

    Server.stop(function(){
      done();
    });

  });

  it('should attach to the provided server instance', function (done) {
    Server.app = api();
    var server = Server;

    auth(server);
    server.app.all.length.should.eql(1);

    done();
  });

  it('should return error if invalid credentials are supplied', function (done) {

    var host = 'http://' + config.get('api.host') + ':' + config.get('api.port');

    var apiLoad = nock(host)
                .get('/')
                .reply(200, '');

    var scope = nock(host)
                .post(config.get('auth.tokenUrl'))
                .reply(200, '');

    startServer();

    var client = request(connectionString);

    client
    .get('/')
    //.expect('content-type', 'application/json')
    .expect(500, function(err, res) {

      scope.done();

      done();

    });

  });
});
