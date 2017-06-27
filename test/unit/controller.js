var _ = require("underscore")
var nock = require("nock")
var request = require("supertest")
var should = require("should")
var sinon = require("sinon")

var api = require(__dirname + "/../../dadi/lib/api")
var Server = require(__dirname + "/../../dadi/lib")
var Page = require(__dirname + "/../../dadi/lib/page")
var Controller = require(__dirname + "/../../dadi/lib/controller")
var TestHelper = require(__dirname + "/../help")()
var config = require(__dirname + "/../../config")
var help = require(__dirname + "/../../dadi/lib/help")
var remoteProvider = require(__dirname + "/../../dadi/lib/providers/remote")
var apiProvider = require(__dirname + "/../../dadi/lib/providers/dadiapi")

var connectionString =
  "http://" + config.get("server.host") + ":" + config.get("server.port")

describe("Controller", function(done) {
  beforeEach(function(done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(function(done) {
    TestHelper.stopServer(done)
  })

  it("should return a 404 template if one is configured", function(done) {
    TestHelper.disableApiConfig().then(() => {
      var pages = TestHelper.setUp404Page()
      pages[0].settings.cache = false

      TestHelper.startServer(pages).then(() => {
        var client = request(connectionString)

        client.get("/not-a-page").expect(404).end(function(err, res) {
          if (err) return done(err)
          res.text.should.eql("Page Not Found Template")
          done()
        })
      })
    })
  })

  it("should return a 404 if a page's requiredDatasources are not populated", function(
    done
  ) {
    TestHelper.disableApiConfig().then(() => {
      var pages = TestHelper.setUpPages()
      pages[0].settings.cache = false
      pages[0].datasources = ["categories"]
      pages[0].requiredDatasources = ["categories"]

      TestHelper.startServer(pages).then(() => {
        // provide empty API response
        var results = { results: [] }
        sinon
          .stub(Controller.Controller.prototype, "loadData")
          .yields(null, results)

        var client = request(connectionString)

        client.get(pages[0].routes[0].path).expect(404).end(function(err, res) {
          if (err) return done(err)
          Controller.Controller.prototype.loadData.restore()
          done()
        })
      })
    })
  })

  it("should return a 200 if a page's requiredDatasources are populated", function(
    done
  ) {
    TestHelper.disableApiConfig().then(() => {
      var pages = TestHelper.setUpPages()
      pages[0].datasources = ["categories"]
      pages[0].requiredDatasources = ["categories"]

      TestHelper.startServer(pages).then(() => {
        // provide API response
        var results = { categories: { results: [{ _id: 1, title: "books" }] } }
        sinon
          .stub(Controller.Controller.prototype, "loadData")
          .yields(null, results)

        var client = request(connectionString)
        client.get(pages[0].routes[0].path).expect(200).end(function(err, res) {
          if (err) return done(err)
          Controller.Controller.prototype.loadData.restore()
          done()
        })
      })
    })
  })

  describe("Events", function(done) {
    it("should load events in the order they are specified", function(done) {
      TestHelper.disableApiConfig().then(() => {
        var pages = TestHelper.setUpPages()
        pages[0].events = ["b", "a"]

        controller = Controller(pages[0], TestHelper.getPathOptions())
        controller.events.should.exist
        controller.events[0].name.should.eql("b")
        controller.events[1].name.should.eql("a")
        done()
      })
    })

    it("should run events in the order they are specified", function(done) {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowJsonView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].events = ["b", "a"]

          TestHelper.startServer(pages).then(() => {
            // provide event response
            var method = sinon.spy(
              Controller.Controller.prototype,
              "loadEventData"
            )

            var client = request(connectionString)
            client
              .get(pages[0].routes[0].path + "?json=true")
              .end(function(err, res) {
                if (err) return done(err)

                Controller.Controller.prototype.loadEventData.restore()
                method.restore()

                method.called.should.eql(true)
                method.secondCall.args[0][0].should.eql(controller.events[0])

                res.body["b"].should.eql("I came from B")
                res.body["a"].should.eql("Results for B found: true")
                done()
              })
          })
        })
      })
    })
  })

  describe("Preload Events", function(done) {
    it("should load preloadEvents in the controller instance", function(done) {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ globalEvents: [] }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].events = ["test_event"]
          pages[0].preloadEvents = ["test_preload_event"]

          controller = Controller(pages[0], TestHelper.getPathOptions())
          should.exist(controller.preloadEvents)
          controller.preloadEvents[0].name.should.eql(pages[0].preloadEvents[0])
          done()
        })
      })
    })

    it("should run preloadEvents within the get request", function(done) {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({ allowJsonView: true }).then(() => {
          var pages = TestHelper.setUpPages()
          pages[0].events = ["test_event"]
          pages[0].preloadEvents = ["test_preload_event"]

          TestHelper.startServer(pages).then(() => {
            // provide event response
            var results = { results: [{ _id: 1, title: "books" }] }
            var method = sinon.spy(
              Controller.Controller.prototype,
              "loadEventData"
            )

            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?json=true")
              .end(function(err, res) {
                if (err) return done(err)
                method.restore()
                method.called.should.eql(true)
                method.firstCall.args[0].should.eql(controller.preloadEvents)

                res.body["preload"].should.eql(true)
                res.body["run"].should.eql(true)

                done()
              })
          })
        })
      })
    })
  })

  describe("Global Events", function(done) {
    it("should load globalEvents in the controller instance", function(done) {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          globalEvents: ["test_global_event"]
        }).then(() => {
          var pages = TestHelper.setUpPages()

          TestHelper.startServer(pages).then(() => {
            controller = Controller(pages[0], TestHelper.getPathOptions())
            controller.preloadEvents.should.exist
            controller.preloadEvents[0].name.should.eql("test_global_event")
            done()
          })
        })
      })
    })

    it("should run globalEvents within the get request", function(done) {
      TestHelper.disableApiConfig().then(() => {
        TestHelper.updateConfig({
          allowJsonView: true,
          globalEvents: ["test_global_event"]
        }).then(() => {
          var pages = TestHelper.setUpPages()

          TestHelper.startServer(pages).then(() => {
            // provide event response
            var results = { results: [{ _id: 1, title: "books" }] }
            var method = sinon.spy(
              Controller.Controller.prototype,
              "loadEventData"
            )

            var client = request(connectionString)

            client
              .get(pages[0].routes[0].path + "?json=true")
              .end(function(err, res) {
                if (err) return done(err)
                method.restore()
                method.called.should.eql(true)
                method.firstCall.args[0].should.eql(controller.preloadEvents)

                res.body["global_event"].should.eql("FIRED")

                done()
              })
          })
        })
      })
    })
  })

  describe("Chained Datasource", function() {
    TestHelper.clearCache()
    this.timeout(5000)

    it("should apply datasource output params to the chained datasource", function(
      done
    ) {
      TestHelper.enableApiConfig().then(() => {
        var pages = TestHelper.setUpPages()
        pages[0].datasources = ["global", "car-makes"]

        var host =
          "http://" + config.get("api.host") + ":" + config.get("api.port")

        var endpointGlobal =
          "/1.0/system/all?count=20&page=1&filter=%7B%7D&fields=%7B%7D&sort=%7B%22name%22:1%7D"

        var results1 = JSON.stringify({
          results: [{ id: "1234", name: "Test" }]
        })
        var results2 = JSON.stringify({ results: [{ name: "Crime" }] })

        TestHelper.setupApiIntercepts()

        var scope1 = nock(host).get(endpointGlobal).reply(200, results1)

        var scope2 = nock(host).get(/cars\/makes/).reply(200, results2)

        var providerSpy = sinon.spy(apiProvider.prototype, "load")

        TestHelper.startServer(pages)
          .then(() => {
            var client = request(connectionString)

            client.get(pages[0].routes[0].path).end(function(err, res) {
              if (err) return done(err)

              providerSpy.restore()

              var call = providerSpy.secondCall
              var provider = call.thisValue

              var q = require("url").parse(provider.options.path, true).query
              var filter = q.filter
              var filterObj = JSON.parse(filter)
              should.exist(filterObj._id)
              filterObj._id.should.eql("1234")

              done()
            })
          })
          .catch(err => {
            done(err)
          })
      })
    })
  })

  describe("Datasource Filter Events", function(done) {
    it("should run an attached `filterEvent` before datasource loads", function(
      done
    ) {
      TestHelper.enableApiConfig().then(() => {
        var pages = TestHelper.setUpPages()
        pages[0].datasources = ["car-makes-unchained", "filters"]

        var host =
          "http://" + config.get("api.host") + ":" + config.get("api.port")

        var endpoint1 =
          "/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D"
        var endpoint2 =
          "/1.0/test/filters?count=20&page=1&filter=%7B%22y%22:%222%22,%22x%22:%221%22%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D"

        var results1 = JSON.stringify({ results: [{ name: "Crime" }] })
        var results2 = JSON.stringify({ results: [{ name: "Crime" }] })

        TestHelper.setupApiIntercepts()

        var scope1 = nock(host).get(endpoint1).reply(200, results1)

        var scope2 = nock(host).get(endpoint2).reply(200, results2)

        var providerSpy = sinon.spy(apiProvider.prototype, "load")

        TestHelper.startServer(pages).then(() => {
          var client = request(connectionString)
          client
            .get(pages[0].routes[0].path + "?json=true")
            .end(function(err, res) {
              if (err) return done(err)
              providerSpy.restore()

              res.body["car-makes-unchained"].should.exist
              res.body["filters"].should.exist

              var filterDatasource = providerSpy.thisValues[1]

              var q = require("url").parse(filterDatasource.options.path, true)
                .query
              var filter = q.filter
              var filterObj = JSON.parse(filter)

              filterDatasource.schema.datasource.filterEventResult.should.exist
              filterDatasource
                .schema.datasource.filterEventResult.x.should.exist
              filterDatasource.schema.datasource.filterEventResult.x.should.eql(
                "1"
              )

              filterObj.x.should.exist
              filterObj.x.should.eql("1")

              filterObj.y.should.exist
              filterObj.y.should.eql("2")

              done()
            })
        })
      })
    })
  })
})
