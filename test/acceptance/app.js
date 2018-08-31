const nock = require('nock')
const path = require('path')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

const api = require(`${__dirname}/../../dadi/lib/api`)
const cache = require(`${__dirname}/../../dadi/lib/cache`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const page = require(`${__dirname}/../../dadi/lib/page`)
const TestHelper = require(`${__dirname}/../help`)()
const Server = require(`${__dirname}/../../dadi/lib`)
const config = require(path.resolve(path.join(__dirname, '/../../config')))

const secureClientHost = `https://${config.get('server.host')}:${config.get(
  'server.port'
)}`
const secureClient = request(secureClientHost)
let scope

describe('Application', () => {
  beforeEach(done => {
    TestHelper.clearCache()

    const apiHost = `http://${config.get('api').host}:${config.get('api').port}`

    scope = nock(apiHost)
      .post('/token')
      .times(5)
      .reply(200, { accessToken: 'xx' })

    const scope1 = nock(apiHost)
      .get('/')
      .reply(200)

    const configUpdate = {
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

  afterEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.stopServer(done)
    })
  })

  after(done => {
    delete require.cache[path.resolve(path.join(__dirname, '/../../config'))]

    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.stopServer(done)
      })
    })
  })

  describe('Cache', () => {
    it('should return MISS when not found in cache', done => {
      const clientHost = `http://${config.get('server.host')}:${config.get(
        'server.port'
      )}`
      const apiHost = `http://${config.get('api').host}:${
        config.get('api').port
      }`

      const client = request(clientHost)
      const endpoint1 =
        '/1.0/library/categories?count=20&page=1&filter=%7B%22name%22:%22Crime%22%7D&fields=%7B%22name%22:1%7D&sort=%7B%22name%22:1%7D'
      const scope2 = nock(apiHost)
        .get(endpoint1)
        .reply(200, JSON.stringify({ results: [{ name: 'Crime' }] }))

      // create page 1
      const page1 = page('page1', TestHelper.getPageSchema())
      page1.datasources = ['categories']
      page1.template = 'test.js'
      page1.routes[0].path = '/categories/:category'
      page1.events = []

      const pages = []
      pages.push(page1)

      // console.log(pages)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get('/categories/Crime').end((err, res) => {
            if (err) return done(err)
            should.exist(res.headers['x-cache'])
            res.headers['x-cache'].should.eql('MISS')
            res.text.should.eql('<h3>Crime</h3>')

            done()
          })
        })
      })
    })
  })

  describe('Status Endpoint', () => {
    describe('GET', () => {
      it('should return 405 error', done => {
        const clientHost = `http://${config.get('server.host')}:${config.get(
          'server.port'
        )}`
        const apiHost = `http://${config.get('api').host}:${
          config.get('api').port
        }`
        const client = request(clientHost)

        const pages = TestHelper.setUpPages()

        TestHelper.enableApiConfig().then(() => {
          TestHelper.startServer(pages).then(() => {
            client
              .get('/api/status')
              .expect(405)
              .end(done)
          })
        })
      })
    })

    describe('POST', () => {
      it('should return 401 error if clientId or secret are not specified', done => {
        const clientHost = `http://${config.get('server.host')}:${config.get(
          'server.port'
        )}`
        const apiHost = `http://${config.get('api').host}:${
          config.get('api').port
        }`
        const client = request(clientHost)

        const pages = TestHelper.setUpPages()

        TestHelper.enableApiConfig().then(() => {
          TestHelper.startServer(pages).then(() => {
            client
              .post('/api/status')
              .send({})
              .expect(401)
              .end(done)
          })
        })
      })

      it('should return 401 error if clientId or secret do not match config', done => {
        const clientHost = `http://${config.get('server.host')}:${config.get(
          'server.port'
        )}`
        const apiHost = `http://${config.get('api').host}:${
          config.get('api').port
        }`
        const client = request(clientHost)

        const pages = TestHelper.setUpPages()

        TestHelper.enableApiConfig().then(() => {
          TestHelper.startServer(pages).then(() => {
            client
              .post('/api/status')
              .send({
                clientId: 'xyz',
                secret: '123'
              })
              .expect(401)
              .end(done)
          })
        })
      })

      it('should return status information if correct credentials posted', function (done) {
        this.timeout(10000)

        const clientHost = `http://${config.get('server.host')}:${config.get(
          'server.port'
        )}`
        const apiHost = `http://${config.get('api').host}:${
          config.get('api').port
        }`
        const client = request(clientHost)

        const pages = TestHelper.setUpPages()

        TestHelper.enableApiConfig().then(() => {
          TestHelper.updateConfig({
            status: {
              routes: [
                {
                  route: '/test'
                }
              ]
            }
          }).then(() => {
            TestHelper.startServer(pages).then(() => {
              client
                .post('/api/status')
                .set('content-type', 'application/json')
                .send({
                  secret: config.get('auth.secret'),
                  clientId: config.get('auth.clientId')
                })
                .expect(200)
                .end(done)
            })
          })
        })
      })
    })
  })

  describe('Error Pages', () => {
    it('should return HTML error when no custom page exists', done => {
      const clientHost = `http://${config.get('server.host')}:${config.get(
        'server.port'
      )}`
      const apiHost = `http://${config.get('api').host}:${
        config.get('api').port
      }`
      const client = request(clientHost)

      // create page 1
      const page1 = page('page1', TestHelper.getPageSchema())
      page1.datasources = []
      page1.template = 'test.js'
      page1.routes[0].path = '/test'
      page1.events = ['test_500_error']

      const pages = []
      pages.push(page1)

      TestHelper.enableApiConfig().then(() => {
        TestHelper.startServer(pages).then(() => {
          client.get('/test').end((err, res) => {
            if (err) return done(err)
            res.headers['content-type'].should.eql('text/html')
            res.text
              .indexOf('<h1>Something went wrong.</h1>')
              .should.be.above(0)
            done()
          })
        })
      })
    })
  })
})
