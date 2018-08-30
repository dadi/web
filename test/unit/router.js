const fs = require('fs')
const nock = require('nock')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')
const path = require('path')

const api = require(`${__dirname}/../../dadi/lib/api`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const libHelp = require(`${__dirname}/../../dadi/lib/help`)
const Page = require(`${__dirname}/../../dadi/lib/page`)
const apiProvider = require(`${__dirname}/../../dadi/lib/providers/dadiapi`)
const Router = require(`${__dirname}/../../dadi/lib/controller/router`)
const Server = require(`${__dirname}/../../dadi/lib`)
const TestHelper = require(`${__dirname}/../help`)()
const config = require(path.resolve(path.join(__dirname, '/../../config')))

const connectionString = `http://${config.get('server.host')}:${config.get(
  'server.port'
)}`

function cleanupPath (path, done) {
  try {
    fs.unlink(path, () => {
      done()
    })
  } catch (err) {
    console.log(err)
  }
}

const constraintsPath = `${__dirname}/../app/routes/constraints.js`

describe('Router', done => {
  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        // write a temporary constraints file
        let constraints = ''
        constraints +=
          'module.exports.getCategories = function (req, res, callback) {  \n'
        constraints += '  return callback(false);\n'
        constraints += '};\n'

        fs.writeFileSync(constraintsPath, constraints)

        done()
      })
    })
  })

  afterEach(done => {
    TestHelper.updateConfig({ rewrites: { path: '' } }).then(() => {
      TestHelper.stopServer(() => {
        // remove temporary constraints file
        cleanupPath(constraintsPath, done)
      })
    })
  })

  it('should attach to the provided server instance', done => {
    Server.app = api()
    const server = Server

    Router(server, {})
    server.app.Router.should.exist

    done()
  })

  it('should assign null to handlers if no js file found', done => {
    Server.app = api()
    const server = Server

    Router(server, {})

    server.app.Router.handlers.should.eql([])

    done()
  })

  it('should assign handlers if js file found', done => {
    Server.app = api()
    const server = Server

    Router(server, { routesPath: path.resolve(`${__dirname}/../app/routes`) })

    server.app.Router.handlers['getCategories'].should.exist

    done()
  })

  it('should load rewrite rules if found', done => {
    const routerConfig = {
      rewrites: {
        forceLowerCase: true,
        allowDebugView: true,
        loadDatasourceAsFile: false,
        path: 'test/app/routes/rewrites.txt'
      }
    }

    TestHelper.disableApiConfig().then(() => {
      TestHelper.updateConfig(routerConfig).then(() => {
        Server.app = api()
        const server = Server

        Router(server, {
          routesPath: path.resolve(`${__dirname}/../app/routes`)
        })

        server.app.Router.loadRewrites({}, () => {
          server.app.Router.rules.length.should.be.above(0)

          const routerConfig = {
            rewrites: {
              forceLowerCase: true,
              allowDebugView: true,
              loadDatasourceAsFile: false,
              path: ''
            }
          }

          TestHelper.updateConfig(routerConfig).then(() => {
            done()
          })
        })
      })
    })
  })

  describe('Redirects/Rewrites', done => {
    describe('Configurable', done => {
      beforeEach(done => {
        TestHelper.resetConfig().then(() => {
          TestHelper.setupApiIntercepts()
          done()
        })
      })

      it('should redirect to lowercased URL if the current request URL is not all lowercase', done => {
        const routerConfig = {
          rewrites: {
            forceLowerCase: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['car_makes']

            // provide API response
            const results = { results: [{ make: 'ford' }] }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/TeSt').end((err, res) => {
                if (err) return done(err)

                providerStub.restore()

                res.statusCode.should.eql(301)
                res.headers.location.should.eql(
                  `http://${config.get('server.host')}:${config.get(
                    'server.port'
                  )}/test`
                )
                done()
              })
            })
          })
        })
      })

      it('should not redirect to lowercased URL if only URL parameters are not lowercase', done => {
        const routerConfig = {
          rewrites: {
            forceLowerCase: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['car_makes_unchained']

            // provide API response
            const results = { results: [{ make: 'ford' }] }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/test?p=OMG').end((err, res) => {
                if (err) return done(err)

                providerStub.restore()

                should.not.exist(res.headers.location)
                res.statusCode.should.eql(200)
                done()
              })
            })
          })
        })
      })

      it('should not lowercase URL parameters when redirecting to lowercase URL', done => {
        const routerConfig = {
          rewrites: {
            forceLowerCase: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['car_makes_unchained']

            // provide API response
            const results = { results: [{ make: 'ford' }] }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/tEsT?p=OMG').end((err, res) => {
                if (err) return done(err)

                providerStub.restore()

                res.statusCode.should.eql(301)
                res.headers.location.should.eql(
                  'http://127.0.0.1:5000/test?p=OMG'
                )
                done()
              })
            })
          })
        })
      })

      it('should add a trailing slash and redirect if the current request URL does not end with a slash', done => {
        const routerConfig = {
          rewrites: {
            forceTrailingSlash: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['car_makes']

            // provide API response
            const results = { results: [{ make: 'ford' }] }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/test').end((err, res) => {
                if (err) return done(err)
                providerStub.restore()
                res.statusCode.should.eql(301)
                res.headers.location.should.eql(
                  `http://${config.get('server.host')}:${config.get(
                    'server.port'
                  )}/test/`
                )
                done()
              })
            })
          })
        })
      })

      it('should strip specified index pages from the current request URL', done => {
        const routerConfig = {
          rewrites: {
            stripIndexPages: ['index.php', 'default.aspx'],
            forceLowerCase: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['car_makes']

            // provide API response
            const results = { results: [{ make: 'ford' }] }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/tEsT/dEfaUlt.aspx').end((err, res) => {
                if (err) return done(err)

                providerStub.restore()
                res.statusCode.should.eql(301)
                res.headers.location.should.eql(
                  `http://${config.get('server.host')}:${config.get(
                    'server.port'
                  )}/test/`
                )
                done()
              })
            })
          })
        })
      })

      it('should add a trailing slash and lowercase the URL if both settings are true', done => {
        const routerConfig = {
          rewrites: {
            forceTrailingSlash: true,
            forceLowerCase: true
          }
        }

        TestHelper.disableApiConfig().then(() => {
          TestHelper.updateConfig(routerConfig).then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['car_makes']

            // provide API response
            const results = { results: [{ make: 'ford' }] }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/tESt').end((err, res) => {
                if (err) return done(err)

                providerStub.restore()
                res.statusCode.should.eql(301)
                res.headers.location.should.eql(
                  `http://${config.get('server.host')}:${config.get(
                    'server.port'
                  )}/test/`
                )
                done()
              })
            })
          })
        })
      })
    })

    it('should redirect to new location if the current request URL is found in a rewrites file', done => {
      TestHelper.setupApiIntercepts()

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          rewrites: { path: 'test/app/routes/rewrites.txt' }
        }).then(() => {
          const pages = TestHelper.setUpPages()

          const apiConnectionString = `http://${config.get('api').host}:${
            config.get('api').port
          }`
          const scope = nock(apiConnectionString)
            .get(
              '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D'
            )
            .reply(200, {})

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client.get(pages[0].routes[0].path).end((err, res) => {
              res.statusCode.should.eql(301)
              res.headers.location.should.eql(
                'http://www.example.com/new-site/test'
              )
              done()
            })
          })
        })
      })
    })

    it('should return 403 status if redirect rule specifies it', done => {
      TestHelper.setupApiIntercepts()

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          rewrites: { path: 'test/app/routes/rewrites.txt' }
        }).then(() => {
          const pages = TestHelper.setUpPages()

          const apiConnectionString = `http://${config.get('api').host}:${
            config.get('api').port
          }`
          const scope = nock(apiConnectionString)
            .get(
              '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D'
            )
            .reply(200, {})

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client.get('/test/403').end((err, res) => {
              res.statusCode.should.eql(403)
              done()
            })
          })
        })
      })
    })

    it('should return 410 status if redirect rule specifies it', done => {
      TestHelper.setupApiIntercepts()

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          rewrites: { path: 'test/app/routes/rewrites.txt' }
        }).then(() => {
          const pages = TestHelper.setUpPages()

          const apiConnectionString = `http://${config.get('api').host}:${
            config.get('api').port
          }`
          const scope = nock(apiConnectionString)
            .get(
              '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D'
            )
            .reply(200, {})

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client.get('/test/410').end((err, res) => {
              res.statusCode.should.eql(410)
              done()
            })
          })
        })
      })
    })

    it('should return content-type if redirect rule specifies it', done => {
      TestHelper.setupApiIntercepts()

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          rewrites: { path: 'test/app/routes/rewrites.txt' }
        }).then(() => {
          const pages = TestHelper.setUpPages()

          const apiConnectionString = `http://${config.get('api').host}:${
            config.get('api').port
          }`
          const scope = nock(apiConnectionString)
            .get(
              '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D'
            )
            .reply(200, {})

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client.get('/test/type').end((err, res) => {
              res.statusCode.should.eql(301)
              res.headers.location.should.eql(
                'http://www.example.com/new-site/test'
              )
              res.headers['content-type'].should.eql('application/xml')
              done()
            })
          })
        })
      })
    })

    it.skip('should invert redirect rule', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          rewrites: { path: 'test/app/routes/rewrites.txt' }
        }).then(() => {
          const pages = TestHelper.setUpPages()

          const page1 = Page('page10', TestHelper.getPageSchema())
          page1.template = 'test.js'
          page1.routes[0].path = '/test/assets/images/main'
          page1.datasources = []
          page1.events = []
          page1.settings.cache = false
          pages.push(page1)

          const page2 = Page('page200', TestHelper.getPageSchema())
          page2.template = 'test.js'
          page2.routes[0].path = '/index'
          page2.datasources = []
          page2.events = []
          page2.settings.cache = false
          pages.push(page2)

          console.log(pages)

          const apiConnectionString = `http://${config.get('api').host}:${
            config.get('api').port
          }`
          const scope = nock(apiConnectionString)
            .get(
              '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D'
            )
            .reply(200, {})

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client.get('/test/assets/images/main').end((err, res) => {
              console.log(res)
              res.statusCode.should.eql(301)
              res.headers.location.should.eql(
                'http://www.example.com/new-site/test'
              )
              done()
            })
          })
        })
      })
    })

    it('should proxy the request if rewrite rule specifies', done => {
      TestHelper.setupApiIntercepts()

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          rewrites: { path: 'test/app/routes/rewrites.txt' }
        }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].routes[0].path = '/test/proxy'

          const scope = nock('http://cdn.example.com')
            .get('/proxy')
            .reply(200, 'PROXY!')

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client.get('/test/proxy').end((err, res) => {
              res.statusCode.should.eql(200)
              should.exist(res.headers.via)
              res.text.should.eql('PROXY!')
              done()
            })
          })
        })
      })
    })

    it('should redirect to new location if the current request URL is found in a datasource query result', done => {
      const routerConfig = {
        rewrites: {
          forceLowerCase: true,
          allowDebugView: true,
          loadDatasourceAsFile: false,
          datasource: 'redirects'
        }
      }

      TestHelper.setupApiIntercepts()

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig(routerConfig).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['redirects']

          // provide API response
          const redirectResults = {
            results: [
              { rule: '/test', replacement: '/books', redirectType: 301 }
            ]
          }
          const providerStub = sinon.stub(apiProvider.prototype, 'load')
          providerStub.yields(null, redirectResults)

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client.get(pages[0].routes[0].path).end((err, res) => {
              if (err) return done(err)

              providerStub.restore()
              res.statusCode.should.eql(301)
              res.headers.location.should.eql(
                `http://${config.get('server.host')}:${config.get(
                  'server.port'
                )}/books`
              )
              done()
            })
          })
        })
      })
    })

    it('should add Cache-Control headers to redirects', done => {
      const configUpdate = {
        headers: {
          cacheControl: {
            301: 'no-cache'
          }
        },
        rewrites: {
          forceLowerCase: true,
          allowDebugView: true,
          loadDatasourceAsFile: false,
          datasource: 'redirects'
        }
      }

      TestHelper.setupApiIntercepts()

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig(configUpdate).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['redirects']

          // provide API response
          const redirectResults = {
            results: [
              { rule: '/test', replacement: '/books', redirectType: 301 }
            ]
          }
          const providerStub = sinon.stub(apiProvider.prototype, 'load')
          providerStub.yields(null, redirectResults)

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client.get(pages[0].routes[0].path).end((err, res) => {
              if (err) return done(err)

              providerStub.restore()

              res.statusCode.should.eql(301)
              should.exist(res.headers['cache-control'])
              res.headers['cache-control'].should.eql('no-cache')
              res.headers.location.should.eql(
                `http://${config.get('server.host')}:${config.get(
                  'server.port'
                )}/books`
              )
              done()
            })
          })
        })
      })
    })
  })

  describe('Add Constraint', done => {
    it('should add a constraint if the provided route specifies a constraint handler', done => {
      Server.app = api()
      const server = Server

      Router(server, { routesPath: path.resolve(`${__dirname}/../app/routes`) })

      // create a page with a constrained route
      const schema = TestHelper.getPageSchema()
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'getCategories'
      const page = Page('test', schema)

      server.app.Router.constrain(
        page.routes[0].path,
        page.routes[0].constraint
      )

      should.exist(server.app.Router.constraints['/test'])
      done()
    })

    it('should throw error if the provided route specifies a missing constraint handler', done => {
      Server.app = api()
      const server = Server

      Router(server, { routesPath: path.resolve(`${__dirname}/../app/routes`) })

      // create a page with a constrained route
      const schema = TestHelper.getPageSchema()
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'XXX'
      const page = Page('test', schema)

      should.throws(() => {
        server.app.Router.constrain(page.routes[0].path, page.route.constraint)
      }, Error)

      done()
    })
  })

  describe('Page Routing', () => {
    let pageRouteConfig

    before(done => {
      const routerConfig = {
        rewrites: {
          forceTrailingSlash: false,
          forceLowerCase: true,
          allowDebugView: true,
          loadDatasourceAsFile: false,
          datasource: ''
        }
      }

      TestHelper.updateConfig(routerConfig).then(() => {
        done()
      })
    })

    describe('`in` Parameter', () => {
      before(() => {
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

      it('should return 200 OK if the parameter matches one in the array', done => {
        TestHelper.updateConfig({ data: { preload: [] } }).then(() => {
          TestHelper.disableApiConfig().then(() => {
            TestHelper.setupApiIntercepts()
            const pages = TestHelper.setUpPages()
            pages[0].routes = pageRouteConfig.routes

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/test/war-and-peace').end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)
                done()
              })
            })
          })
        })
      })

      it('should return 404 NOT FOUND if the parameter does not match one in the array', done => {
        TestHelper.disableApiConfig().then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].routes = pageRouteConfig.routes

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client.get('/test/to-kill-a-mockingbird').end((err, res) => {
              if (err) return done(err)
              res.statusCode.should.eql(404)
              done()
            })
          })
        })
      })
    })

    describe('`preload` Parameter', () => {
      before(() => {
        pageRouteConfig = {
          routes: [
            {
              path: '/test/:make',
              params: [
                {
                  param: 'make',
                  preload: {
                    source: 'car_makes',
                    field: 'make'
                  }
                }
              ]
            }
          ]
        }
      })

      it('should return 200 OK if the parameter matches preloaded data', done => {
        TestHelper.updateConfig({
          data: { preload: ['car_makes'] }
        }).then(() => {
          TestHelper.disableApiConfig().then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].routes = pageRouteConfig.routes

            // provide API response
            const results = {
              results: [{ make: 'ford' }, { make: 'mazda' }, { make: 'toyota' }]
            }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.onFirstCall().yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/test/mazda').end((err, res) => {
                if (err) return done(err)
                providerStub.restore()
                res.statusCode.should.eql(200)
                done()
              })
            })
          })
        })
      })

      it('should return 404 NOT FOUND if the parameter does not match preloaded data', done => {
        TestHelper.updateConfig({
          data: { preload: ['car_makes'] }
        }).then(() => {
          TestHelper.disableApiConfig().then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].routes = pageRouteConfig.routes

            // provide API response
            const results = {
              results: [{ make: 'ford' }, { make: 'mazda' }, { make: 'toyota' }]
            }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.onFirstCall().yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/test/mitsubishi').end((err, res) => {
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

    describe('`fetch` Parameter', () => {
      before(() => {
        pageRouteConfig = {
          routes: [
            {
              path: '/test/:make',
              params: [
                {
                  fetch: 'car_makes_unchained'
                }
              ]
            }
          ]
        }
      })

      it('should return 200 OK if the parameter matches a datasource lookup', done => {
        TestHelper.updateConfig({ data: { preload: [] } }).then(() => {
          TestHelper.disableApiConfig().then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].routes = pageRouteConfig.routes

            // provide API response
            const results = {
              results: [{ name: 'ford' }, { name: 'mazda' }, { name: 'toyota' }]
            }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.onFirstCall().yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/test/ford').end((err, res) => {
                if (err) return done(err)
                providerStub.restore()
                res.statusCode.should.eql(200)
                done()
              })
            })
          })
        })
      })

      it('should return 404 NOT FOUND if the parameter does not match a datasource lookup', done => {
        TestHelper.updateConfig({ data: { preload: [] } }).then(() => {
          TestHelper.disableApiConfig().then(() => {
            const pages = TestHelper.setUpPages()
            pages[0].routes = pageRouteConfig.routes

            // provide API response
            const results = { results: [] }
            const providerStub = sinon.stub(apiProvider.prototype, 'load')
            providerStub.onFirstCall().yields(null, results)

            TestHelper.startServer(pages).then(() => {
              const client = request(connectionString)
              client.get('/test/mitsubishi').end((err, res) => {
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

  describe('Test Constraint', done => {
    it('should return true if the route does not have a constraint', done => {
      Server.app = api()
      const server = Server

      Router(server, { routesPath: path.resolve(`${__dirname}/../app/routes`) })

      // create a page with a constrained route
      const schema = TestHelper.getPageSchema()
      schema.routes[0].path = '/test'
      const page = Page('test', schema)

      const req = {}
      const res = {}

      server.app.Router.testConstraint(
        page.routes[0].path,
        req,
        res,
        (err, passed) => {
          passed.should.eql(true)
          done()
        }
      )
    })

    it('should return false if the route constraint returns false', done => {
      Server.app = api()
      const server = Server

      Router(server, { routesPath: path.resolve(`${__dirname}/../app/routes`) })

      // create a page with a constrained route
      const schema = TestHelper.getPageSchema()
      schema.routes[0].path = '/test'
      schema.routes[0].constraint = 'getCategories'
      const page = Page('test', schema)

      server.app.Router.constrain(
        page.routes[0].path,
        page.routes[0].constraint
      )

      const req = { url: '/test' }
      const res = {}

      server.app.Router.testConstraint(
        page.routes[0].path,
        req,
        res,
        (err, passed) => {
          passed.should.eql(false)
          done()
        }
      )
    })
  })
})
