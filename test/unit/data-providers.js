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
var Controller = require(__dirname + '/../../dadi/lib/controller')
var datasource = require(__dirname + '/../../dadi/lib/datasource')
var help = require(__dirname + '/../../dadi/lib/help')
var Page = require(__dirname + '/../../dadi/lib/page')
var remoteProvider = require(__dirname + '/../../dadi/lib/providers/remote')
var Server = require(__dirname + '/../../dadi/lib')
var TestHelper = require(__dirname + '/../help')()
var wordpressProvider = require(__dirname + '/../../dadi/lib/providers/wordpress')

var config = require(path.resolve(path.join(__dirname, '/../../config')))
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
    TestHelper.stopServer(function() {})
    done()
  })

  describe('Remote', function (done) {
    it('should return gzipped response if accept header specifies it', function (done) {
      TestHelper.enableApiConfig().then(() => {
        var pages = TestHelper.setUpPages()
        pages[0].datasources = ['car-makes-unchained']

        var text = JSON.stringify({ 'hello': 'world!' })

        zlib.gzip(text, function (_, data) {
          TestHelper.setupApiIntercepts()

          var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
          var apiConnectionString = 'http://' + config.get('api.host') + ':' + config.get('api.port')

          var scope = nock(apiConnectionString)
          .defaultReplyHeaders({
            'content-encoding': 'gzip'
          })
          .get('/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false')
          .times(5)
          .reply(200, data)

          var providerSpy = sinon.spy(remoteProvider.prototype, 'processOutput')

          //console.log(nock.pendingMocks())

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)

            client
            .get(pages[0].routes[0].path + '?cache=false')
            .end((err, res) => {
              providerSpy.restore()
              providerSpy.called.should.eql(true)
              providerSpy.firstCall.args[1].should.eql(text)

              done()
            })
          })
        })
      })
    })
  })

  describe('Static', function (done) {
  })

  describe('Twitter', function (done) {
  })

  describe('Wordpress', function (done) {
    it('should add query parameters to the endpoint', function(done) {
      var ds = datasource(Page('test', TestHelper.getPageSchema()), 'wordpress', TestHelper.getPathOptions(), function () {})

      var req = {
        url: '/posts/one-wet-day',
        params: {
          slug: 'one-wet-day'
        }
      }

      ds.provider.buildEndpoint(req)
      ds.provider.endpoint.should.eql('sites/neversettleblog.wordpress.com/posts/slug:one-wet-day')
      done()
    })

    it('should use the datasource count property when querying the API', function(done) {
      var ds = datasource(Page('test', TestHelper.getPageSchema()), 'wordpress', TestHelper.getPathOptions(), function () {})
      ds.schema.datasource.count = 10

      var params = ds.provider.buildQueryParams()

      should.exists(params.count)
      params.count.should.eql(10)
      done()
    })

    it('should use an array of datasource fields when querying the API', function(done) {
      var ds = datasource(Page('test', TestHelper.getPageSchema()), 'wordpress', TestHelper.getPathOptions(), function () {})
      ds.schema.datasource.fields = ['field1', 'field2']

      var params = ds.provider.buildQueryParams()
      should.exists(params.fields)
      params.fields.should.eql('field1,field2')
      done()
    })

    it('should use an object of datasource fields when querying the API', function(done) {
      var ds = datasource(Page('test', TestHelper.getPageSchema()), 'wordpress', TestHelper.getPathOptions(), function () {})
      ds.schema.datasource.fields = {'field1': 1, 'field2': 1}

      var params = ds.provider.buildQueryParams()
      should.exists(params.fields)
      params.fields.should.eql('field1,field2')
      done()
    })

    it('should use the token specified in the datasource config', function(done) {
      done()
    })

    it('should use the token specified in main config if no token is specifed by the datasource ')
  })
})
