const clone = require('clone')
const exec = require('child_process').exec
const fs = require('fs')
const path = require('path')
const url = require('url')
const util = require('util')
const crypto = require('crypto')
const should = require('should')
const sinon = require('sinon')
const redis = require('redis')

const api = require(`${__dirname}/../../dadi/lib/api`)
const config = require(path.resolve(path.join(__dirname, '/../../config')))
const cache = require(`${__dirname}/../../dadi/lib/cache`)
const datasourceCache = require(`${__dirname}/../../dadi/lib/cache/datasource`)
const Datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const page = require(`${__dirname}/../../dadi/lib/page`)
const Server = require(`${__dirname}/../../dadi/lib`)
const TestHelper = require(`${__dirname}/../help`)()

let server
let ds
let cachepath

describe('Datasource Cache', done => {
  beforeEach(done => {
    // datasourceCache._reset()

    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        new Datasource(
          page('test', TestHelper.getPageSchema()),
          'car_makes',
          TestHelper.getPathOptions()
        ).init((err, datasource) => {
          ds = datasource

          server = sinon.mock(Server)
          server.object.app = api()
          cache.reset()

          done()
        })
      })
    })
  })

  const cleanup = (dir, done) => {
    exec(`rm -rf ${dir}`, (err, stdout, stderr) => {
      exec(`mkdir ${dir}`)
      done()
    })
  }

  afterEach(done => {
    try {
      cleanup(path.resolve(`${__dirname}/../../cache/web`), done)
    } catch (err) {
      done(err)
    }
  })

  describe('Module', done => {
    it('should be a function', done => {
      datasourceCache.should.be.Function
      done()
    })

    it('should not cache if the app config settings do not allow', done => {
      const cacheConfig = {
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
        const dsCache = datasourceCache()
        dsCache.enabled.should.eql(false)
        done()
      })
    })

    it('should cache if the app config settings allow', done => {
      const cacheConfig = {
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
        const dsCache = datasourceCache()
        dsCache.enabled.should.eql(true)
        done()
      })
    })

    it('should use main cache settings if the datasource does not provide any directory options', done => {
      const cacheConfig = {
        caching: {
          directory: {
            enabled: true,
            path: 'cache/web',
            extension: 'cache'
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        delete ds.schema.datasource.caching.directory.path
        const c = cache(server.object)
        const dsCache = datasourceCache()
        dsCache
          .getOptions(ds)
          .directory.path.indexOf('cache/web')
          .should.be.above(-1)
        done()
      })
    })

    it('should use .json for extension if the datasource does not provide any options', done => {
      const cacheConfig = {
        caching: {
          directory: {
            enabled: true,
            path: 'cache/web',
            extension: 'cache'
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        delete ds.schema.datasource.caching.directory.extension
        const c = cache(server.object)
        const dsCache = datasourceCache()
        dsCache.getOptions(ds).directory.extension.should.eql('json')

        done()
      })
    })

    it('should use datasource name as first part of cache filename', done => {
      const cacheConfig = {
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
        const c = cache(server.object)
        const dsCache = new datasourceCache(ds)
        const expectToFind = crypto
          .createHash('sha1')
          .update(ds.schema.datasource.key)
          .digest('hex')

        dsCache
          .getFilename({
            name: ds.name,
            caching: cacheConfig.caching,
            endpoint: ''
          })
          .indexOf(expectToFind)
          .should.be.above(-1)
        done()
      })
    })

    it('should use different cache filenames when datasource endpoints use placeholders', done => {
      const cacheConfig = {
        caching: {
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      const name = 'test'
      const schema = TestHelper.getPageSchema()
      const p = page(name, schema)
      const dsName = 'car_makes'
      const options = TestHelper.getPathOptions()
      const dsSchema = clone(
        TestHelper.getSchemaFromFile(options.datasourcePath, dsName)
      )

      dsSchema.datasource.source.endpoint = '1.0/makes/{make}'
      dsSchema.datasource.requestParams = [
        {
          param: 'make',
          field: 'make',
          target: 'endpoint'
        }
      ]

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.updateConfig(cacheConfig).then(() => {
        const c = cache(server.object)

        new Datasource(p, dsName, options).init((err, datasource) => {
          Datasource.Datasource.prototype.loadDatasource.restore()
          const dsCache = datasourceCache()

          // process the http request so parameters are injected
          datasource.processRequest(datasource.schema.datasource.key, {
            url: '/1.0/makes/ford',
            params: { make: 'ford' }
          })

          const filename1 = dsCache.getFilename({
            name: datasource.name,
            caching: cacheConfig.caching,
            endpoint: datasource.provider.endpoint
          })

          datasource.processRequest(datasource.schema.datasource.key, {
            url: '/1.0/makes/mazda',
            params: { make: 'mazda' }
          })

          const filename2 = dsCache.getFilename({
            name: datasource.name,
            caching: cacheConfig.caching,
            endpoint: datasource.provider.endpoint
          })

          filename1.should.not.eql(filename2)

          done()
        })
      })
    })
  })

  describe('getOptions', done => {
    it('should use the datasource ttl if it is different', done => {
      const cacheConfig = {
        caching: {
          ttl: 300,
          directory: {
            enabled: true
          },
          redis: {
            enabled: false
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.ttl = 1000
        const c = cache(server.object)
        const dsCache = datasourceCache()
        const opts = dsCache.getOptions({
          name: ds.name,
          caching: ds.schema.datasource.caching,
          endpoint: ''
        })

        opts.ttl.should.eql(1000)
        done()
      })
    })

    it('should merge datasource directory options with main config options', done => {
      const cacheConfig = {
        caching: {
          directory: {
            enabled: true,
            path: './cache'
          },
          redis: {
            enabled: false,
            host: '127.0.0.1',
            port: 6379
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        const c = cache(server.object)
        const dsCache = datasourceCache()

        ds.schema.datasource.caching.directory.enabled = true
        const p = ds.schema.datasource.caching.directory.path
        delete ds.schema.datasource.caching.directory.path
        ds.schema.datasource.caching.redis.enabled = false

        const options = dsCache.getOptions({
          name: ds.name,
          caching: ds.schema.datasource.caching,
          endpoint: ''
        })

        options.directory.path.should.eql(cacheConfig.caching.directory.path)

        ds.schema.datasource.caching.directory.path = p
        done()
      })
    })

    it('should merge datasource redis options with main config options', done => {
      const cacheConfig = {
        caching: {
          directory: {
            enabled: false,
            path: './cache'
          },
          redis: {
            enabled: true,
            host: '127.0.0.1',
            port: 6379
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        const c = cache(server.object)
        const dsCache = datasourceCache()

        ds.schema.datasource.caching.directory.enabled = false
        ds.schema.datasource.caching.redis.enabled = true

        const options = dsCache.getOptions({
          name: ds.name,
          caching: ds.schema.datasource.caching,
          endpoint: ''
        })

        options.directory.enabled.should.eql(false)
        options.redis.enabled.should.eql(true)
        options.redis.host.should.eql(cacheConfig.caching.redis.host)
        done()
      })
    })

    it('should use datasource redis options over main config options', done => {
      const cacheConfig = {
        caching: {
          directory: {
            enabled: false,
            path: './cache'
          },
          redis: {
            enabled: true,
            port: 6379
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        const c = cache(server.object)
        const dsCache = datasourceCache()

        ds.schema.datasource.caching.directory.enabled = false
        ds.schema.datasource.caching.redis.enabled = true
        ds.schema.datasource.caching.redis.port = 13057

        const options = dsCache.getOptions({
          name: ds.name,
          caching: ds.schema.datasource.caching,
          endpoint: ''
        })

        options.directory.enabled.should.eql(false)
        options.redis.enabled.should.eql(true)
        options.redis.port.should.eql(13057)
        done()
      })
    })
  })

  describe('cachingEnabled', done => {
    it('should not cache if the datasources config settings do not allow', done => {
      const cacheConfig = {
        caching: {
          directory: {
            enabled: true,
            path: './cache/web'
          },
          redis: {
            enabled: false,
            host: '127.0.0.1',
            port: 6379
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        ds.schema.datasource.caching.directory.enabled = false
        const c = cache(server.object)
        const dsCache = datasourceCache()

        dsCache
          .cachingEnabled({
            name: ds.name,
            caching: ds.schema.datasource.caching,
            endpoint: ''
          })
          .should.eql(false)

        done()
      })
    })

    it('should not cache if the datasource endpoint has ?cache=false', done => {
      const cacheConfig = {
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
        const c = cache(server.object)
        const dsCache = datasourceCache()
        dsCache
          .cachingEnabled({
            name: ds.name,
            caching: ds.schema.datasource.caching,
            endpoint: ds.provider.endpoint
          })
          .should.eql(false)
        done()
      })
    })

    it('should cache if the datasources config settings allow', done => {
      const cacheConfig = {
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
        const c = cache(server.object)
        const dsCache = datasourceCache()
        dsCache
          .cachingEnabled({
            name: ds.name,
            caching: ds.schema.datasource.caching,
            endpoint: ''
          })
          .should.eql(true)
        done()
      })
    })
  })

  describe('getFromCache', function (done) {
    this.timeout(4000)

    it('should read data from a file', done => {
      const cacheConfig = {
        caching: {
          ttl: 300,
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

        const c = cache(server.object)

        // create a file
        const filename = `${crypto
          .createHash('sha1')
          .update(ds.name)
          .digest('hex')}_${crypto
          .createHash('sha1')
          .update(ds.provider.endpoint)
          .digest('hex')}`

        const cachedir = path.resolve(
          ds.schema.datasource.caching.directory.path
        )

        const cachepath = path.join(
          cachedir,
          `${filename}.${ds.schema.datasource.caching.directory.extension}`
        )
        const expected = 'ds content from filesystem'

        fs.mkdir(cachedir, err => {
          const dsCache = datasourceCache()

          fs.writeFile(cachepath, expected, err => {
            if (err) console.log(err)

            dsCache.getFromCache(
              {
                name: ds.name,
                caching: ds.schema.datasource.caching,
                endpoint: ds.provider.endpoint
              },
              data => {
                data.should.not.eql(false)
                data.toString().should.eql(expected)
                done()
              }
            )
          })
        })
      })
    })

    it('should return false if cache file is not found', done => {
      const cacheConfig = {
        ttl: 300,
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

        const c = cache(server.object)

        // create a file
        const filename = `${crypto
          .createHash('sha1')
          .update(ds.name)
          .digest('hex')}_${crypto
          .createHash('sha1')
          .update(ds.provider.endpoint)
          .digest('hex')}`

        const cachedir = path.resolve(
          ds.schema.datasource.caching.directory.path
        )

        const cachepath = path.join(
          cachedir,
          `${filename}_FOOBAR.${
            ds.schema.datasource.caching.directory.extension
          }`
        )

        const expected = 'ds content from filesystem'

        fs.mkdir(cachedir, err => {
          const dsCache = datasourceCache()

          fs.writeFile(cachepath, expected, err => {
            if (err) console.log(err)

            dsCache.getFromCache(
              {
                name: ds.name,
                caching: ds.schema.datasource.caching,
                endpoint: ds.provider.endpoint
              },
              data => {
                data.should.eql(false)
                done()
              }
            )
          })
        })
      })
    })

    it('should return false if cache key not in redis store', done => {
      const cacheConfig = {
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

        const c = cache(server.object)
        const data = 'ds content from filesystem'

        const dsCache = datasourceCache()
        dsCache.getFromCache(
          {
            name: ds.name,
            caching: ds.schema.datasource.caching,
            endpoint: ''
          },
          data => {
            data.should.eql(false)
            done()
          }
        )
      })
    })

    it('should return data from redis cache key')

    it('should return false if cache file ttl has expired', done => {
      const cacheConfig = {
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

        const c = cache(server.object)

        // create a file
        const filename = `${crypto
          .createHash('sha1')
          .update(ds.name)
          .digest('hex')}_${crypto
          .createHash('sha1')
          .update(ds.provider.endpoint)
          .digest('hex')}`
        cachepath = path.resolve(
          path.join(
            ds.schema.datasource.caching.directory.path,
            `${filename}.${ds.schema.datasource.caching.directory.extension}`
          )
        )
        const expected = 'ds content from filesystem'

        fs.writeFile(cachepath, expected, { encoding: 'utf-8' }, err => {
          if (err) console.log(err.toString())

          setTimeout(() => {
            const dsCache = datasourceCache()
            dsCache.getFromCache(
              {
                name: ds.name,
                caching: ds.schema.datasource.caching,
                endpoint: ds.provider.endpoint
              },
              data => {
                data.should.eql(false)
                done()
              }
            )
          }, 1500)
        })
      })
    })
  })

  describe('cacheResponse', done => {
    it('should write data to a file', done => {
      const cacheConfig = {
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
        const c = cache(server.object)

        // create a file
        const filename = `${crypto
          .createHash('sha1')
          .update(ds.name)
          .digest('hex')}_${crypto
          .createHash('sha1')
          .update(ds.provider.endpoint)
          .digest('hex')}`
        cachepath = path.resolve(
          path.join(
            ds.schema.datasource.caching.directory.path,
            `${filename}.${ds.schema.datasource.caching.directory.extension}`
          )
        )

        const data = 'ds content from filesystem'

        const dsCache = datasourceCache()
        dsCache.cacheResponse(
          {
            name: ds.name,
            caching: ds.schema.datasource.caching,
            endpoint: ds.provider.endpoint
          },
          data,
          () => {
            fs.readFile(cachepath, (err, content) => {
              content.toString().should.eql(data)
              done()
            })
          }
        )
      })
    })

    it('should write to a redis client if configured', done => {
      const cacheConfig = {
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

        const c = cache(server.object)
        const data = 'ds content for redis'

        const redisClient = redis.createClient(
          config.get('caching.redis.port'),
          config.get('caching.redis.host'),
          {
            detect_buffers: true,
            retry_strategy: options => {
              if (options.times_connected >= 3) {
                // End reconnecting after a specific number of tries and flush all commands with a individual error
                return new Error('Retry attempts exhausted')
              }
              // reconnect after
              return 1000
            }
          }
        )

        redisClient.set = function set (key, chunk, done) {}

        redisClient.append = function append (key, chunk, done) {
          chunk.toString().should.eql(data)
        }

        c.redisClient = redisClient

        const dsCache = datasourceCache()
        dsCache.cacheResponse(
          {
            name: ds.name,
            caching: ds.schema.datasource.caching,
            endpoint: ds.provider.endpoint
          },
          data,
          () => {
            done()
          }
        )
      })
    })
  })
})
