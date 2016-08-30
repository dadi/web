var _ = require('underscore')
var fs = require('fs')
var request = require('supertest')
var should = require('should')
var sinon = require('sinon')
var path = require('path')

var api = require(__dirname + '/../../dadi/lib/api')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var datasource = require(__dirname + '/../../dadi/lib/datasource')
var libHelp = require(__dirname + '/../../dadi/lib/help')
var Page = require(__dirname + '/../../dadi/lib/page')
var remoteProvider = require(__dirname + '/../../dadi/lib/providers/remote')
var Router = require(__dirname + '/../../dadi/lib/controller/router')
var Server = require(__dirname + '/../../dadi/lib')
var TestHelper = require(__dirname + '/../help')()
var config = require(path.resolve(path.join(__dirname, '/../../config')))

var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

function cleanupPath (path, done) {
  try {
    fs.unlink(path, function () {
      done()
    })
  } catch (err) {
    console.log(err)
  }
}

var constraintsPath = __dirname + '/../app/routes/constraints.js'

describe('Router', function (done) {
  beforeEach(function (done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {

        // write a temporary constraints file
        var constraints = ''
        constraints += 'module.exports.getCategories = function (req, res, callback) {  \n'
        constraints += '  return callback(false);\n'
        constraints += '};\n'

        fs.writeFileSync(constraintsPath, constraints)

        done()
      })
    })
  })

  afterEach(function (done) {
    TestHelper.stopServer(function() {
      // remove temporary constraints file
      cleanupPath(constraintsPath, done)
    })
  })

  it('should attach to the provided server instance', function (done) {
    Server.app = api()
    var server = Server

    Router(server, {})
    server.app.Router.should.exist

    done()
  })

  it('should assign null to handlers if no js file found', function (done) {
    Server.app = api()
    var server = Server

    Router(server, {})

    server.app.Router.handlers.should.eql([])

    done()
  })

  it('should assign handlers if js file found', function (done) {
    Server.app = api()
    var server = Server

    Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') })

    server.app.Router.handlers['getCategories'].should.exist

    done()
  })

  describe('Redirects/Rewrites', function (done) {
    describe('Configurable', function (done) {
      beforeEach(function (done) {
        TestHelper.resetConfig().then(() => {
          done()
        })
      })

      it('should redirect to lowercased URL if the current request URL is not all lowercase', function (done) {
        var routerConfig = {
          rewrites: {
            forceLowerCase: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            var pages = TestHelper.setUpPages()
            pages[0].datasources = ['car-makes']

            // provide API response
            var results = { results: [{'make': 'ford'}] }
            var providerStub = sinon.stub(remoteProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              var client = request(connectionString)
              client
              .get('/TeSt')
              .end(function (err, res) {
                if (err) return done(err)

                providerStub.restore()

                res.statusCode.should.eql(301)
                res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/test')
                done()
              })
            })
          })
        })
      })

      it('should add a trailing slash and redirect if the current request URL does not end with a slash', function (done) {
        var routerConfig = {
          rewrites: {
            forceTrailingSlash: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            var pages = TestHelper.setUpPages()
            pages[0].datasources = ['car-makes']

            // provide API response
            var results = { results: [{'make': 'ford'}] }
            var providerStub = sinon.stub(remoteProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              var client = request(connectionString)
              client
              .get('/test')
              .end(function (err, res) {
                if (err) return done(err)
                providerStub.restore()
                res.statusCode.should.eql(301)
                res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/test/')
                done()
              })
            })
          })
        })
      })

      it('should strip specified index pages from the current request URL', function (done) {
        var routerConfig = {
          rewrites: {
            stripIndexPages: ['index.php', 'default.aspx'],
            forceLowerCase: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            var pages = TestHelper.setUpPages()
            pages[0].datasources = ['car-makes']

            // provide API response
            var results = { results: [{'make': 'ford'}] }
            var providerStub = sinon.stub(remoteProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              var client = request(connectionString)
              client
                .get('/tEsT/dEfaUlt.aspx')
                .end(function (err, res) {
                  if (err) return done(err)

                  providerStub.restore()
                  res.statusCode.should.eql(301)
                  res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/test/')
                  done()
                })
            })
          })
        })
      })

      it('should add a trailing slash and lowercase the URL if both settings are true', function (done) {
        var routerConfig = {
          rewrites: {
            forceTrailingSlash: true,
            forceLowerCase: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            var pages = TestHelper.setUpPages()
            pages[0].datasources = ['car-makes']

            // provide API response
            var results = { results: [{'make': 'ford'}] }
            var providerStub = sinon.stub(remoteProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              var client = request(connectionString)
              client
                .get('/tESt')
                .end(function (err, res) {
                  if (err) return done(err)

                  providerStub.restore()
                  res.statusCode.should.eql(301)
                  res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/test/')
                  done()
                })
            })
          })
        })
      })
    })

    it('should redirect to new location if the current request URL is found in a datasource query result', function (done) {
      var routerConfig = {
        rewrites: {
          forceLowerCase: true,
          allowJsonView: true,
          loadDatasourceAsFile: false,
          datasource: 'redirects'
        }
      }

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig(routerConfig).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ['redirects']

          // provide API response
          var redirectResults = { results: [{'rule': '/test', 'replacement': '/books', 'redirectType': 301}] }
          var providerStub = sinon.stub(remoteProvider.prototype, 'load')
          providerStub.yields(null, redirectResults)

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)
            client
              .get(pages[0].routes[0].path)
              .end(function (err, res) {
                if (err) return done(err)

                providerStub.restore()
                res.statusCode.should.eql(301)
                res.headers.location.should.eql('http://' + config.get('server.host') + ':' + config.get('server.port') + '/books')
                done()
              })
          })
        })
      })
    })
  })

  describe('Add Constraint', function (done) {
    it('should add a constraint if the provided route specifies a constraint handler', function (done) {
      Server.app = api()
      var server = Server

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') })

      // create a page with a constrained route
      var schema = TestHelper.getPageSchema()
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'getCategories'
      var page = Page('test', schema)

      server.app.Router.constrain(page.routes[0].path, page.routes[0].constraint)

      should.exist(server.app.Router.constraints['/test'])
      done()
    })

    it('should throw error if the provided route specifies a missing constraint handler', function (done) {
      Server.app = api()
      var server = Server

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') })

      // create a page with a constrained route
      var schema = TestHelper.getPageSchema()
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'XXX'
      var page = Page('test', schema)

      should.throws(function () { server.app.Router.constrain(page.routes[0].path, page.route.constraint); }, Error)

      done()
    })
  })

  describe('Page Routing', function () {
    var pageRouteConfig

    before(function(done) {
      var routerConfig = {
        rewrites: {
          forceTrailingSlash: false,
          forceLowerCase: true,
          allowJsonView: true,
          loadDatasourceAsFile: false,
          datasource: ''
        }
      }

      TestHelper.updateConfig(routerConfig).then(() => {
        done()
      })
    })

    describe('`in` Parameter', function () {
      before(function() {
        pageRouteConfig = {
          routes: [
            {
              path: '/test/:title',
              params: [
                {
                  param: 'title',
                  in: ['war-and-peace']
                }
              ]
            }
          ]
        }
      })

      it('should return 200 OK if the parameter matches one in the array', function(done) {
        TestHelper.disableApiConfig().then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].routes = pageRouteConfig.routes

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)
            client.get('/test/war-and-peace')
            .end(function (err, res) {
              if (err) return done(err)
              res.statusCode.should.eql(200)
              done()
            })
          })
        })
      })

      it('should return 404 NOT FOUND if the parameter does not match one in the array', function(done) {
        TestHelper.disableApiConfig().then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].routes = pageRouteConfig.routes

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)
            client.get('/test/to-kill-a-mockingbird')
            .end(function (err, res) {
              if (err) return done(err)
              res.statusCode.should.eql(404)
              done()
            })
          })
        })
      })
    })

    describe('`preload` Parameter', function () {
      before(function() {
        pageRouteConfig = {
          routes: [
            {
              path: '/test/:make',
              params: [
                {
                  param: "make",
                  preload: {
                    source: "car-makes",
                    field: "make"
                  }
                }
              ]
            }
          ]
        }
      })

      it('should return 200 OK if the parameter matches preloaded data', function(done) {
        TestHelper.updateConfig({data: { preload: ['car-makes']}}).then(() => {
          TestHelper.disableApiConfig().then(() => {
            var pages = TestHelper.setUpPages()
            pages[0].routes = pageRouteConfig.routes

            // provide API response
            var results = { results: [{ "make": "ford" }, { "make": "mazda" }, { "make": "toyota" }] }
            var providerStub = sinon.stub(remoteProvider.prototype, 'load')
            providerStub.onFirstCall().yields(null, results)

            TestHelper.startServer(pages).then(() => {
              var client = request(connectionString)
              client.get('/test/mazda')
              .end(function (err, res) {
                if (err) return done(err)
                providerStub.restore()
                res.statusCode.should.eql(200)
                done()
              })
            })
          })
        })
      })

      it('should return 404 NOT FOUND if the parameter does not match preloaded data', function(done) {
        TestHelper.updateConfig({data: { preload: ['car-makes']}}).then(() => {
          TestHelper.disableApiConfig().then(() => {
            var pages = TestHelper.setUpPages()
            pages[0].routes = pageRouteConfig.routes

            // provide API response
            var results = { results: [{ "make": "ford" }, { "make": "mazda" }, { "make": "toyota" }] }
            var providerStub = sinon.stub(remoteProvider.prototype, 'load')
            providerStub.onFirstCall().yields(null, results)

            TestHelper.startServer(pages).then(() => {
              var client = request(connectionString)
              client.get('/test/mitsubishi')
              .end(function (err, res) {
                if (err) return done(err)
                providerStub.restore()
                res.statusCode.should.eql(404)
                done()
              })
            })
          })
        })
      })
    })

    describe('`fetch` Parameter', function () {
      before(function() {
        pageRouteConfig = {
          routes: [
            {
              path: '/test/:make',
              params: [
                {
                  fetch: "car-makes-unchained"
                }
              ]
            }
          ]
        }
      })

      it('should return 200 OK if the parameter matches a datasource lookup', function(done) {
        TestHelper.updateConfig({data: { preload: []}}).then(() => {
          TestHelper.disableApiConfig().then(() => {
            var pages = TestHelper.setUpPages()
            pages[0].routes = pageRouteConfig.routes

            // provide API response
            var results = { results: [{ "name": "ford" }, { "name": "mazda" }, { "name": "toyota" }] }
            var providerStub = sinon.stub(remoteProvider.prototype, 'load')
            providerStub.onFirstCall().yields(null, results)

            TestHelper.startServer(pages).then(() => {
              var client = request(connectionString)
              client.get('/test/ford')
              .end(function (err, res) {
                if (err) return done(err)
                providerStub.restore()
                res.statusCode.should.eql(200)
                done()
              })
            })
          })
        })
      })

      it('should return 404 NOT FOUND if the parameter does not match a datasource lookup', function(done) {
        TestHelper.updateConfig({data: { preload: []}}).then(() => {
          TestHelper.disableApiConfig().then(() => {
            var pages = TestHelper.setUpPages()
            pages[0].routes = pageRouteConfig.routes

            // provide API response
            var results = { results: [] }
            var providerStub = sinon.stub(remoteProvider.prototype, 'load')
            providerStub.onFirstCall().yields(null, results)

            TestHelper.startServer(pages).then(() => {
              var client = request(connectionString)
              client.get('/test/mitsubishi')
              .end(function (err, res) {
                if (err) return done(err)
                providerStub.restore()
                res.statusCode.should.eql(404)
                done()
              })
            })
          })
        })
      })
    })
  })

  describe('Test Constraint', function (done) {
    it('should return true if the route does not have a constraint', function (done) {
      Server.app = api()
      var server = Server

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') })

      // create a page with a constrained route
      var schema = TestHelper.getPageSchema()
      schema.routes[0].path = '/test'
      var page = Page('test', schema)

      var req = {}, res = {}

      server.app.Router.testConstraint(page.routes[0].path, req, res, function (result) {
        result.should.eql(true)
        done()
      })
    })

    it('should return false if the route constraint returns false', function (done) {
      Server.app = api()
      var server = Server

      Router(server, { routesPath: path.resolve(__dirname + '/../app/routes') })

      // create a page with a constrained route
      var schema = TestHelper.getPageSchema()
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'getCategories'
      var page = Page('test', schema)

      server.app.Router.constrain(page.routes[0].path, page.routes[0].constraint)

      var req = { url: '/test' }, res = {}

      server.app.Router.testConstraint(page.routes[0].path, req, res, function (result) {
        result.should.eql(false)
        done()
      })
    })
  })
})
