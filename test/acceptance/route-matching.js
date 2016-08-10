var fs = require('fs')
var sinon = require('sinon')
var should = require('should')
var request = require('supertest')
var mkdirp = require('mkdirp')
var _ = require('underscore')
var path = require('path')
var assert = require('assert')
var nock = require('nock')

var Server = require(__dirname + '/../../dadi/lib')
var api = require(__dirname + '/../../dadi/lib/api')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var datasource = require(__dirname + '/../../dadi/lib/datasource')
var Page = require(__dirname + '/../../dadi/lib/page')
var help = require(__dirname + '/../help')
var libHelp = require(__dirname + '/../../dadi/lib/help')
var config = require(__dirname + '/../../config.js')

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var secureClientHost = 'https://' + config.get('server.host') + ':' + config.get('server.port')

var apiHost = 'http://' + config.get('api.host') + ':' + config.get('api.port')
var credentials = { clientId: config.get('auth.clientId'), secret: config.get('auth.secret') }

var client = request(clientHost)
var secureClient = request(secureClientHost)

var scope
var method

describe('Routing', function(done) {

  beforeEach(function(done) {
    help.clearCache()

    // intercept the api test at server startup
    sinon.stub(libHelp, "isApiAvailable").yields(null, true)

    scope = nock('http://127.0.0.1:3000').post('/token').reply(200, { accessToken: 'xx' })
    method = sinon.spy(Controller.Controller.prototype, 'get')

    done()
  })

  after(function(done) {
    help.clearCache()
    nock.restore()
    done()
  })

  afterEach(function(done) {
    libHelp.isApiAvailable.restore()
    nock.cleanAll()
    method.restore()
    help.stopServer(done)
  })

  describe('route matching', function (done) {
    it.skip('should match the best route for the given url', function (done) {
      done()
    })

    it('should prioritise pagination routes when param lengths match', function (done) {
      var page = Page('test', help.getPageSchema())

      page.datasources = []
      page.events = ['test_event']
      page.template = 'test_params.dust'
      page.route = {
        paths: [
          '/test/:content',
          '/test/:title',
          '/test/:page(\\d+)'
        ]
      }

      var pages = []
      pages.push(page)

      help.startServer(pages, function() {
        client.get('/test/2?cache=false')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          var params = JSON.parse(res.text)
          console.log(params)
          should.exist(params.page)
          should.not.exist(params.content)
          should.not.exist(params.title)
          done()
        })
      })
    })
  })
})
