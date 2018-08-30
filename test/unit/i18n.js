var fs = require('fs')
var nock = require('nock')
var path = require('path')
var sinon = require('sinon')
var should = require('should')
var Readable = require('stream').Readable
var request = require('supertest')
var zlib = require('zlib')

var Server = require(__dirname + '/../../dadi/lib')
var TestHelper = require(__dirname + '/../help')()
var api = require(__dirname + '/../../dadi/lib/api')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var Datasource = require(__dirname + '/../../dadi/lib/datasource')
var help = require(__dirname + '/../../dadi/lib/help')
var page = require(__dirname + '/../../dadi/lib/page')

var apiProvider = require(__dirname + '/../../dadi/lib/providers/dadiapi')
var remoteProvider = require(__dirname + '/../../dadi/lib/providers/remote')
var restProvider = require(__dirname + '/../../dadi/lib/providers/restapi')
var markdownProvider = require(__dirname + '/../../dadi/lib/providers/markdown')

var config = require(path.resolve(path.join(__dirname, '/../../config')))
var controller

describe('Data Providers', function (done) {
  beforeEach(function (done) {
    TestHelper.clearCache()

    var apiHost =
      'http://' + config.get('api').host + ':' + config.get('api').port

    scope = nock(apiHost)
      .post('/token')
      .times(5)
      .reply(200, { accessToken: 'xx' })

    var scope1 = nock(apiHost)
      .get('/')
      .reply(200)

    var configUpdate = {
      server: {
        host: '127.0.0.1',
        port: 5000
      }
    }

    TestHelper.updateConfig(configUpdate).then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(function (done) {
    nock.cleanAll()
    TestHelper.stopServer(function () {})
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  describe('Multi-lang', function (done) {
    it('should pass the lang variable to the dadiapi endpoint', function (done) {
      var clientHost =
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      var apiHost =
        'http://' + config.get('api').host + ':' + config.get('api').port

      var client = request(clientHost)
      var endpoint1 =
        '/1.0/library/categories?count=20&page=1&filter={"name":"foobar"}&fields={"name":1}&sort={"name":1}&lang=en'
      var scope2 = nock(apiHost)
        .get(encodeURI(endpoint1))
        .reply(200, JSON.stringify({ results: [{ name: 'foobar' }] }))

      // create page 1
      var page1 = page('langedpage', TestHelper.getPageSchema())
      page1.datasources = ['categories']
      page1.template = 'test.js'
      page1.routes[0].path = '/:lang/categories/:category'
      page1.events = []

      var pages = []
      pages.push(page1)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client
            .get('/en/categories/foobar')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        })
      })
    })

    it('should not pass the lang variable to the dadiapi endpoint when it is not defined in the page routes', function (done) {
      var clientHost =
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      var apiHost =
        'http://' + config.get('api').host + ':' + config.get('api').port

      var client = request(clientHost)
      var endpoint1 =
        '/1.0/library/categories?count=20&page=1&filter={"name":"foobar"}&fields={"name":1}&sort={"name":1}'
      var scope2 = nock(apiHost)
        .get(encodeURI(endpoint1))
        .reply(200, JSON.stringify({ results: [{ name: 'foobar' }] }))

      // create page 1
      var page1 = page('langedpage', TestHelper.getPageSchema())
      page1.datasources = ['categories']
      page1.template = 'test.js'
      page1.routes[0].path = '/categories/:category'
      page1.events = []

      var pages = []
      pages.push(page1)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client
            .get('/categories/foobar')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        })
      })
    })

    it('should not pass the lang variable to the dadiapi endpoint when i18n is false in the DS schema', function (done) {
      var clientHost =
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      var apiHost =
        'http://' + config.get('api').host + ':' + config.get('api').port

      var client = request(clientHost)
      var endpoint1 =
        '/1.0/library/categories?count=20&page=1&filter={"name":"foobar"}&fields={"name":1}&sort={"name":1}'
      var scope2 = nock(apiHost)
        .get(encodeURI(endpoint1))
        .reply(200, JSON.stringify({ results: [{ name: 'foobar' }] }))

      // create page 1
      var page1 = page('langedpage', TestHelper.getPageSchema())
      page1.datasources = ['categories_i18n_false']
      page1.template = 'test.js'
      page1.routes[0].path = '/:lang/categories/:category'
      page1.events = []

      var pages = []
      pages.push(page1)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client
            .get('/en/categories/foobar')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              done()
            })
        })
      })
    })
  })
})
