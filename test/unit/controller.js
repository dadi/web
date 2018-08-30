const nock = require('nock')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

const api = require(`${__dirname}/../../dadi/lib/api`)
const Server = require(`${__dirname}/../../dadi/lib`)
const Page = require(`${__dirname}/../../dadi/lib/page`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const Datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const TestHelper = require(`${__dirname}/../help`)()
const config = require(`${__dirname}/../../config`)
const help = require(`${__dirname}/../../dadi/lib/help`)
const remoteProvider = require(`${__dirname}/../../dadi/lib/providers/remote`)
const apiProvider = require(`${__dirname}/../../dadi/lib/providers/dadiapi`)
const rssProvider = require(`${__dirname}/../../dadi/lib/providers/rss`)

const connectionString = `http://${config.get('server.host')}:${config.get(
  'server.port'
)}`

describe('Controller', done => {
  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(done => {
    TestHelper.stopServer(done)
  })

  it('should return a 404 template if one is configured', done => {
    TestHelper.disableApiConfig().then(() => {
      const pages = TestHelper.setUp404Page()
      pages[0].settings.cache = false

      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)

        client
          .get('/not-a-page')
          .expect(404)
          .end((err, res) => {
            if (err) return done(err)

            res.text.should.eql('<p>Page Not Found Template</p>')

            done()
          })
      })
    })
  })

  it('should return a 404 if requiredDatasources are not populated', done => {
    TestHelper.disableApiConfig().then(() => {
      const pages = TestHelper.setUpPages()
      pages[0].settings.cache = false
      pages[0].datasources = ['categories']
      pages[0].requiredDatasources = ['categories']

      TestHelper.startServer(pages).then(() => {
        // provide empty API response
        const results = { results: [] }
        sinon
          .stub(Controller.Controller.prototype, 'loadData')
          .yields(null, results)

        const client = request(connectionString)

        client
          .get(pages[0].routes[0].path)
          .expect(404)
          .end((err, res) => {
            if (err) return done(err)
            Controller.Controller.prototype.loadData.restore()
            done()
          })
      })
    })
  })

  it('should return a 200 if a page requiredDatasources are populated', done => {
    TestHelper.disableApiConfig().then(() => {
      TestHelper.updateConfig({
        allowDebugView: true
      }).then(() => {
        const pages = TestHelper.setUpPages()
        pages[0].datasources = ['categories']
        pages[0].requiredDatasources = ['categories']

        TestHelper.startServer(pages).then(() => {
          // provide API response
          const results = {
            debugView: 'json',
            categories: { results: [{ _id: 1, name: 'books' }] }
          }
          sinon
            .stub(Controller.Controller.prototype, 'loadData')
            .yields(null, results)

          const client = request(connectionString)
          client
            .get(`${pages[0].routes[0].path}?debug=json`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              should.exist(res.body.categories)
              res.body.categories.results.length.should.be.above(0)
              Controller.Controller.prototype.loadData.restore()
              done()
            })
        })
      })
    })
  })

  /*
  If CSRF is used (csrf enabled in web config), then any POST requests must provide a valid token under the name _csrf, and if it either isn't present or is incorrect, then a 403 is generated, which currently gets picked up by web for the custom error page.

  Also, if csrf is enabled, the csrfToken should be present on the view model.
  */
  describe('CSRF', () => {
    it('should add a csrfToken to the view context', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          security: {
            csrf: true
          }
        }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = []

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                should.exist(res.body.csrfToken)
                done()
              })
          })
        })
      })
    })

    it('should set a cookie with the csrf secret', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          security: {
            csrf: true
          }
        }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = []

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .expect(200)
              .expect(TestHelper.shouldSetCookie('_csrf'))
              .end((err, res) => {
                if (err) return done(err)
                done()
              })
          })
        })
      })
    })

    it('should return a 403 if a POST request is missing a csrf token', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          security: {
            csrf: true
          }
        }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['categories']

          TestHelper.startServer(pages).then(() => {
            // provide API response
            const results = {
              categories: { results: [{ _id: 1, title: 'books' }] }
            }

            sinon
              .stub(Controller.Controller.prototype, 'loadData')
              .yields(null, results)

            const client = request(connectionString)
            client
              .post(`${pages[0].routes[0].path}?debug=json`)
              .send()
              .expect(403)
              .end((err, res) => {
                if (err) return done(err)
                Controller.Controller.prototype.loadData.restore()
                res.text.indexOf('invalid csrf token').should.be.above(0)
                done()
              })
          })
        })
      })
    })

    it('should return 403 when POST request contains an invalid csrfToken', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          security: {
            csrf: true
          }
        }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = []

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .expect(200)
              .expect(TestHelper.shouldSetCookie('_csrf'))
              .end((err, res) => {
                if (err) return done(err)
                should.exist(res.body.csrfToken)

                client
                  .post(pages[0].routes[0].path)
                  .set(
                    'Cookie',
                    `_csrf=${TestHelper.extractCookieValue(res, '_csrf')}`
                  )
                  .send({ _csrf: 'XXX' })
                  .expect(403)
                  .end((err, res) => {
                    if (err) return done(err)
                    res.text.indexOf('invalid csrf token').should.be.above(0)
                    done()
                  })
              })
          })
        })
      })
    })

    it('should return 200 when POST request contains a valid csrfToken', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          security: {
            csrf: true
          }
        }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = []

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)
            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .expect(200)
              .expect(TestHelper.shouldSetCookie('_csrf'))
              .end((err, res) => {
                if (err) return done(err)
                should.exist(res.body.csrfToken)

                client
                  .post(pages[0].routes[0].path)
                  .set(
                    'Cookie',
                    `_csrf=${TestHelper.extractCookieValue(res, '_csrf')}`
                  )
                  .send({ _csrf: res.body.csrfToken.toString() })
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)
                    res.text.indexOf('invalid csrf token').should.equal(-1)
                    done()
                  })
              })
          })
        })
      })
    })
  })

  describe('Events', done => {
    it('should load events in the order they are specified', done => {
      TestHelper.disableApiConfig().then(() => {
        const pages = TestHelper.setUpPages()
        pages[0].events = ['b', 'a']

        controller = Controller(pages[0], TestHelper.getPathOptions())
        controller.events.should.exist
        controller.events[0].name.should.eql('b')
        controller.events[1].name.should.eql('a')
        done()
      })
    })

    it('should run events in the order they are specified', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].events = ['b', 'a']

          TestHelper.startServer(pages).then(() => {
            // provide event response
            const method = sinon.spy(
              Controller.Controller.prototype,
              'loadEventData'
            )

            const client = request(connectionString)
            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                if (err) return done(err)

                Controller.Controller.prototype.loadEventData.restore()
                method.restore()

                method.called.should.eql(true)
                method.secondCall.args[0][0].should.eql(controller.events[0])

                res.body['b'].should.eql('I came from B')
                res.body['a'].should.eql('Results for B found: true')
                done()
              })
          })
        })
      })
    })

    it('should run events sequentially, even if they are asynchronous', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].events = ['asyncA', 'asyncB']

          TestHelper.startServer(pages).then(() => {
            // provide event response
            const method = sinon.spy(
              Controller.Controller.prototype,
              'loadEventData'
            )

            const client = request(connectionString)
            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                if (err) return done(err)

                Controller.Controller.prototype.loadEventData.restore()
                method.restore()

                res.body.asyncA.should.eql('Modified by A')
                res.body.asyncB.should.eql('A said: "Modified by A"')
                done()
              })
          })
        })
      })
    })
  })

  describe('Preload Events', done => {
    it('should load preloadEvents in the controller instance', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ globalEvents: [] }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].events = ['test_event']
          pages[0].preloadEvents = ['test_preload_event']

          controller = Controller(pages[0], TestHelper.getPathOptions())
          should.exist(controller.preloadEvents)
          controller.preloadEvents[0].name.should.eql(pages[0].preloadEvents[0])
          done()
        })
      })
    })

    it('should run preloadEvents within the get request', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].events = ['test_event']
          pages[0].preloadEvents = ['test_preload_event']

          TestHelper.startServer(pages).then(() => {
            // provide event response
            const results = { results: [{ _id: 1, title: 'books' }] }
            const method = sinon.spy(
              Controller.Controller.prototype,
              'loadEventData'
            )

            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                if (err) return done(err)
                method.restore()
                method.called.should.eql(true)
                method.firstCall.args[0].should.eql(controller.preloadEvents)

                res.body['preload'].should.eql(true)
                res.body['run'].should.eql(true)

                done()
              })
          })
        })
      })
    })
  })

  describe('Global Events', done => {
    it('should load globalEvents in the controller instance', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          globalEvents: ['test_global_event']
        }).then(() => {
          const pages = TestHelper.setUpPages()

          TestHelper.startServer(pages).then(() => {
            controller = Controller(pages[0], TestHelper.getPathOptions())
            controller.events.should.exist
            controller.events[0].name.should.eql('test_global_event')
            done()
          })
        })
      })
    })

    it('should run globalEvents within the get request', done => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          allowDebugView: true,
          globalEvents: ['test_global_event']
        }).then(() => {
          const pages = TestHelper.setUpPages()

          TestHelper.startServer(pages).then(() => {
            // provide event response
            const results = { results: [{ _id: 1, title: 'books' }] }
            const method = sinon.spy(
              Controller.Controller.prototype,
              'loadEventData'
            )

            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                if (err) return done(err)
                method.restore()
                method.called.should.eql(true)
                method.firstCall.args[0].should.eql(controller.preloadEvents)

                res.body['global_event'].should.eql('FIRED')

                done()
              })
          })
        })
      })
    })
  })

  describe('Chained Datasource', function () {
    TestHelper.clearCache()
    this.timeout(5000)

    it('should inject datasource output params to a chained datasource filter', done => {
      TestHelper.enableApiConfig().then(() => {
        const pages = TestHelper.setUpPages()
        pages[0].datasources = ['global', 'car_makes']

        const host = `http://${config.get('api').host}:${
          config.get('api').port
        }`

        const endpointGlobal =
          '/1.0/system/all?count=20&page=1&filter=%7B%7D&fields=%7B%7D&sort=%7B%22name%22:1%7D'

        const results1 = JSON.stringify({
          results: [{ id: '1234', name: 'Test' }]
        })
        const results2 = JSON.stringify({ results: [{ name: 'Crime' }] })

        TestHelper.setupApiIntercepts()

        const scope1 = nock(host)
          .get(endpointGlobal)
          .reply(200, results1)

        const scope2 = nock(host)
          .get(/cars\/makes/)
          .reply(200, results2)

        const providerSpy = sinon.spy(apiProvider.prototype, 'load')

        TestHelper.startServer(pages)
          .then(() => {
            const client = request(connectionString)

            client.get(pages[0].routes[0].path).end((err, res) => {
              if (err) return done(err)

              providerSpy.restore()

              const call = providerSpy.secondCall
              const provider = call.thisValue

              const q = require('url').parse(provider.options.path, true).query
              const filter = q.filter
              const filterObj = JSON.parse(filter)
              should.exist(filterObj._id)
              filterObj._id.should.eql('1234')

              done()
            })
          })
          .catch(err => {
            done(err)
          })
      })
    })

    it('should inject datasource output params to a chained datasource endpoint', done => {
      TestHelper.enableApiConfig().then(() => {
        const pages = TestHelper.setUpPages()

        pages[0].datasources = ['global', 'car_makes_chained_endpoint']

        const host = `http://${config.get('api').host}:${
          config.get('api').port
        }`

        const endpointGlobal =
          '/1.0/system/all?count=20&page=1&filter=%7B%7D&fields=%7B%7D&sort=%7B%22name%22:1%7D'

        const results1 = JSON.stringify({
          results: [{ id: '1234', name: 'Test' }]
        })

        TestHelper.setupApiIntercepts()

        const scope1 = nock(host)
          .get(endpointGlobal)
          .reply(200, results1)

        // response if everything went fine
        const scope2 = nock(host)
          .get('/1.0/makes/Test')
          .reply(200, { ok: true })

        TestHelper.startServer(pages)
          .then(() => {
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                if (err) return done(err)
                should.exist(res.body['car_makes_chained_endpoint'])
                res.body['car_makes_chained_endpoint'].ok.should.eql(true)

                done()
              })
          })
          .catch(err => {
            done(err)
          })
      })
    })
  })

  describe('Datasource Filter Events', done => {
    it('should run an attached `filterEvent` before datasource loads', done => {
      TestHelper.enableApiConfig().then(() => {
        const pages = TestHelper.setUpPages()
        pages[0].datasources = ['car_makes_unchained', 'filters']

        const host = `http://${config.get('api').host}:${
          config.get('api').port
        }`

        const endpoint1 =
          '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D'
        const endpoint2 =
          '/1.0/test/filters?count=20&page=1&filter=%7B%22y%22:%222%22,%22x%22:%221%22%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D'

        const results1 = JSON.stringify({ results: [{ name: 'Crime' }] })
        const results2 = JSON.stringify({ results: [{ name: 'Crime' }] })

        TestHelper.setupApiIntercepts()

        const scope1 = nock(host)
          .get(endpoint1)
          .reply(200, results1)

        const scope2 = nock(host)
          .get(endpoint2)
          .reply(200, results2)

        const providerSpy = sinon.spy(apiProvider.prototype, 'load')

        TestHelper.startServer(pages).then(() => {
          const client = request(connectionString)
          client
            .get(`${pages[0].routes[0].path}?debug=json`)
            .end((err, res) => {
              if (err) return done(err)
              providerSpy.restore()

              res.body['car_makes_unchained'].should.exist
              res.body['filters'].should.exist

              const filterDatasource = providerSpy.thisValues[1]

              const q = require('url').parse(
                filterDatasource.options.path,
                true
              ).query
              const filter = q.filter
              const filterObj = JSON.parse(filter)

              filterDatasource.schema.datasource.filterEventResult.should.exist
              filterDatasource.schema.datasource.filterEventResult.x.should
                .exist
              filterDatasource.schema.datasource.filterEventResult.x.should.eql(
                '1'
              )

              filterObj.x.should.exist
              filterObj.x.should.eql('1')

              filterObj.y.should.exist
              filterObj.y.should.eql('2')

              done()
            })
        })
      })
    })
  })

  describe('Datasource Endpoint Events', done => {
    it('should run an attached `endpointEvent` before datasource loads', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'rss'
      )

      dsSchema.datasource.endpointEvent = 'test_endpoint_event'

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      const pages = TestHelper.setUpPages()
      pages[0].datasources = ['rss']

      const host = 'http://www.feedforall.com:80'

      const endpoint1 = '/sample.json'

      const feedData = `<?xml version="1.0" encoding="windows-1252"?>
        <rss version="2.0">
          <channel>
            <title>FeedForAll Sample Feed</title>
            <description>RSS</description>
            <link>http://www.feedforall.com/industry-solutions.htm</link>
            <category domain="www.dmoz.com">Computers/Software/Internet/Site Management/Content Management</category>
            <copyright>Copyright 2004 NotePage, Inc.</copyright>
            <docs>http://blogs.law.harvard.edu/tech/rss</docs>
            <language>en-us</language>
            <lastBuildDate>Tue, 19 Oct 2004 13:39:14 -0400</lastBuildDate>
            <managingEditor>marketing@feedforall.com</managingEditor>
            <pubDate>Tue, 19 Oct 2004 13:38:55 -0400</pubDate>
            <webMaster>webmaster@feedforall.com</webMaster>
            <generator>FeedForAll Beta1 (0.0.1.8)</generator>
            <image>
              <url>http://www.feedforall.com/ffalogo48x48.gif</url>
              <title>FeedForAll Sample Feed</title>
              <link>http://www.feedforall.com/industry-solutions.htm</link>
              <description>FeedForAll Sample Feed</description>
              <width>48</width>
              <height>48</height>
            </image>
            <item>
              <title>RSS Solutions for Restaurants</title>
              <description>XXX</description>
              <link>http://www.feedforall.com/restaurant.htm</link>
              <category domain="www.dmoz.com">Computers/Software/Internet/Site Management/Content Management</category>
              <comments>http://www.feedforall.com/forum</comments>
              <pubDate>Tue, 19 Oct 2004 11:09:11 -0400</pubDate>
            </item>
          </channel>
        </rss>`

      const scope1 = nock(host)
        .get(endpoint1)
        .reply(200, feedData)

      const providerSpy = sinon.spy(rssProvider.prototype, 'load')

      TestHelper.startServer(pages).then(() => {
        const client = request(connectionString)
        client.get(`${pages[0].routes[0].path}?debug=json`).end((err, res) => {
          if (err) return done(err)
          providerSpy.restore()
          Datasource.Datasource.prototype.loadDatasource.restore()

          res.body.rss.should.exist
          res.body.rss[0].title.should.eql('RSS Solutions for Restaurants')

          const datasource = providerSpy.firstCall.thisValue

          datasource.endpoint.should.exist
          datasource.endpoint.should.eql(host + endpoint1)
          done()
        })
      })
    })
  })
})
