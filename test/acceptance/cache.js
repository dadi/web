var crypto = require('crypto')
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
var cache = require(__dirname + '/../../dadi/lib/cache')
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

var pages = []

var fordResult = JSON.stringify({
  results: [{makeName: 'Ford'}]
})

var toyotaResult = JSON.stringify({
  results: [{makeName: 'Toyota'}]
})

var categoriesResult1 = JSON.stringify({
  results: [{name: 'Crime'}]
})

var categoriesResult2 = JSON.stringify({
  results: [{name: 'Horror'}]
})

var carscope
var catscope

var auth
var body = '<html><body>Test</body></html>'

describe('Cache', function (done) {

  beforeEach(function (done) {
    // intercept the api test at server startup
    sinon.stub(libHelp, 'isApiAvailable').yields(null, true)


    // fake token post
    var scope = nock('http://127.0.0.1:3000')
      .post('/token')
      .times(5)
      .reply(200, {
        accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
      })

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

    pages.push(page)
    pages.push(page2)

    done()
  })

  afterEach(function (done) {
    libHelp.isApiAvailable.restore()
    help.clearCache()
    cache.reset()
    help.stopServer(done)
    nock.cleanAll()
  })

  after(function (done) {
    nock.restore()
    done()
  })

  describe('Invalidation API', function (done) {

    beforeEach(function (done) {

      help.clearCache()
      nock.cleanAll()

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(10)
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

      help.startServer(pages, function (server) {

        cache(server).init()
        server.loadApi({})

        var client = request(clientHost)

        client.get('/test').end(function (err, res) {
          if (err) return done(err)
          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('MISS')

          client.get('/extra_test').end(function (err, res) {
            if (err) return done(err)
            res.headers['x-cache'].should.exist
            res.headers['x-cache'].should.eql('MISS')

            client.get('/page2').end(function (err, res) {
              if (err) return done(err)

              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('MISS')
              done()
            })
          })
        })
      })
    })

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
        .times(5)
        .reply(200, {
          accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
        })

      // get cached version of the page
      var client = request(clientHost)
      client
        .get('/test')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('HIT')

          // clear cache for this path
          client
            .post('/api/flush')
            .send(_.extend({path: '/test'}, credentials))
            .end(function (err, res) {

              if (err) return done(err)
              res.body.result.should.equal('success')

              // get page again, should be uncached
              var client = request(clientHost)
              client.get('/test').end(function (err, res) {
                  if (err) return done(err)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('MISS')

                  // get second route again, should still be cached
                  var client = request(clientHost)
                  client.get('/extra_test').end(function (err, res) {
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
        .times(5)
        .reply(200, {
          accessToken: 'da6f610b-6f91-4bce-945d-9829cac5de71'
        })

      // get cached version of the page
      var client = request(clientHost)
      client.get('/test').end(function (err, res) {
        if (err) return done(err)

        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('HIT')

        // clear cache for this path
        client.post('/api/flush')
          .send(_.extend({path: '*'}, credentials))
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)
            res.body.result.should.equal('success')

            // get page again, should be uncached
            client.get('/test').end(function (err, res) {
              if (err) return done(err)

              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('MISS')

              // get second route again, should still be cached
              client.get('/extra_test').end(function (err, res) {
                if (err) return done(err)

                res.headers['x-cache'].should.exist
                res.headers['x-cache'].should.eql('MISS')

                done()
              })
            })
        })
      })
    })

    it.skip('should flush associated datasource files when flushing by path', function (done) {
      config.set('api.enabled', true)

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(5)
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
      client.get('/test').end(function (err, res) {
        if (err) return done(err)

        res.headers['x-cache'].should.exist
        res.headers['x-cache'].should.eql('HIT')

        res.text.should.eql('<ul><li>Ford</li></ul>')

        // get cached version of page2
        client.get('/page2').end(function (err, res) {
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
              client.get('/test').end(function (err, res) {
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
                  client.get('/page2').end(function (err, res) {
                    if (err) return done(err)

                    res.headers['x-cache'].should.exist
                    res.headers['x-cache'].should.eql('MISS')

                    res.text.should.eql('<h3>Crime</h3>')

                    done()
                  })
                }, 1500)
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

  describe('cacheResponse', function (done) {
    it('should write data to a file', function (done) {
      var testConfigPath = config.configPath()
      var testConfigOriginal = fs.readFileSync(testConfigPath)

      var newConfig = JSON.parse(testConfigOriginal)
      newConfig.caching = {
        directory: {
          enabled: true,
          path: './cache/web'
        },
        redis: {
          enabled: false
        }
      }

      fs.writeFileSync(testConfigPath, JSON.stringify(newConfig, null, 2))

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(1)
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


      // delete require.cache[__dirname + '/../../config.js']
      config.loadFile(testConfigPath)

      help.startServer(pages, function (server) {

        cache(server).init()
        server.loadApi({})

        var spy = sinon.spy(fs, 'createWriteStream')

        setTimeout(function() {
          var client = request(clientHost)
          client.get('/test').end(function (err, res) {
            if (err) return done(err)

            var expectedFilename = 'cache/web/' + crypto.createHash('sha1').update('/test').digest('hex') + '.html'
            //console.log(spy)
            spy.lastCall.args[0].should.eql(expectedFilename)

            fs.createWriteStream.restore();
            spy.restore()

            // put that config back!
            fs.writeFileSync(testConfigPath, testConfigOriginal.toString())

            done()
          })
        }, 1000)
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

      fs.writeFileSync(testConfigPath, JSON.stringify(newConfig, null, 2))

      // fake token post
      var scope = nock('http://127.0.0.1:3000')
        .post('/token')
        .times(3)
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


      cache.reset()
      delete require.cache[__dirname + '/../../config.js']
      config.loadFile(testConfigPath)

      var redisClient = fakeredis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3})
      sinon.stub(redis, 'createClient', function () { return redisClient })

      help.startServer(pages, function (server) {

        cache(server).init()

        var spy = sinon.spy(redisClient, 'append')

        var client = request(clientHost)
        client.get('/test').end(function (err, res) {
          if (err) return done(err)

          // put that config back!
          fs.writeFileSync(testConfigPath, testConfigOriginal.toString())

          spy.called.should.eql(true)

          var args = spy.firstCall.args;

          spy.restore();
          redis.createClient.restore();

          (args[1] instanceof Buffer).should.eql(true)

          args[1].toString().should.eql(fordResult)

          done()
        })
      })
    })
  })

})
