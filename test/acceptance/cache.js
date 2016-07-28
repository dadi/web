var fs = require('fs')
var nock = require('nock')
var sinon = require('sinon')
var should = require('should')
var request = require('supertest')
// loaded customised fakeweb module
var fakeweb = require(__dirname + '/../fakeweb')
var fakeredis = require('fakeredis')
var redis = require('redis')
var http = require('http')
var _ = require('underscore')
var path = require('path')
var url = require('url')
var assert = require('assert')

var Server = require(__dirname + '/../../dadi/lib')
var Page = require(__dirname + '/../../dadi/lib/page')
var help = require(__dirname + '/../help')
var libHelp = require(__dirname + '/../../dadi/lib/help')
var config = require(__dirname + '/../../config.js')

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var apiHost = 'http://' + config.get('api.host') + ':' + config.get('api.port')
var credentials = { clientId: config.get('auth.clientId'), secret: config.get('auth.secret') }

var token = JSON.stringify({
  'accessToken': 'da6f610b-6f91-4bce-945d-9829cac5de71',
  'tokenType': 'Bearer',
  'expiresIn': 1800
})

var fordResult = JSON.stringify({
  results: [
    {
      makeName: 'Ford'
    }
  ]
})

var toyotaResult = JSON.stringify({
  results: [
    {
      makeName: 'Toyota'
    }
  ]
})

var categoriesResult1 = JSON.stringify({
  results: [
    {
      name: 'Crime'
    }
  ]
})

var categoriesResult2 = JSON.stringify({
  results: [
    {
      name: 'Horror'
    }
  ]
})

var carscope
var catscope

var auth
var body = '<html><body>Test</body></html>'

