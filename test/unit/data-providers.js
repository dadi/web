const fs = require('fs')
const nock = require('nock')
const path = require('path')
const sinon = require('sinon')
const should = require('should')
const Readable = require('stream').Readable
const request = require('supertest')
const zlib = require('zlib')

const Server = require(`${__dirname}/../../dadi/lib`)
const TestHelper = require(`${__dirname}/../help`)()
const api = require(`${__dirname}/../../dadi/lib/api`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const Datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const help = require(`${__dirname}/../../dadi/lib/help`)
const Page = require(`${__dirname}/../../dadi/lib/page`)

const apiProvider = require(`${__dirname}/../../dadi/lib/providers/dadiapi`)
const remoteProvider = require(`${__dirname}/../../dadi/lib/providers/remote`)
const restProvider = require(`${__dirname}/../../dadi/lib/providers/restapi`)
const markdownProvider = require(`${__dirname}/../../dadi/lib/providers/markdown`)

const config = require(path.resolve(path.join(__dirname, '/../../config')))
let controller

describe('Data Providers', done => {
  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(done => {
    nock.cleanAll()
    TestHelper.stopServer(() => {})
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  describe('DADI API', done => {
    it('should use the datasource auth block when obtaining a token', done => {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['car_models']

          TestHelper.setupApiIntercepts()

          const connectionString = `http://${config.get(
            'server.host'
          )}:${config.get('server.port')}`
          const apiConnectionString = `http://${config.get(
            'api.host'
          )}:${config.get('api.port')}`

          const stub = sinon
            .stub(apiProvider.prototype, 'getToken')
            .callsFake((strategy, callback) => {
              should.exist(strategy)
              strategy.host.should.eql('8.8.8.8')

              stub.restore()
              return done()
            })

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?cache=false&debug=json`)
              .end((err, res) => {})
          })
        })
      })
    })

    it('should return gzipped response if accept header specifies it', done => {
      TestHelper.enableApiConfig().then(() => {
        const pages = TestHelper.setUpPages()
        pages[0].datasources = ['car_makes_unchained']

        const text = JSON.stringify({ hello: 'world!' })

        zlib.gzip(text, (_, data) => {
          TestHelper.setupApiIntercepts()

          const connectionString = `http://${config.get(
            'server.host'
          )}:${config.get('server.port')}`
          const apiConnectionString = `http://${config.get(
            'api.host'
          )}:${config.get('api.port')}`

          const scope = nock(apiConnectionString)
            .defaultReplyHeaders({
              'content-encoding': 'gzip'
            })
            .get(
              '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false'
            )
            .times(5)
            .reply(200, data)

          const providerSpy = sinon.spy(apiProvider.prototype, 'processOutput')

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?cache=false`)
              .end((err, res) => {
                providerSpy.restore()
                providerSpy.called.should.eql(true)

                const buffer = providerSpy.firstCall.args[2]

                buffer.toString().should.eql(text)

                done()
              })
          })
        })
      })
    })

    it('should return append query params if endpoint already has a querystring', done => {
      TestHelper.enableApiConfig().then(() => {
        const pages = TestHelper.setUpPages()
        pages[0].datasources = ['car_makes_with_query']

        TestHelper.setupApiIntercepts()

        const data = { hello: 'world' }

        const connectionString = `http://${config.get(
          'server.host'
        )}:${config.get('server.port')}`
        const apiConnectionString = `http://${config.get(
          'api.host'
        )}:${config.get('api.port')}`

        const expected = `${apiConnectionString}/1.0/cars/makes?param=value&count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}`

        const scope = nock(apiConnectionString)
          .get(
            '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false'
          )
          .times(5)
          .reply(200, data)

        const providerSpy = sinon.spy(
          apiProvider.prototype,
          'processDatasourceParameters'
        )

        TestHelper.startServer(pages).then(() => {
          const client = request(connectionString)

          client
            .get(`${pages[0].routes[0].path}?cache=false`)
            .end((err, res) => {
              providerSpy.restore()
              providerSpy.called.should.eql(true)

              providerSpy.firstCall.returnValue.should.eql(expected)

              done()
            })
        })
      })
    })

    it('should return an errors collection when a datasource times out', done => {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['car_makes_unchained']

          TestHelper.setupApiIntercepts()

          const connectionString = `http://${config.get(
            'server.host'
          )}:${config.get('server.port')}`
          const apiConnectionString = `http://${config.get(
            'api.host'
          )}:${config.get('api.port')}`

          const scope = nock(apiConnectionString)
            .get(
              '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false'
            )
            .times(5)
            .reply(504)

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?cache=false&debug=json`)
              .end((err, res) => {
                should.exist(res.body['car_makes_unchained'].errors)
                res.body['car_makes_unchained'].errors[0].title.should.eql(
                  'Datasource Timeout'
                )
                done()
              })
          })
        })
      })
    })

    it('should return an errors collection when a datasource is not found', done => {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['car_makes_unchained']

          TestHelper.setupApiIntercepts()

          const connectionString = `http://${config.get(
            'server.host'
          )}:${config.get('server.port')}`
          const apiConnectionString = `http://${config.get(
            'api.host'
          )}:${config.get('api.port')}`

          const scope = nock(apiConnectionString)
            .get(
              '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false'
            )
            .times(5)
            .reply(404)

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?cache=false&debug=json`)
              .end((err, res) => {
                should.exist(res.body['car_makes_unchained'].errors)
                res.body['car_makes_unchained'].errors[0].title.should.eql(
                  'Datasource Not Found'
                )
                done()
              })
          })
        })
      })
    })
  })

  describe('Remote', done => {
    it('should return an errors collection when a datasource times out', done => {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['car_makes_unchained_remote']

          TestHelper.setupApiIntercepts()

          const connectionString = `http://${config.get(
            'server.host'
          )}:${config.get('server.port')}`
          const apiConnectionString = `http://${config.get(
            'api.host'
          )}:${config.get('api.port')}`

          const scope = nock(apiConnectionString)
            .defaultReplyHeaders({
              'content-encoding': ''
            })
            .get('/1.0/cars/makes')
            .times(5)
            .reply(504)

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                should.exist(res.body['car_makes_unchained_remote'].errors)
                res.body[
                  'car_makes_unchained_remote'
                ].errors[0].title.should.eql('Datasource Timeout')
                done()
              })
          })
        })
      })
    })

    it('should return an errors collection when a datasource is not found', done => {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['car_makes_unchained_remote']

          TestHelper.setupApiIntercepts()

          const connectionString = `http://${config.get(
            'server.host'
          )}:${config.get('server.port')}`
          const apiConnectionString = `http://${config.get(
            'api.host'
          )}:${config.get('api.port')}`

          const scope = nock(apiConnectionString)
            .defaultReplyHeaders({
              'content-encoding': ''
            })
            .get('/1.0/cars/makes')
            .times(5)
            .reply(404)

          TestHelper.startServer(pages).then(() => {
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?cache=false&debug=json`)
              .end((err, res) => {
                should.exist(res.body['car_makes_unchained_remote'].errors)
                res.body[
                  'car_makes_unchained_remote'
                ].errors[0].title.should.eql('Datasource Not Found')
                done()
              })
          })
        })
      })
    })
  })

  describe('Static', done => {
    it('should sort the results by the provided field', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'static'
      )
      dsSchema.datasource.sort = []
      dsSchema.datasource.sort.score = -1

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['static']

          TestHelper.startServer(pages).then(() => {
            const connectionString = `http://${config.get(
              'server.host'
            )}:${config.get('server.port')}`
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()

                should.exist(res.body.static)
                res.body.static.results[0].title.should.eql('Interstellar')
                res.body.static.results[1].title.should.eql(
                  'Dallas Buyers Club'
                )
                res.body.static.results[2].title.should.eql('Mud')
                res.body.static.results[3].title.should.eql('Killer Joe')

                done()
              })
          })
        })
      })
    })

    it('should wrap the data in a `results` node before returning', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'static'
      )
      dsSchema.datasource.source.data = {
        x: 100
      }

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['static']

          TestHelper.startServer(pages).then(() => {
            const connectionString = `http://${config.get(
              'server.host'
            )}:${config.get('server.port')}`
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()

                should.exist(res.body.static)
                res.body.static.should.eql({ results: [{ x: 100 }] })
                done()
              })
          })
        })
      })
    })

    it('should return the number of records specified by the count property', done => {
      let dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'static'
      )

      const dsConfig = {
        count: 2,
        sort: {},
        search: {},
        fields: []
      }

      dsSchema = {
        datasource: Object.assign({}, dsSchema.datasource, dsConfig)
      }

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['static']

          TestHelper.startServer(pages).then(() => {
            const connectionString = `http://${config.get(
              'server.host'
            )}:${config.get('server.port')}`
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.static)
                should.exist(res.body.static.results)
                res.body.static.results.should.be.Array
                res.body.static.results.length.should.eql(2)
                done()
              })
          })
        })
      })
    })

    it('should only return the fields specified by the fields property', done => {
      let dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'static'
      )

      const dsConfig = {
        count: 2,
        sort: {},
        search: {},
        fields: ['title', 'director']
      }

      dsSchema = {
        datasource: Object.assign({}, dsSchema.datasource, dsConfig)
      }

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['static']

          TestHelper.startServer(pages).then(() => {
            const connectionString = `http://${config.get(
              'server.host'
            )}:${config.get('server.port')}`
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.static)
                should.exist(res.body.static.results)
                res.body.static.results.should.be.Array
                res.body.static.results.length.should.eql(2)

                const result = res.body.static.results[0]
                Object.keys(result).should.eql(['title', 'director'])
                done()
              })
          })
        })
      })
    })

    it('should only return the data matching the search property', done => {
      let dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'static'
      )

      const dsConfig = {
        search: { author: 'Roger Ebert' }
      }

      dsSchema = {
        datasource: Object.assign({}, dsSchema.datasource, dsConfig)
      }

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['static']

          TestHelper.startServer(pages).then(() => {
            const connectionString = `http://${config.get(
              'server.host'
            )}:${config.get('server.port')}`
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.static)
                res.body.static.results.should.be.Array
                res.body.static.results.length.should.eql(2)

                res.body.static.results.forEach(result => {
                  result.author.should.eql('Roger Ebert')
                })

                done()
              })
          })
        })
      })
    })
  })

  describe('Rest API', done => {
    it('should use a custom purest config if passed', done => {
      new Datasource(
        Page('test', TestHelper.getPageSchema()),
        'youtube',
        TestHelper.getPathOptions()
      ).init((err, ds) => {
        if (err) done(err)
        should.exist(ds.source.provider.google)
        done()
      })
    })

    it('should use the datasource alias property when querying the endpoint', done => {
      TestHelper.updateConfig({
        api: {
          twitter: {
            type: 'restapi',
            provider: 'twitter',
            auth: {
              oauth: {
                consumer_key: 'key',
                consumer_secret: 'secret',
                token: 'token',
                token_secret: 'tokensecret'
              }
            }
          }
        }
      }).then(() => {
        new Datasource(
          Page('test', TestHelper.getPageSchema()),
          'twitter',
          TestHelper.getPathOptions()
        ).init((err, ds) => {
          if (err) done(err)

          ds.source.provider.should.eql('twitter')

          done()
        })
      })
    })

    it('should load data from the specified api', done => {
      const host = 'https://api.twitter.com'
      const path = '/1.1/statuses/show.json?id=972581771681386497'

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, `${__dirname}/../twitter-api-response.json`)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['twitter-status']

          TestHelper.startServer(pages).then(() => {
            const connectionString = `http://${config.get(
              'server.host'
            )}:${config.get('server.port')}`
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                should.exist(res.body.twitterstatus)
                should.exist(res.body.twitterstatus.user.screen_name)
                done()
              })
          })
        })
      })
    })

    it('should fail gracefully if the api is unavailable', done => {
      const host = 'https://api.twitter.com'
      const path = '/1.1/statuses/show.json?id=972581771681386498'

      const scope2 = nock(host)
        .get(path)
        .reply(404, 'Not found')

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['twitter-status-two']

          TestHelper.startServer(pages).then(() => {
            const connectionString = `http://${config.get(
              'server.host'
            )}:${config.get('server.port')}`
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                should.exist(res.body.twitterstatus.errors)
                done()
              })
          })
        })
      })
    })

    it('should filter specified fields from the output', done => {
      const host = 'https://api.twitter.com'
      const path = '/1.1/statuses/show.json?id=972581771681386498'

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, `${__dirname}/../twitter-api-response.json`)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['twitter-status-filtered']

          TestHelper.startServer(pages).then(() => {
            const connectionString = `http://${config.get(
              'server.host'
            )}:${config.get('server.port')}`
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?cache=false&debug=json`)
              .end((err, res) => {
                should.exist(res.body.twitterstatus.user)
                should.exist(res.body.twitterstatus.user.screen_name)
                should.exist(res.body.twitterstatus.text)

                Object.keys(res.body.twitterstatus).length.should.eql(2)

                done()
              })
          })
        })
      })
    })
  })

  describe('RSS', done => {
    it('should use the datasource count property when querying the endpoint', done => {
      new Datasource(
        Page('test', TestHelper.getPageSchema()),
        'rss',
        TestHelper.getPathOptions()
      ).init((err, ds) => {
        ds.schema.datasource.count = 10

        const params = ds.provider.buildQueryParams()
        should.exists(params.count)
        params.count.should.eql(10)
        done()
      })
    })

    it('should use an array of datasource fields when querying the endpoint', done => {
      new Datasource(
        Page('test', TestHelper.getPageSchema()),
        'rss',
        TestHelper.getPathOptions()
      ).init((err, ds) => {
        ds.schema.datasource.fields = ['field1', 'field2']

        const params = ds.provider.buildQueryParams()
        should.exists(params.fields)
        params.fields.should.eql('field1,field2')
        done()
      })
    })

    it('should use an object of datasource fields when querying the endpoint', done => {
      new Datasource(
        Page('test', TestHelper.getPageSchema()),
        'rss',
        TestHelper.getPathOptions()
      ).init((err, ds) => {
        ds.schema.datasource.fields = { field1: 1, field2: 1 }

        const params = ds.provider.buildQueryParams()
        should.exists(params.fields)
        params.fields.should.eql('field1,field2')
        done()
      })
    })

    it('should use the datasource filter property when querying the endpoint', done => {
      new Datasource(
        Page('test', TestHelper.getPageSchema()),
        'rss',
        TestHelper.getPathOptions()
      ).init((err, ds) => {
        ds.schema.datasource.filter = { field: 'value' }

        const params = ds.provider.buildQueryParams()

        should.exists(params.field)
        params.field.should.eql('value')
        done()
      })
    })

    it('should return data when no error is encountered', done => {
      const host = 'http://www.feedforall.com'
      const path = '/sample.xml'

      const scope = nock(host)
        .get(path)
        .replyWithFile(200, `${__dirname}/../rss.xml`)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          const pages = TestHelper.setUpPages()
          pages[0].datasources = ['rss']

          TestHelper.startServer(pages).then(() => {
            const connectionString = `http://${config.get(
              'server.host'
            )}:${config.get('server.port')}`
            const client = request(connectionString)

            client
              .get(`${pages[0].routes[0].path}?debug=json`)
              .end((err, res) => {
                should.exist(res.body.rss)
                should.exist(res.body.rss[0].title)
                done()
              })
          })
        })
      })
    })
  })

  describe('Markdown', done => {
    it('should process frontmatter from the files in the datasource path', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  Datasource.Datasource.prototype.loadDatasource.restore()

                  should.exist(res.body.markdown.results)
                  res.body.markdown.results.should.be.Array
                  res.body.markdown.results[0].contentHtml.should.not.eql('')
                  res.body.markdown.results[0].original.should.eql(
                    '---\ntitle: A Quick Brown Fox\ncategory: guggenheim\ndate: 2010-01-01\n---\n\n# Basic markdown\n\nMarkdown can have [links](https://dadi.tech), _emphasis_ and **bold** formatting.\n'
                  ),
                  res.body.markdown.results[0].attributes.title.should.eql(
                    'A Quick Brown Fox'
                  )
                  res.body.markdown.results[0].attributes.category.should.eql(
                    'guggenheim'
                  )
                  res.body.markdown.results[0].attributes.date.should.eql(
                    '2010-01-01T00:00:00.000Z'
                  )

                  done()
                })
            })
          }
        )
      })
    })

    it('should not convert markdown to HTML if specified not to', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )

      dsSchema.datasource.source.renderHtml = false

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  Datasource.Datasource.prototype.loadDatasource.restore()

                  should.exist(res.body.markdown.results)
                  res.body.markdown.results.should.be.Array
                  res.body.markdown.results[0].contentHtml.should.eql('')
                  res.body.markdown.results[0].original.should.eql(
                    '---\ntitle: A Quick Brown Fox\ncategory: guggenheim\ndate: 2010-01-01\n---\n\n# Basic markdown\n\nMarkdown can have [links](https://dadi.tech), _emphasis_ and **bold** formatting.\n'
                  ),
                  res.body.markdown.results[0].attributes.title.should.eql(
                    'A Quick Brown Fox'
                  )
                  res.body.markdown.results[0].attributes.category.should.eql(
                    'guggenheim'
                  )
                  res.body.markdown.results[0].attributes.date.should.eql(
                    '2010-01-01T00:00:00.000Z'
                  )

                  done()
                })
            })
          }
        )
      })
    })

    it('should return correct pagination metadata', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  Datasource.Datasource.prototype.loadDatasource.restore()

                  res.body.markdown.metadata.page.should.equal(1)
                  res.body.markdown.metadata.limit.should.equal(1)
                  res.body.markdown.metadata.totalPages.should.be.above(1)
                  res.body.markdown.metadata.nextPage.should.equal(2)

                  done()
                })
            })
          }
        )
      })
    })

    it('should use the datasource requestParams to filter the results', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']
            pages[0].routes[0].path = '/test/:category?'

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client.get('/test/sports?debug=json').end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()

                res.body.params['category'].should.equal('sports')
                res.body.markdown.results[0].attributes.category.should.equal(
                  'sports'
                )
                res.body.markdown.metadata.page.should.equal(1)
                res.body.markdown.metadata.limit.should.equal(1)
                res.body.markdown.metadata.totalPages.should.equal(1)

                done()
              })
            })
          }
        )
      })
    })

    it('should return the number of records specified by the count property', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  Datasource.Datasource.prototype.loadDatasource.restore()
                  should.exist(res.body.markdown.results)
                  res.body.markdown.results.length.should.eql(1)
                  done()
                })
            })
          }
        )
      })
    })

    it('should process files of a specified extension', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )
      dsSchema.datasource.source.extension = 'txt'

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  Datasource.Datasource.prototype.loadDatasource.restore()
                  should.exist(res.body.markdown.results)
                  res.body.markdown.results.should.be.Array
                  res.body.markdown.results[0].attributes.title.should.eql(
                    'A txt file format'
                  )
                  done()
                })
            })
          }
        )
      })
    })

    it('should return an error if the source folder does not exist', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )
      dsSchema.datasource.source.path = './foobar'

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  Datasource.Datasource.prototype.loadDatasource.restore()
                  should.exist(res.body.markdown.errors)
                  res.body.markdown.errors[0].title.should.eql(
                    'No markdown files found'
                  )
                  done()
                })
            })
          }
        )
      })
    })

    it('should ignore malformed dates in a source file', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )
      dsSchema.datasource.source.extension = 'txt'

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  Datasource.Datasource.prototype.loadDatasource.restore()
                  should.exist(res.body.markdown.results)
                  res.body.markdown.results[0].attributes.date.should.eql(
                    'madeupdate'
                  )
                  done()
                })
            })
          }
        )
      })
    })

    it('should sort by the specified field in reverse order if set to -1', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )

      delete dsSchema.datasource.sort.date
      dsSchema.datasource.sort['attributes.date'] = -1
      dsSchema.datasource.count = 2

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  Datasource.Datasource.prototype.loadDatasource.restore()
                  should.exist(res.body.markdown.results)
                  res.body.markdown.results[0].attributes.title.should.eql(
                    'Another Quick Brown Fox'
                  )
                  res.body.markdown.results[1].attributes.title.should.eql(
                    'A Quick Brown Fox'
                  )
                  done()
                })
            })
          }
        )
      })
    })

    it('should only return the selected fields as specified by the datasource', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )
      dsSchema.datasource.fields = ['attributes.title', 'attributes._id']
      dsSchema.datasource.count = 2

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: true }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  Datasource.Datasource.prototype.loadDatasource.restore()
                  should.exist(res.body.markdown.results)

                  res.body.markdown.results[0].attributes.title.should.eql(
                    'A Quick Brown Fox'
                  )
                  res.body.markdown.results[1].attributes.title.should.eql(
                    'Another Quick Brown Fox'
                  )
                  done()
                })
            })
          }
        )
      })
    })

    it('should retrieve data from the cache if it is enabled', done => {
      const dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        'markdown'
      )

      dsSchema.caching = {
        directory: {
          enabled: true
        }
      }

      sinon
        .stub(Datasource.Datasource.prototype, 'loadDatasource')
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true, debug: false }).then(
          () => {
            const pages = TestHelper.setUpPages()
            pages[0].datasources = ['markdown']

            TestHelper.startServer(pages).then(() => {
              const connectionString = `http://${config.get(
                'server.host'
              )}:${config.get('server.port')}`
              const client = request(connectionString)

              client
                .get(`${pages[0].routes[0].path}?debug=json`)
                .end((err, res) => {
                  res.body.markdown.results[0].attributes.title.should.eql(
                    'A Quick Brown Fox'
                  )

                  sinon
                    .stub(markdownProvider.prototype, 'parseRawDataAsync')
                    .returns({
                      attributes: {
                        title: 'Mr. Uncache'
                      }
                    })

                  client
                    .get(`${pages[0].routes[0].path}?debug=json`)
                    .end((err, res) => {
                      Datasource.Datasource.prototype.loadDatasource.restore()

                      markdownProvider.prototype.parseRawDataAsync.restore()

                      res.body.markdown.results[0].attributes.title.should.eql(
                        'A Quick Brown Fox'
                      )

                      done()
                    })
                })
            })
          }
        )
      })
    })
  })
})
