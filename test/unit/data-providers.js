var fs = require("fs")
var nock = require("nock")
var path = require("path")
var sinon = require("sinon")
var should = require("should")
var Readable = require("stream").Readable
var request = require("supertest")
var zlib = require("zlib")

var Server = require(__dirname + "/../../dadi/lib")
var TestHelper = require(__dirname + "/../help")()
var api = require(__dirname + "/../../dadi/lib/api")
var Controller = require(__dirname + "/../../dadi/lib/controller")
var Datasource = require(__dirname + "/../../dadi/lib/datasource")
var help = require(__dirname + "/../../dadi/lib/help")
var Page = require(__dirname + "/../../dadi/lib/page")

var apiProvider = require(__dirname + "/../../dadi/lib/providers/dadiapi")
var remoteProvider = require(__dirname + "/../../dadi/lib/providers/remote")
var restProvider = require(__dirname + "/../../dadi/lib/providers/restapi")
var markdownProvider = require(__dirname + "/../../dadi/lib/providers/markdown")

var config = require(path.resolve(path.join(__dirname, "/../../config")))
var controller

describe("Data Providers", function(done) {
  beforeEach(function(done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(function(done) {
    nock.cleanAll()
    TestHelper.stopServer(function() {})
    done()
  })

  describe("DADI API", function(done) {
    it("should use the datasource auth block when obtaining a token", function(done) {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["car_models"]

          TestHelper.setupApiIntercepts()

          var connectionString =
            "http://" +
            config.get("server.host") +
            ":" +
            config.get("server.port")
          var apiConnectionString =
            "http://" + config.get("api.host") + ":" + config.get("api.port")

          var stub = sinon
            .stub(apiProvider.prototype, "getToken")
            .callsFake(function(strategy, callback) {
              should.exist(strategy)
              strategy.host.should.eql("8.8.8.8")

              stub.restore()
              return done()
            })

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?cache=false&debug=json")
              .end((err, res) => {})
          })
        })
      })
    })

    it("should return gzipped response if accept header specifies it", function(done) {
      TestHelper.enableApiConfig().then(() => {
        var pages = TestHelper.setUpPages()
        pages[0].datasources = ["car_makes_unchained"]

        var text = JSON.stringify({ hello: "world!" })

        zlib.gzip(text, function(_, data) {
          TestHelper.setupApiIntercepts()

          var connectionString =
            "http://" +
            config.get("server.host") +
            ":" +
            config.get("server.port")
          var apiConnectionString =
            "http://" + config.get("api.host") + ":" + config.get("api.port")

          var scope = nock(apiConnectionString)
            .defaultReplyHeaders({
              "content-encoding": "gzip"
            })
            .get(
              "/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false"
            )
            .times(5)
            .reply(200, data)

          var providerSpy = sinon.spy(apiProvider.prototype, "processOutput")

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?cache=false")
              .end((err, res) => {
                providerSpy.restore()
                providerSpy.called.should.eql(true)

                var buffer = providerSpy.firstCall.args[2]

                buffer.toString().should.eql(text)

                done()
              })
          })
        })
      })
    })

    it("should return append query params if endpoint already has a querystring", function(done) {
      TestHelper.enableApiConfig().then(() => {
        var pages = TestHelper.setUpPages()
        pages[0].datasources = ["car_makes_with_query"]

        TestHelper.setupApiIntercepts()

        var data = { hello: "world" }

        var connectionString =
          "http://" +
          config.get("server.host") +
          ":" +
          config.get("server.port")
        var apiConnectionString =
          "http://" + config.get("api.host") + ":" + config.get("api.port")

        var expected =
          apiConnectionString +
          '/1.0/cars/makes?param=value&count=20&page=1&filter={}&fields={"name":1,"_id":0}&sort={"name":1}'

        var scope = nock(apiConnectionString)
          .get(
            "/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false"
          )
          .times(5)
          .reply(200, data)

        var providerSpy = sinon.spy(
          apiProvider.prototype,
          "processDatasourceParameters"
        )

        TestHelper.startServer(pages).then(() => {
          var client = request(connectionString)

          client
            .get(pages[0].routes[0].path + "?cache=false")
            .end((err, res) => {
              providerSpy.restore()
              providerSpy.called.should.eql(true)

              providerSpy.firstCall.returnValue.should.eql(expected)

              done()
            })
        })
      })
    })

    it("should return an errors collection when a datasource times out", function(done) {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["car_makes_unchained"]

          TestHelper.setupApiIntercepts()

          var connectionString =
            "http://" +
            config.get("server.host") +
            ":" +
            config.get("server.port")
          var apiConnectionString =
            "http://" + config.get("api.host") + ":" + config.get("api.port")

          var scope = nock(apiConnectionString)
            .get(
              "/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false"
            )
            .times(5)
            .reply(504)

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?cache=false&debug=json")
              .end((err, res) => {
                should.exist(res.body["car_makes_unchained"].errors)
                res.body["car_makes_unchained"].errors[0].title.should.eql(
                  "Datasource Timeout"
                )
                done()
              })
          })
        })
      })
    })

    it("should return an errors collection when a datasource is not found", function(done) {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["car_makes_unchained"]

          TestHelper.setupApiIntercepts()

          var connectionString =
            "http://" +
            config.get("server.host") +
            ":" +
            config.get("server.port")
          var apiConnectionString =
            "http://" + config.get("api.host") + ":" + config.get("api.port")

          var scope = nock(apiConnectionString)
            .get(
              "/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D&cache=false"
            )
            .times(5)
            .reply(404)

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?cache=false&debug=json")
              .end((err, res) => {
                should.exist(res.body["car_makes_unchained"].errors)
                res.body["car_makes_unchained"].errors[0].title.should.eql(
                  "Datasource Not Found"
                )
                done()
              })
          })
        })
      })
    })
  })

  describe("Remote", function(done) {
    it("should return an errors collection when a datasource times out", function(done) {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["car_makes_unchained_remote"]

          TestHelper.setupApiIntercepts()

          var connectionString =
            "http://" +
            config.get("server.host") +
            ":" +
            config.get("server.port")
          var apiConnectionString =
            "http://" + config.get("api.host") + ":" + config.get("api.port")

          var scope = nock(apiConnectionString)
            .defaultReplyHeaders({
              "content-encoding": ""
            })
            .get("/1.0/cars/makes")
            .times(5)
            .reply(504)

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                should.exist(res.body["car_makes_unchained_remote"].errors)
                res.body[
                  "car_makes_unchained_remote"
                ].errors[0].title.should.eql("Datasource Timeout")
                done()
              })
          })
        })
      })
    })

    it("should return an errors collection when a datasource is not found", function(done) {
      TestHelper.enableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["car_makes_unchained_remote"]

          TestHelper.setupApiIntercepts()

          var connectionString =
            "http://" +
            config.get("server.host") +
            ":" +
            config.get("server.port")
          var apiConnectionString =
            "http://" + config.get("api.host") + ":" + config.get("api.port")

          var scope = nock(apiConnectionString)
            .defaultReplyHeaders({
              "content-encoding": ""
            })
            .get("/1.0/cars/makes")
            .times(5)
            .reply(404)

          TestHelper.startServer(pages).then(() => {
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?cache=false&debug=json")
              .end((err, res) => {
                should.exist(res.body["car_makes_unchained_remote"].errors)
                res.body[
                  "car_makes_unchained_remote"
                ].errors[0].title.should.eql("Datasource Not Found")
                done()
              })
          })
        })
      })
    })
  })

  describe("Static", function(done) {
    it("should sort the results by the provided field", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "static"
      )
      dsSchema.datasource.sort = []
      dsSchema.datasource.sort.score = -1

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["static"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()

                should.exist(res.body.static)
                res.body.static.results[0].title.should.eql("Interstellar")
                res.body.static.results[1].title.should.eql(
                  "Dallas Buyers Club"
                )
                res.body.static.results[2].title.should.eql("Mud")
                res.body.static.results[3].title.should.eql("Killer Joe")

                done()
              })
          })
        })
      })
    })

    it("should wrap the data in a `results` node before returning", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "static"
      )
      dsSchema.datasource.source.data = {
        x: 100
      }

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["static"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
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

    it("should return the number of records specified by the count property", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "static"
      )

      var dsConfig = {
        count: 2,
        sort: {},
        search: {},
        fields: []
      }

      dsSchema = {
        datasource: Object.assign({}, dsSchema.datasource, dsConfig)
      }

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["static"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
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

    it("should only return the fields specified by the fields property", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "static"
      )

      var dsConfig = {
        count: 2,
        sort: {},
        search: {},
        fields: ["title", "director"]
      }

      dsSchema = {
        datasource: Object.assign({}, dsSchema.datasource, dsConfig)
      }

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["static"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.static)
                should.exist(res.body.static.results)
                res.body.static.results.should.be.Array
                res.body.static.results.length.should.eql(2)

                var result = res.body.static.results[0]
                Object.keys(result).should.eql(["title", "director"])
                done()
              })
          })
        })
      })
    })

    it("should only return the data matching the search property", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "static"
      )

      var dsConfig = {
        search: { author: "Roger Ebert" }
      }

      dsSchema = {
        datasource: Object.assign({}, dsSchema.datasource, dsConfig)
      }

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["static"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.static)
                res.body.static.results.should.be.Array
                res.body.static.results.length.should.eql(2)

                res.body.static.results.forEach(result => {
                  result.author.should.eql("Roger Ebert")
                })

                done()
              })
          })
        })
      })
    })
  })

  describe("RestAPI", function(done) {
    it("should use the datasource alias property when querying the endpoint", function(done) {
      TestHelper.updateConfig({
        api: {
          "twitter": {
            "type": "restapi",
            "provider": "twitter",
            "auth": {
              "oauth": {
                "consumer_key": "key",
                "consumer_secret": "secret",
                "token": "token",
                "token_secret": "tokensecret"
              }
            }
          }
        }
      }).then(() => {
        new Datasource(Page("test", TestHelper.getPageSchema()), "twitter", TestHelper.getPathOptions()).init(function(err, ds) {
          if (err) done(err)

          ds.source.provider.should.eql('twitter')

          done()
        })
      })
    })
  })

  describe("RSS", function(done) {
    it("should use the datasource count property when querying the endpoint", function(done) {
      new Datasource(
        Page("test", TestHelper.getPageSchema()),
        "rss",
        TestHelper.getPathOptions()
      ).init(function(err, ds) {
        ds.schema.datasource.count = 10

        var params = ds.provider.buildQueryParams()
        should.exists(params.count)
        params.count.should.eql(10)
        done()
      })
    })

    it("should use an array of datasource fields when querying the endpoint", function(done) {
      new Datasource(
        Page("test", TestHelper.getPageSchema()),
        "rss",
        TestHelper.getPathOptions()
      ).init(function(err, ds) {
        ds.schema.datasource.fields = ["field1", "field2"]

        var params = ds.provider.buildQueryParams()
        should.exists(params.fields)
        params.fields.should.eql("field1,field2")
        done()
      })
    })

    it("should use an object of datasource fields when querying the endpoint", function(done) {
      new Datasource(
        Page("test", TestHelper.getPageSchema()),
        "rss",
        TestHelper.getPathOptions()
      ).init(function(err, ds) {
        ds.schema.datasource.fields = { field1: 1, field2: 1 }

        var params = ds.provider.buildQueryParams()
        should.exists(params.fields)
        params.fields.should.eql("field1,field2")
        done()
      })
    })

    it("should use the datasource filter property when querying the endpoint", function(done) {
      new Datasource(
        Page("test", TestHelper.getPageSchema()),
        "rss",
        TestHelper.getPathOptions()
      ).init(function(err, ds) {
        ds.schema.datasource.filter = { field: "value" }

        var params = ds.provider.buildQueryParams()

        should.exists(params.field)
        params.field.should.eql("value")
        done()
      })
    })

    it("should return data when no error is encountered", function(done) {
      var host = "http://www.feedforall.com"
      var path = "/sample.xml"

      var scope = nock(host)
        .get(path)
        .replyWithFile(200, __dirname + "/../rss.xml")

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["rss"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
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

  describe("Markdown", function(done) {
    it("should process frontmatter from the files in the datasource path", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "markdown"
      )

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["markdown"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()

                should.exist(res.body.markdown.results)
                res.body.markdown.results.should.be.Array
                res.body.markdown.results[0].original.should.eql(
                  "---\ntitle: A Quick Brown Fox\ncategory: guggenheim\ndate: 2010-01-01\n---\n\n# Basic markdown\n\nMarkdown can have [links](https://dadi.tech), _emphasis_ and **bold** formatting.\n"
                ),
                  res.body.markdown.results[0].attributes.title.should.eql(
                    "A Quick Brown Fox"
                  )
                res.body.markdown.results[0].attributes.category.should.eql(
                  "guggenheim"
                )
                res.body.markdown.results[0].attributes.date.should.eql(
                  "2010-01-01T00:00:00.000Z"
                )

                done()
              })
          })
        })
      })
    })

    it("should return correct pagination metadata", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "markdown"
      )

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["markdown"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()

                res.body.markdown.metadata.page.should.equal(1)
                res.body.markdown.metadata.limit.should.equal(1)
                res.body.markdown.metadata.totalPages.should.be.above(1)
                res.body.markdown.metadata.nextPage.should.equal(2)

                done()
              })
          })
        })
      })
    })

    it("should use the datasource requestParams to filter the results", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "markdown"
      )

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["markdown"]
          pages[0].routes[0].path = "/test/:category?"

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client.get("/test/sports?debug=json").end((err, res) => {
              Datasource.Datasource.prototype.loadDatasource.restore()

              res.body.params["category"].should.equal("sports")
              res.body.markdown.results[0].attributes.category.should.equal(
                "sports"
              )
              res.body.markdown.metadata.page.should.equal(1)
              res.body.markdown.metadata.limit.should.equal(1)
              res.body.markdown.metadata.totalPages.should.equal(1)

              done()
            })
          })
        })
      })
    })

    it("should return the number of records specified by the count property", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "markdown"
      )

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["markdown"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.markdown.results)
                res.body.markdown.results.length.should.eql(1)
                done()
              })
          })
        })
      })
    })

    it("should process files of a specified extension", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "markdown"
      )
      dsSchema.datasource.source.extension = "txt"

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["markdown"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.markdown.results)
                res.body.markdown.results.should.be.Array
                res.body.markdown.results[0].attributes.title.should.eql(
                  "A txt file format"
                )
                done()
              })
          })
        })
      })
    })

    it("should return an error if the source folder does not exist", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "markdown"
      )
      dsSchema.datasource.source.path = "./foobar"

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["markdown"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.markdown.errors)
                res.body.markdown.errors[0].title.should.eql(
                  "No markdown files found"
                )
                done()
              })
          })
        })
      })
    })

    it("should ignore malformed dates in a source file", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "markdown"
      )
      dsSchema.datasource.source.extension = "txt"

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["markdown"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.markdown.results)
                res.body.markdown.results[0].attributes.date.should.eql(
                  "madeupdate"
                )
                done()
              })
          })
        })
      })
    })

    it("should sort by the specified field in reverse order if set to -1", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "markdown"
      )

      delete dsSchema.datasource.sort.date
      dsSchema.datasource.sort["attributes.date"] = -1
      dsSchema.datasource.count = 2

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["markdown"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.markdown.results)
                res.body.markdown.results[0].attributes.title.should.eql(
                  "Another Quick Brown Fox"
                )
                res.body.markdown.results[1].attributes.title.should.eql(
                  "A Quick Brown Fox"
                )
                done()
              })
          })
        })
      })
    })

    it("should only return the selected fields as specified by the datasource", function(done) {
      var dsSchema = TestHelper.getSchemaFromFile(
        TestHelper.getPathOptions().datasourcePath,
        "markdown"
      )
      dsSchema.datasource.fields = ["attributes.title", "attributes._id"]
      dsSchema.datasource.count = 2

      sinon
        .stub(Datasource.Datasource.prototype, "loadDatasource")
        .yields(null, dsSchema)

      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowDebugView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].datasources = ["markdown"]

          TestHelper.startServer(pages).then(() => {
            var connectionString =
              "http://" +
              config.get("server.host") +
              ":" +
              config.get("server.port")
            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?debug=json")
              .end((err, res) => {
                Datasource.Datasource.prototype.loadDatasource.restore()
                should.exist(res.body.markdown.results)

                res.body.markdown.results[0].attributes.title.should.eql(
                  "A Quick Brown Fox"
                )
                res.body.markdown.results[1].attributes.title.should.eql(
                  "Another Quick Brown Fox"
                )
                done()
              })
          })
        })
      })
    })
  })
})