describe('Cache', function (done) {

  beforeEach(function (done) {

    // intercept the api test at server startup
    sinon.stub(libHelp, 'isApiAvailable').yields(null, true)

    help.clearCache()

    // fake token post
    var scope = nock('http://127.0.0.1:3000')
      .post('/token')
      .times(5)
      .reply(200, {
        accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
      })

    // fake api data request
    var dsEndpoint = 'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
    var dsPath = url.parse(dsEndpoint).path
    carscope = nock('http://127.0.0.1:3000')
      .get(dsPath)
      .times(2)
      .reply(200, fordResult)

    dsEndpoint = 'http://127.0.0.1:3000/1.0/library/categories?count=20&page=1&filter={}&fields={"name":1}&sort={"name":1}'
    dsPath = url.parse(dsEndpoint).path
    catscope = nock('http://127.0.0.1:3000')
      .get(dsPath)
      .times(2)
      .reply(200, categoriesResult1)

    // create a page
    var name = 'test'
    var schema = help.getPageSchema()
    var page = Page(name, schema)
    var dsName = 'car-makes-unchained'
    var options = help.getPathOptions()

    page.datasources = ['car-makes-unchained']
    page.template = 'test_cache_flush.dust'

    // add two routes to the page for testing specific path cache clearing
    page.route.paths[0] = '/test'
    page.route.paths[1] = '/extra_test'

    page.events = []
    delete page.route.constraint

    // create a second page
    var page2 = Page('page2', help.getPageSchema())
    page2.datasources = ['categories']
    page2.template = 'test.dust'

    // add two routes to the page for testing specific path cache clearing
    page2.route.paths[0] = '/page2'
    page2.events = []
    delete page2.route.constraint

    var pages = []
    pages.push(page)
    pages.push(page2)

    help.startServer(pages, function () {

      console.log(pages)
      var client = request(clientHost)

      client
        .get('/test')
        // .expect('content-type', 'text/html')
        // .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('MISS')

          client
            .get('/extra_test')
            // .expect('content-type', 'text/html')
            // .expect(200)
            .end(function (err, res) {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('MISS')

              client
                .get('/page2')
                // .expect('content-type', 'text/html')
                // .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('MISS')
                  done()
                })
            })
        })
    })
  })

  afterEach(function (done) {
    nock.cleanAll()
    libHelp.isApiAvailable.restore()
    help.clearCache()
    help.stopServer(done)
  })

  after(function (done) {
    nock.restore()
    done()
  })

  describe.only('cacheResponse', function (done) {
    it.skip('should write data to a file', function (done) {
      config.set('caching.directory.enabled', true)
      config.set('caching.redis.enabled', false)

      ds.schema.datasource.caching.enabled = true

      var c = cache(server.object)

      // create a file
      var filename = crypto.createHash('sha1').update(ds.name).digest('hex') + '_' + crypto.createHash('sha1').update(ds.endpoint).digest('hex')
      cachepath = path.join(ds.schema.datasource.caching.directory, filename + '.' + ds.schema.datasource.caching.extension)

      var data = 'ds content from filesystem'
      var dsCache = new datasourceCache(ds)

      dsCache.cacheResponse(data, function () {
        fs.readFile(cachepath, function (err, content) {
          content.toString().should.eql(data)
          done()
        })
      })
    })

    it('should write to a redis client if configured', function (done) {
      config.set('api.enabled', true)

      var testConfigPath = config.configPath()
      var testConfigOriginal = fs.readFileSync(testConfigPath)

      var newConfig = JSON.parse(testConfigOriginal)
      newConfig.caching = {
        directory: {
          enabled: false
        },
        redis: {
          enabled: true
        }
      }

      console.log(testConfigPath)
      console.log(newConfig)

      fs.writeFileSync(testConfigPath, JSON.stringify(newConfig, null, 2))

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(3)
        .reply(200, {
          accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
        })

      cache.reset()
      delete require.cache[configPath]
      config.loadFile(configPath)

      var redisClient = fakeredis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3})
      sinon.stub(redis, 'createClient', function () { return redisClient })

      var spy = sinon.spy(redisClient, 'exists')

      // get cached version of the page
      var client = request(clientHost)
      client
        .get('/test')
        //.expect('content-type', 'text/html')
        // .expect(200)
        .end(function (err, res) {
          console.log(res)
          if (err) return done(err)

          // put that config back!
          fs.writeFileSync(testConfigPath, JSON.stringify(testConfigOriginal, null, 2))

          //console.log(spy)

          spy.restore()
          redis.createClient.restore()

          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('HIT')


          done()
        })

    })
  })

  describe('Invalidation API', function (done) {

    it('should return 401 if clientId and secret are not passed', function (done) {
      config.set('api.enabled', true)

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(1)
        .reply(200, {
          accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
        })

      // attempt to clear cache
      var client = request(clientHost)
      client
        .post('/api/flush')
        .send({path: '/test'})
        .expect(401)
        .end(function (err, res) {
          if (err) return done(err)
          done()
        })
    })

    it('should return 401 if clientId and secret are invalid', function (done) {
      config.set('api.enabled', true)

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(1)
        .reply(200, {
          accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
        })

      // attempt to clear cache
      var client = request(clientHost)
      client
        .post('/api/flush')
        .send({path: '/test', clientId: 'x', secret: 'y'})
        .expect(401)
        .end(function (err, res) {
          if (err) return done(err)
          done()
        })
    })

    it('should flush only cached items matching the specified path', function (done) {
      config.set('api.enabled', true)

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(3)
        .reply(200, {
          accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
        })

      // get cached version of the page
      var client = request(clientHost)
      client
        .get('/test')
        .expect('content-type', 'text/html')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('HIT')

          // clear cache for this path
          client
            .post('/api/flush')
            .send(_.extend({path: '/test'}, credentials))
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)
              res.body.result.should.equal('success')

              // get page again, should be uncached
              var client = request(clientHost)
              client
                .get('/test')
                .expect('content-type', 'text/html')
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('MISS')

                  // get second route again, should still be cached
                  var client = request(clientHost)
                  client
                    .get('/extra_test')
                    .expect('content-type', 'text/html')
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)

                      res.headers['x-cache'].should.exist
                      res.headers['x-cache'].should.eql('HIT')
                      done()
                    })
                })
            })
        })
    })

    it('should flush all cached items when no path is specified', function (done) {
      config.set('api.enabled', true)

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(4)
        .reply(200, {
          accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
        })

      // get cached version of the page
      var client = request(clientHost)
      client
        .get('/test')
        .expect('content-type', 'text/html')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('HIT')

          // clear cache for this path
          client
            .post('/api/flush')
            .send(_.extend({path: '*'}, credentials))
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)
              res.body.result.should.equal('success')

              // get page again, should be uncached
              var client = request(clientHost)
              client
                .get('/test')
                .expect('content-type', 'text/html')
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('MISS')

                  // get second route again, should still be cached
                  var client = request(clientHost)
                  client
                    .get('/extra_test')
                    .expect('content-type', 'text/html')
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)

                      res.headers['x-cache'].should.exist
                      res.headers['x-cache'].should.eql('MISS')

                      done()
                    })
                })
            })
        })
    })

    it('should flush associated datasource files when flushing by path', function (done) {
      config.set('api.enabled', true)

      nock.cleanAll()

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(4)
        .reply(200, {
          accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
        })

      // fake api data requests
      var dsEndpoint = 'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
      var dsPath = url.parse(dsEndpoint).path
      carscope = nock('http://127.0.0.1:3000')
        .get(dsPath)
        .times(1)
        .reply(200, toyotaResult)

      dsEndpoint = 'http://127.0.0.1:3000/1.0/library/categories?count=20&page=1&filter={}&fields={"name":1}&sort={"name":1}'
      dsPath = url.parse(dsEndpoint).path
      catscope = nock('http://127.0.0.1:3000')
        .get(dsPath)
        .times(1)
        .reply(200, categoriesResult2)

      // get cached version of the page
      var client = request(clientHost)
      client
        .get('/test')
        .expect('content-type', 'text/html')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('HIT')

          res.text.should.eql('<ul><li>Ford</li></ul>')

          // get cached version of page2
          client
            .get('/page2')
            .expect('content-type', 'text/html')
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)

              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('HIT')
              res.text.should.eql('<h3>Crime</h3>')

              // clear cache for page1
              client
                .post('/api/flush')
                .send(_.extend({path: '/test'}, credentials))
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)
                  res.body.result.should.equal('success')

                  // get first page again, should be uncached and with different data
                  // var client = request(clientHost)
                  client
                    .get('/test')
                    .expect('content-type', 'text/html')
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)

                      res.headers['x-cache'].should.exist
                      res.headers['x-cache'].should.eql('MISS')
                      res.text.should.eql('<ul><li>Toyota</li></ul>')

                      setTimeout(function () {
                        // remove html files so the ds files have to be used to generate
                        // new ones
                        var files = fs.readdirSync(config.get('caching.directory.path'))
                        files.filter(function (file) {
                          return file.substr(-5) === '.html'
                        }).forEach(function (file) {
                          fs.unlinkSync(path.join(config.get('caching.directory.path'), file))
                        })

                        // get second page again, should return same data
                        // var client = request(clientHost)
                        client
                          .get('/page2')
                          .expect('content-type', 'text/html')
                          .expect(200)
                          .end(function (err, res) {
                            if (err) return done(err)

                            res.headers['x-cache'].should.exist
                            res.headers['x-cache'].should.eql('MISS')

                            res.text.should.eql('<h3>Crime</h3>')

                            done()
                          })
                      }, 500)
                    })
                })
            })
        })
    })

    it('should flush datasource files when flushing all', function (done) {
      config.set('api.enabled', true)

      // fake api data requests
      nock.cleanAll()

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(4)
        .reply(200, {
          accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
        })

      var dsEndpoint = 'http://127.0.0.1:3000/1.0/cars/makes?count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'
      var dsPath = url.parse(dsEndpoint).path
      carscope = nock('http://127.0.0.1:3000')
        .get(dsPath)
        .times(1)
        .reply(200, toyotaResult)

      // get cached version of the page
      var client = request(clientHost)
      client
        .get('/test')
        .expect('content-type', 'text/html')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('HIT')

          res.text.should.eql('<ul><li>Ford</li></ul>')

          // clear cache for this path
          client
            .post('/api/flush')
            .send(_.extend({path: '*'}, credentials))
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)
              res.body.result.should.equal('success')

              // get page again, should be uncached and with different data
              var client = request(clientHost)
              client
                .get('/test')
                .expect('content-type', 'text/html')
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('MISS')

                  res.text.should.eql('<ul><li>Toyota</li></ul>')

                  done()
                })
            })
        })
    })
  })
})
