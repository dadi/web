var nock = require('nock')
var sinon = require('sinon')
var should = require('should')
var request = require('supertest')
var _ = require('underscore')

var api = require(__dirname + '/../../dadi/lib/api')
var Server = require(__dirname + '/../../dadi/lib')
var Page = require(__dirname + '/../../dadi/lib/page')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var testHelper = require(__dirname + '/../help')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/../../dadi/lib/help')
var remoteProvider = require(__dirname + '/../../dadi/lib/providers/remote')

var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

var options = {
  datasourcePath: __dirname + '/../app/datasources',
  pagePath: __dirname + '/../app/pages',
  eventPath: __dirname + '/../app/events'
}

var controller

function startServer (page) {
  Server.app = api()
  Server.components = {}
  Server.start(function () {
    // create a handler for requests to this page
    controller = Controller(page, options)

    Server.addComponent({
        key: page.key,
        routes: page.routes,
        component: controller
    }, false);
  });
}

function cleanup (done) {
  config.set('globalEvents', [])
  Server.stop(function () {
    done()
  })
}

describe('Controller', function (done) {
  afterEach(function (done) {
    done()
  })

  it("should return a 404 if a page's requiredDatasources are not populated", function (done) {
    config.set('api.enabled', false)

    // create a page
    var name = 'test'
    var schema = testHelper.getPageSchema()
    var page = Page(name, schema)

    page.template = 'test.dust';
    page.routes[0].path = '/test';
    page.settings.cache = false;

    page.datasources = ['categories'];
    page.events = [];
    page.requiredDatasources = ['categories'];


    startServer(page)

    // provide empty API response
    var results = { results: [] }

    sinon.stub(Controller.Controller.prototype, 'loadData').yields(null, results)

    var client = request(connectionString)

    client
      .get(page.routes[0].path)
      .expect(404)
      .end(function (err, res) {
        if (err) return done(err)
        Controller.Controller.prototype.loadData.restore()
        cleanup(done)
      })
  })

  it("should return a 200 if a page's requiredDatasources are populated", function (done) {
    config.set('api.enabled', false)

    // create a page
    var name = 'test'
    var schema = testHelper.getPageSchema()
    var page = Page(name, schema)

    page.template = 'test.dust';
    page.routes[0].path = '/test';
    page.settings.cache = false;

    page.datasources = ['categories'];
    page.events = [];
    page.requiredDatasources = ['categories'];


    startServer(page)

    // provide API response
    var results = { categories: { results: [{_id: 1, title: 'books'}] } }

    sinon.stub(Controller.Controller.prototype, 'loadData').yields(null, results)

    var client = request(connectionString)

    client
      .get(page.routes[0].path)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)
        Controller.Controller.prototype.loadData.restore()
        cleanup(done)
      })
  })

  function getPageWithPreloadEvents () {
    // create a page
    var name = 'test'
    var schema = testHelper.getPageSchema()
    var page = Page(name, schema)

    page.contentType = 'application/json';
    page.template = 'test.dust';
    page.routes[0].path = '/test';
    page.settings.cache = false;

    page.datasources = [];
    page.events = ['test_event'];
    page.preloadEvents = ['test_preload_event'];


    return page
  }

  function getPage () {
    // create a page
    var name = 'test'
    var schema = testHelper.getPageSchema()
    var page = Page(name, schema)

    page.contentType = 'application/json';
    page.template = 'test.dust';
    page.routes[0].path = '/test';
    page.settings.cache = false;

    page.datasources = [];
    page.events = [];


    return page
  }

  describe('Events', function (done) {
    it('should load events in the order they are specified', function (done) {
      config.set('api.enabled', false)

      var page = getPage()
      page.events = ['b', 'a']
      controller = Controller(page, options)
      controller.events.should.exist
      controller.events[0].name.should.eql('b')
      controller.events[1].name.should.eql('a')
      done()
    })

    it('should run events in the order they are specified', function (done) {
      config.set('allowJsonView', true)
      var page = getPage()
      page.events = ['b', 'a']

      startServer(page)

      // provide event response
      var method = sinon.spy(Controller.Controller.prototype, 'loadEventData')

      var client = request(connectionString)

      client
        .get(page.routes[0].path + '?json=true')
        // .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          Controller.Controller.prototype.loadEventData.restore()

          method.called.should.eql(true)
          method.secondCall.args[0][0].should.eql(controller.events[0])
          method.restore()

          res.body['b'].should.eql('I came from B')
          res.body['a'].should.eql('Results for B found: true')

          cleanup(done)
        })
    })
  })

  describe('Preload Events', function (done) {
    it('should load preloadEvents in the controller instance', function (done) {
      config.set('api.enabled', false)

      var page = getPageWithPreloadEvents()
      controller = Controller(page, options)
      controller.preloadEvents.should.exist
      controller.preloadEvents[0].name.should.eql(page.preloadEvents[0])
      done()
    })

    it('should run preloadEvents within the get request', function (done) {
      config.set('api.enabled', false)
      config.set('allowJsonView', true)

      var page = getPageWithPreloadEvents()
      startServer(page)

      // provide event response
      var results = { results: [{_id: 1, title: 'books'}] }
      var method = sinon.spy(Controller.Controller.prototype, 'loadEventData')

      var client = request(connectionString)

      client
        .get(page.routes[0].path + '?json=true')
        // .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          method.called.should.eql(true)
          method.firstCall.args[0].should.eql(controller.preloadEvents)
          method.restore()

          res.body['preload'].should.eql(true)
          res.body['run'].should.eql(true)

          cleanup(done)
        })
    })
  })

  describe('Global Events', function (done) {
    it('should load globalEvents in the controller instance', function (done) {
      config.set('api.enabled', false)
      config.set('globalEvents', ['test_global_event'])

      var page = getPage()
      controller = Controller(page, options)
      controller.preloadEvents.should.exist
      controller.preloadEvents[0].name.should.eql('test_global_event')
      done()
    })

    it('should run globalEvents within the get request', function (done) {
      config.set('api.enabled', false)
      config.set('allowJsonView', true)
      config.set('globalEvents', ['test_global_event'])

      var page = getPage()
      startServer(page)

      // provide event response
      var results = { results: [{_id: 1, title: 'books'}] }
      var method = sinon.spy(Controller.Controller.prototype, 'loadEventData')

      var client = request(connectionString)

      client
        .get(page.routes[0].path + '?json=true')
        // .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          method.called.should.eql(true)
          method.firstCall.args[0].should.eql(controller.preloadEvents)
          method.restore()

          res.body['global_event'].should.eql('FIRED')

          cleanup(done)
        })
    })
  })

  describe.skip('Datasource Filter Events', function (done) {
    it('should run an attached `filterEvent` before datasource loads', function (done) {
      var name = 'test'
      var schema = testHelper.getPageSchema()
      schema.datasources = ['car-makes-unchained', 'filters']
      schema.events = []
      var page = Page(name, schema)
      page.template = 'test.dust'
      page.routes[0].path = '/test'
      page.settings.cache = false
      startServer(page)

      config.set('debug', true)

      var host = 'http://' + config.get('api.host') + ':' + config.get('api.port')

      var endpoint1 = '/1.0/cars/makes?count=20&page=1&filter=%7B%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D'
      var endpoint2 = '/1.0/test/filters?count=20&page=1&filter=%7B%22y%22:%222%22,%22x%22:%221%22%7D&fields=%7B%22name%22:1,%22_id%22:0%7D&sort=%7B%22name%22:1%7D'

      var results1 = JSON.stringify({ results: [ { name: 'Crime' } ] })
      var results2 = JSON.stringify({ results: [ { name: 'Crime' } ] })

      var scope1 = nock(host)
        .get(endpoint1)
        .reply(200, results1)

      var scope2 = nock(host)
        .get(endpoint2)
        .reply(200, results2)

      // provide API response
      // var apiResults = { 'car-makes-unchained':  }
      // // var dataStub = sinon.stub(help.DataHelper.prototype, 'load')
      // // dataStub.onCall(0).returns(null, apiResults)
      // // dataStub.onCall(1).returns(null, apiResults)

      //var providerStub = sinon.stub(remoteProvider.prototype, 'load')
      //providerStub.onFirstCall().yields(null, { results: [{_id: 1, title: 'books'}] })

      var client = request(connectionString)

      client
      .get(page.routes[0].path + '?json=true')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

          cleanup(function () {
            //providerStub.restore()

            console.log(res)

            res.body['car-makes-unchained'].should.exist
            res.body['filters'].should.exist

            controller.datasources['filters'].schema.datasource.filterEventResult.should.exist
            controller.datasources['filters'].schema.datasource.filterEventResult.x.should.exist
            controller.datasources['filters'].schema.datasource.filterEventResult.x.should.eql('1')

            controller.datasources['filters'].schema.datasource.filter.x.should.exist
            controller.datasources['filters'].schema.datasource.filter.x.should.eql('1')

            controller.datasources['filters'].schema.datasource.filter.y.should.exist
            controller.datasources['filters'].schema.datasource.filter.y.should.eql('2')

            done()
          })
        })
    })
  })
})
