var fs = require('fs')
var path = require('path')
var url = require('url')
var util = require('util')
var crypto = require('crypto')
var should = require('should')
var sinon = require('sinon')
var redis = require('redis')

var api = require(__dirname + '/../../dadi/lib/api')
var config = require(path.resolve(path.join(__dirname, '/../../config')))
var cache = require(__dirname + '/../../dadi/lib/cache')
var datasourceCache = require(__dirname + '/../../dadi/lib/cache/datasource')
var Datasource = require(__dirname + '/../../dadi/lib/datasource')
var page = require(__dirname + '/../../dadi/lib/page')
var Server = require(__dirname + '/../../dadi/lib')
var TestHelper = require(__dirname + '/../help')()

var server
var ds
var cachepath

describe('Datasource Cache', function (done) {
  beforeEach(function (done) {
    datasourceCache._reset()

    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        new Datasource(page('test', TestHelper.getPageSchema()), 'car-makes', TestHelper.getPathOptions()).init(function (err, datasource) {
          ds = datasource

          server = sinon.mock(Server)
          server.object.app = api()
          cache.reset()

          done()
        })
      })
    })
  })

  afterEach(function (done) {
    try {
      if (cachepath) fs.unlinkSync(cachepath)
    } catch (err) {}

    cache.reset()
    done()
  })

  describe('Module', function (done) {
    it('should be a function', function (done) {
      datasourceCache.should.be.Function
      done()
    })

    it("should not cache if the app's config settings don't allow", function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: false
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        var dsCache = datasourceCache()
        dsCache.enabled.should.eql(false)
        done()
      })
    })

    it("should cache if the app's config settings allow", function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        var dsCache = datasourceCache()
        dsCache.enabled.should.eql(true)
        done()
      })
    })

    it("should use main cache settings if the datasource doesn't provide any directory options", function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true,
            path: '/Users',
            extension: 'cache'
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        delete ds.schema.datasource.caching.directory.path
        var c = cache(server.object)
        var dsCache = datasourceCache()
        dsCache.getOptions(ds).directory.path.indexOf('/Users').should.be.above(-1)
        done()
      })
    })

    it("should use .json for extension if the datasource doesn't provide any options", function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true,
            path: '/Users',
            extension: 'cache'
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        delete ds.schema.datasource.caching.directory.extension
        var c = cache(server.object)
        var dsCache = datasourceCache()
        dsCache.getOptions(ds).directory.extension.should.eql('json')

        done()
      })
    })

    it('should use datasource name as first part of cache filename', function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        var c = cache(server.object)
        var dsCache = new datasourceCache(ds)
        var expectToFind = crypto.createHash('sha1').update(ds.schema.datasource.key).digest('hex')
        var dsCache = datasourceCache()
        dsCache.getFilename(ds).indexOf(expectToFind).should.be.above(-1)
        done()
      })
    })
  })

  describe('cachingEnabled', function (done) {
    it("should not cache if the datasources config settings don't allow", function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }


      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.directory.enabled = false
        var c = cache(server.object)
        var dsCache = datasourceCache()
        dsCache.cachingEnabled(ds).should.eql(false)
        done()
      })
    })

    it('should not cache if the datasource endpoint has ?cache=false', function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.enabled = true
        ds.provider.endpoint += '&cache=false'
        var c = cache(server.object)
        var dsCache = datasourceCache()
        dsCache.cachingEnabled(ds).should.eql(false)
        done()
      })
    })

    it('should cache if the datasources config settings allow', function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.directory.enabled = true
        var c = cache(server.object)
        var dsCache = datasourceCache()
        dsCache.cachingEnabled(ds).should.eql(true)
        done()
      })
    })
  })

  describe('getFromCache', function (done) {
    this.timeout(4000)

    it('should read data from a file', function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.directory.enabled = true

        var c = cache(server.object)

        // create a file
        var filename = crypto.createHash('sha1').update(ds.name).digest('hex') + '_' + crypto.createHash('sha1').update(ds.provider.endpoint).digest('hex')
        cachepath = path.join(ds.schema.datasource.caching.directory.path, filename + '.' + ds.schema.datasource.caching.directory.extension)
        var expected = 'ds content from filesystem'

        fs.writeFile(cachepath, expected, {encoding: 'utf-8'}, function (err) {
          if (err) console.log(err.toString())

          setTimeout(function() {
            var dsCache = datasourceCache()
            dsCache.getFromCache(ds, function (data) {
              data.should.eql(expected)
              done()
            })
          }, 1000)
        })
      })
    })

    it('should return false if cache file is not found', function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.enabled = true

        var c = cache(server.object)

        // create a file
        var filename = crypto.createHash('sha1').update(ds.name).digest('hex') + '_' + crypto.createHash('sha1').update(ds.provider.endpoint).digest('hex')
        cachepath = path.join(ds.schema.datasource.caching.directory.path, filename + '_XX.' + ds.schema.datasource.caching.directory.extension)
        var expected = 'ds content from filesystem'

        fs.writeFile(cachepath, expected, {encoding: 'utf-8'}, function (err) {
          if (err) console.log(err.toString())

          var dsCache = datasourceCache()
          dsCache.getFromCache(ds, function (data) {
            data.should.eql(false)
            done()
          })
        })
      })
    })

    it('should return false if cache key not in redis store', function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: false
          },
          redis: {
            enabled: true
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.redis.enabled = true

        var c = cache(server.object)
        var data = 'ds content from filesystem'

        var dsCache = datasourceCache()
        dsCache.getFromCache(ds, function (data) {
          data.should.eql(false)
          done()
        })
      })
    })

    it('should return data from redis cache key')

    it('should return false if cache file ttl has expired', function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.directory.enabled = true
        ds.schema.datasource.caching.ttl = 1

        var c = cache(server.object)

        // create a file
        var filename = crypto.createHash('sha1').update(ds.name).digest('hex') + '_' + crypto.createHash('sha1').update(ds.provider.endpoint).digest('hex')
        cachepath = path.join(ds.schema.datasource.caching.directory.path, filename + '.' + ds.schema.datasource.caching.directory.extension)
        var expected = 'ds content from filesystem'

        fs.writeFile(cachepath, expected, {encoding: 'utf-8'}, function (err) {
          if (err) console.log(err.toString())

          setTimeout(function () {
            var dsCache = datasourceCache()
            dsCache.getFromCache(ds, function (data) {
              data.should.eql(false)
              done()
            })
          }, 1500)
        })
      })
    })
  })

  describe('cacheResponse', function (done) {
    it('should write data to a file', function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.directory.enabled = true
        var c = cache(server.object)

        // create a file
        var filename = crypto.createHash('sha1').update(ds.name).digest('hex') + '_' + crypto.createHash('sha1').update(ds.provider.endpoint).digest('hex')
        cachepath = path.join(ds.schema.datasource.caching.directory.path, filename + '.' + ds.schema.datasource.caching.directory.extension)

        var data = 'ds content from filesystem'

        var dsCache = datasourceCache()
        dsCache.cacheResponse(ds, data, function () {
          fs.readFile(cachepath, function (err, content) {
            content.toString().should.eql(data)
            done()
          })
        })
      })
    })

    it('should write to a redis client if configured', function (done) {
      var cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.enabled = true

        var c = cache(server.object)
        var data = 'ds content for redis'

        var redisClient = redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3})

        redisClient.set = function set (key, chunk, done) {}

        redisClient.append = function append (key, chunk, done) {
          chunk.toString().should.eql(data)
        }

        c.redisClient = redisClient

        var dsCache = datasourceCache()
        dsCache.cacheResponse(ds, data, function () {
          done()
        })
      })
    })
  })
})
