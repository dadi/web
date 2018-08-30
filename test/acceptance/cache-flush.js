const fs = require('fs')
const nock = require('nock')
const path = require('path')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')
const url = require('url')

const api = require(`${__dirname}/../../dadi/lib/api`)
const Server = require(`${__dirname}/../../dadi/lib`)
const Page = require(`${__dirname}/../../dadi/lib/page`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const TestHelper = require(`${__dirname}/../help`)()
const config = require(`${__dirname}/../../config`)
const help = require(`${__dirname}/../../dadi/lib/help`)
const remoteProvider = require(`${__dirname}/../../dadi/lib/providers/remote`)
const apiProvider = require(`${__dirname}/../../dadi/lib/providers/dadiapi`)
const Helper = require(`${__dirname}/../../dadi/lib/help`)

const clientHost = `http://${config.get('server.host')}:${config.get(
  'server.port'
)}`
const apiHost = `http://${config.get('api').host}:${config.get('api').port}`
const credentials = {
  clientId: config.get('auth.clientId'),
  secret: config.get('auth.secret')
}

const token = JSON.stringify({
  accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71',
  tokenType: 'Bearer',
  expiresIn: 1800
})

const fordResult = JSON.stringify({
  results: [
    {
      makeName: 'Ford'
    }
  ]
})

const toyotaResult = JSON.stringify({
  results: [
    {
      makeName: 'Toyota'
    }
  ]
})

const categoriesResult1 = JSON.stringify({
  results: [
    {
      name: 'Crime'
    }
  ]
})

const categoriesResult2 = JSON.stringify({
  results: [
    {
      name: 'Horror'
    }
  ]
})

let carscope
let catscope

describe('Cache Flush', function (done) {
  this.timeout(4000)

  let auth
  const body = '<html><body>Test</body></html>'

  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({}).then(() => {
          TestHelper.setupApiIntercepts()
          TestHelper.clearCache()

          // fake api data request
          let dsEndpoint =
            'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
          let dsPath = url.parse(dsEndpoint).path
          carscope = nock('http://127.0.0.1:3000')
            .get(dsPath)
            .times(2)
            .reply(200, fordResult)

          dsEndpoint =
            'http://127.0.0.1:3000/1.0/library/categories?count=20&page=1&filter={}&fields={"name":1}&sort={"name":1}'
          dsPath = url.parse(dsEndpoint).path
          catscope = nock('http://127.0.0.1:3000')
            .get(dsPath)
            .times(2)
            .reply(200, categoriesResult1)

          // create a page
          const name = 'test'
          const schema = TestHelper.getPageSchema()
          const page = Page(name, schema)
          const dsName = 'car_makes_unchained'
          const options = TestHelper.getPathOptions()

          page.datasources = ['car_makes_unchained']
          page.template = 'test_cache_flush.js'

          // add two routes to the page for testing specific path cache clearing
          page.routes[0].path = '/test'
          page.routes.push({ path: '/extra_test' })

          page.events = []

          // create a second page
          const page2 = Page('page2', TestHelper.getPageSchema())
          page2.datasources = ['categories']
          page2.template = 'test.js'

          // add two routes to the page for testing specific path cache clearing
          page2.routes[0].path = '/page2'
          page2.events = []
          // delete page2.route.constraint

          const pages = []
          pages.push(page)
          pages.push(page2)

          TestHelper.startServer(pages).then(() => {
            const client = request(clientHost)

            client
              .get('/test')
              // .expect('content-type', 'text/html')
              // .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                res.headers['x-cache'].should.exist
                res.headers['x-cache'].should.eql('MISS')

                client
                  .get('/extra_test')
                  // .expect('content-type', 'text/html')
                  // .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)
                    res.headers['x-cache'].should.exist
                    res.headers['x-cache'].should.eql('MISS')

                    client
                      .get('/page2')
                      // .expect('content-type', 'text/html')
                      // .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.headers['x-cache'].should.exist
                        res.headers['x-cache'].should.eql('MISS')
                        done()
                      })
                  })
              })
          })
        })
      })
    })
  })

  afterEach(done => {
    TestHelper.resetConfig().then(() => {
      nock.cleanAll()
      TestHelper.clearCache()
      TestHelper.stopServer(done)
    })
  })

  it('should return 401 if clientId and secret are not passed', done => {
    // attempt to clear cache
    const client = request(clientHost)
    client
      .post('/api/flush')
      .set('content-type', 'application/json')
      .send({ path: '/test' })
      .expect(401)
      .end((err, res) => {
        if (err) return done(err)
        done()
      })
  })

  it('should return 401 if clientId and secret are invalid', done => {
    // config.set('api.enabled', true)
    //
    // // fake token post
    // var scope = nock('http://127.0.0.1:3000')
    //   .post('/token')
    //   .times(1)
    //   .reply(200, {
    //     accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
    //   })

    // attempt to clear cache
    const client = request(clientHost)
    client
      .post('/api/flush')
      .set('content-type', 'application/json')
      .send({ path: '/test', clientId: 'x', secret: 'y' })
      .expect(401)
      .end((err, res) => {
        if (err) return done(err)
        done()
      })
  })

  it('should flush only cached items matching the specified path', done => {
    // get cached version of the page
    const client = request(clientHost)
    client
      .get('/test')
      .expect('content-type', 'text/html')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('HIT')

        // clear cache for this path
        client
          .post('/api/flush')
          .send(Object.assign({}, { path: '/test' }, credentials))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            res.body.result.should.equal('success')

            // get page again, should be uncached
            const client = request(clientHost)
            client
              .get('/test')
              .expect('content-type', 'text/html')
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                res.headers['x-cache'].should.exist
                res.headers['x-cache'].should.eql('MISS')

                // get second route again, should still be cached
                const client = request(clientHost)
                client
                  .get('/extra_test')
                  .expect('content-type', 'text/html')
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.headers['x-cache'].should.exist
                    res.headers['x-cache'].should.eql('HIT')
                    done()
                  })
              })
          })
      })
  })

  it('should flush associated datasource files when flushing by path', done => {
    nock.cleanAll()

    // fake token post
    const scope = nock('http://127.0.0.1:3000')
      .post('/token')
      .times(6)
      .reply(200, {
        accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
      })

    // fake api data requests
    let dsEndpoint =
      'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
    let dsPath = url.parse(dsEndpoint).path
    carscope = nock('http://127.0.0.1:3000')
      .get(dsPath)
      .times(1)
      .reply(200, toyotaResult)

    dsEndpoint =
      'http://127.0.0.1:3000/1.0/library/categories?count=20&page=1&filter={}&fields={"name":1}&sort={"name":1}'
    dsPath = url.parse(dsEndpoint).path
    catscope = nock('http://127.0.0.1:3000')
      .get(dsPath)
      .times(1)
      .reply(200, categoriesResult2)

    // get cached version of the page
    const client = request(clientHost)
    client
      .get('/test')
      .expect('content-type', 'text/html')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('HIT')

        res.text.should.eql('<ul><li>Ford</li></ul>')

        // get cached version of page2
        client
          .get('/page2')
          .expect('content-type', 'text/html')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            // res.headers["x-cache"].should.exist
            // res.headers["x-cache"].should.eql("HIT")
            // res.text.should.eql("<h3>Crime</h3>")

            // clear cache for page1
            client
              .post('/api/flush')
              .send(Object.assign({}, { path: '/test' }, credentials))
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                res.body.result.should.equal('success')

                // get first page again, should be uncached and with different data
                client
                  .get('/test')
                  .expect('content-type', 'text/html')
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)
                    res.headers['x-cache'].should.exist
                    res.headers['x-cache'].should.eql('MISS')
                    res.text.should.eql('<ul><li>Toyota</li></ul>')

                    // remove html files so the ds files have to be used to generate
                    // new ones
                    fs.readdir(
                      config.get('caching.directory.path'),
                      (err, files) => {
                        if (err) console.log(err)

                        const filteredFiles = files.filter(
                          file => file.substr(-10) === '.html.gzip'
                        )
                        let filesDeleted = 0

                        filteredFiles.forEach(file => {
                          const filePath = path.resolve(
                            path.join(
                              config.get('caching.directory.path'),
                              file
                            )
                          )

                          fs.unlink(filePath, err => {
                            if (err) console.log(err)

                            filesDeleted++

                            if (filesDeleted === filteredFiles.length) {
                              client
                                .get('/page2')
                                .expect('content-type', 'text/html')
                                .end((err, res) => {
                                  if (err) return done(err)

                                  res.headers['x-cache'].should.exist
                                  res.headers['x-cache'].should.eql('MISS')

                                  res.text.should.eql('<h3>Crime</h3>')

                                  done()
                                })
                            }
                          })
                        })
                      }
                    )
                  })
              })
          })
      })
  })

  it('should flush datasource files when flushing all', done => {
    // fake api data requests
    nock.cleanAll()

    // fake token post
    const scope = nock('http://127.0.0.1:3000')
      .post('/token')
      .times(4)
      .reply(200, {
        accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
      })

    const dsEndpoint =
      'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
    const dsPath = url.parse(dsEndpoint).path
    carscope = nock('http://127.0.0.1:3000')
      .get(dsPath)
      .times(1)
      .reply(200, toyotaResult)

    // get cached version of the page
    const client = request(clientHost)
    client
      .get('/test')
      .expect('content-type', 'text/html')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('HIT')

        res.text.should.eql('<ul><li>Ford</li></ul>')

        // clear cache for this path
        client
          .post('/api/flush')
          .send(Object.assign({}, { path: '*' }, credentials))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            res.body.result.should.equal('success')

            // get page again, should be uncached and with different data
            setTimeout(() => {
              const client = request(clientHost)
              client
                .get('/test')
                .expect('content-type', 'text/html')
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('MISS')

                  res.text.should.eql('<ul><li>Toyota</li></ul>')

                  done()
                })
            }, 500)
          })
      })
  })

  it('should flush all cached items when no path is specified', done => {
    // config.set('api.enabled', true)
    //
    // // fake token post
    // var scope = nock('http://127.0.0.1:3000')
    //   .post('/token')
    //   .times(4)
    //   .reply(200, {
    //     accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
    //   })

    // get cached version of the page
    const client = request(clientHost)

    client
      .get('/test')
      .expect('content-type', 'text/html')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('HIT')

        // clear cache for this path
        client
          .post('/api/flush')
          .send(Object.assign({}, { path: '*' }, credentials))
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            res.body.result.should.equal('success')

            // get page again, should be uncached
            const client = request(clientHost)
            client
              .get('/test')
              .expect('content-type', 'text/html')
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.headers['x-cache'].should.exist
                res.headers['x-cache'].should.eql('MISS')

                // get second route again, should still be cached
                const client = request(clientHost)
                client
                  .get('/extra_test')
                  .expect('content-type', 'text/html')
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.headers['x-cache'].should.exist
                    res.headers['x-cache'].should.eql('MISS')

                    done()
                  })
              })
          })
      })
  })
})
