var _ = require('underscore')
var fs = require('fs')
var nock = require('nock')
var path = require('path')
var sinon = require('sinon')
var should = require('should')
var Readable = require('stream').Readable
var request = require('supertest')
var zlib = require('zlib')

var api = require(__dirname + '/../../dadi/lib/api')
var Server = require(__dirname + '/../../dadi/lib')
var Page = require(__dirname + '/../../dadi/lib/page')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var TestHelper = require(__dirname + '/../help')()
var help = require(__dirname + '/../../dadi/lib/help')
var remoteProvider = require(__dirname + '/../../dadi/lib/providers/remote')

var config = require(path.resolve(path.join(__dirname, '/../../config')))
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var apiConnectionString = 'http://' + config.get('api.host') + ':' + config.get('api.port')
var controller

describe('Data Providers', function (done) {
  beforeEach(function (done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(function (done) {
    TestHelper.stopServer(done)
  })

  describe('Remote', function (done) {
    it('should return gzipped response if accept header specifies it', function (done) {
      TestHelper.enableApiConfig().then(() => {
        var pages = TestHelper.setUpPages()
        pages[0].datasources = ['car-makes-unchained']

        var text = JSON.stringify({ 'hello': 'world!' })
        zlib.gzip(text, function (_, result) {
          doRequest(result)
        })

        var doRequest = function (data) {
          TestHelper.setupApiIntercepts()

          var scope = nock(apiConnectionString)
          .defaultReplyHeaders({
            'content-encoding': 'gzip'
          })
          .get('/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false')
          .times(5)
          .reply(200, data)

          var providerSpy = sinon.spy(remoteProvider.prototype, 'processOutput')

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)

            client
            .get(pages[0].routes[0].path + '?cache=false')
            .end(function (err, res) {
              if (err) return done(err)

              providerSpy.restore()
              providerSpy.called.should.eql(true)
              providerSpy.firstCall.args[1].should.eql(text)

              done()
            })
          })
        }
      })
    })
  })
})
