var sinon = require('sinon');
var should = require('should');
var request = require('supertest');
var _ = require('underscore');

var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var Page = require(__dirname + '/../../dadi/lib/page');
var Controller = require(__dirname + '/../../dadi/lib/controller');
var testHelper = require(__dirname + '/../help');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/../../dadi/lib/help');

var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

var options = {
  datasourcePath: __dirname + '/../app/datasources',
  pagePath: __dirname + '/../app/pages',
  eventPath: __dirname + '/../app/events'
};

var controller;

function startServer(page) {
  Server.app = api();
  Server.components = {};
  Server.start(function() {
    // create a handler for requests to this page
    controller = Controller(page, options);

    Server.addComponent({
        key: page.key,
        route: page.route,
        component: controller
    }, false);
  });
}

function cleanup(done) {
  config.set('globalEvents', [])
  Server.stop(function() {
    done();
  });
}

describe('Controller', function (done) {

  afterEach(function(done) {
    done();
  });

  it('should return a 404 if a page\'s requiredDatasources are not populated', function(done) {

    config.set('api.enabled', false);

    // create a page
    var name = 'test';
    var schema = testHelper.getPageSchema();
    var page = Page(name, schema);

    page.template = 'test.dust';
    page.route.paths[0] = '/test';
    page.settings.cache = false;

    page.datasources = ['categories'];
    page.events = [];
    page.requiredDatasources = ['categories'];
    delete page.route.constraint;

    startServer(page);

    // provide empty API response
    var results = { results: [] }

    sinon.stub(help.DataHelper.prototype, 'load').yields(null, results);

    var client = request(connectionString);

    client
    .get(page.route.paths[0])
    .expect(404)
    .end(function (err, res) {
      if (err) return done(err);
      help.DataHelper.prototype.load.restore();
      cleanup(done);
    });
  })

  it('should return a 200 if a page\'s requiredDatasources are populated', function(done) {

    config.set('api.enabled', false);

    // create a page
    var name = 'test';
    var schema = testHelper.getPageSchema();
    var page = Page(name, schema);

    page.template = 'test.dust';
    page.route.paths[0] = '/test';
    page.settings.cache = false;

    page.datasources = ['categories'];
    page.events = [];
    page.requiredDatasources = ['categories'];
    delete page.route.constraint;

    startServer(page);

    // provide API response
    var results = { results: [{_id: 1, title: 'books'}] }

    sinon.stub(help.DataHelper.prototype, 'load').yields(null, results);

    var client = request(connectionString);

    client
    .get(page.route.paths[0])
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err);
      help.DataHelper.prototype.load.restore();
      cleanup(done);
    });
  })

  function getPageWithPreloadEvents() {
    // create a page
    var name = 'test';
    var schema = testHelper.getPageSchema();
    var page = Page(name, schema);

    page.contentType = 'application/json';
    page.template = 'test.dust';
    page.route.paths[0] = '/test';
    page.settings.cache = false;

    page.datasources = [];
    page.events = ['test_event'];
    page.preloadEvents = ['test_preload_event'];
    delete page.route.constraint;

    return page;
  }

  function getPage() {
    // create a page
    var name = 'test';
    var schema = testHelper.getPageSchema();
    var page = Page(name, schema);

    page.contentType = 'application/json';
    page.template = 'test.dust';
    page.route.paths[0] = '/test';
    page.settings.cache = false;

    page.datasources = [];
    page.events = [];
    delete page.route.constraint;

    return page;
  }

  describe('Events', function(done) {
    it('should load events in the order they are specified', function(done) {
      config.set('api.enabled', false);

      var page = getPage();
      page.events = ['b','a']
      controller = Controller(page, options);
      controller.events.should.exist;
      controller.events[0].name.should.eql('b');
      controller.events[1].name.should.eql('a');
      done();
    })

    it('should run events in the order they are specified', function(done) {
      config.set('allowJsonView', true);
      var page = getPage();
      page.events = ['b','a']

      startServer(page);

      // provide API response
      var apiResults = { results: [{_id: 1, title: 'books'}] }
      sinon.stub(help.DataHelper.prototype, 'load').yields(null, apiResults);

      // provide event response
      var method = sinon.spy(Controller.Controller.prototype, 'loadEventData');

      var client = request(connectionString);

      client
      .get(page.route.paths[0] + '?json=true')
      //.expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        method.called.should.eql(true);
        method.secondCall.args[0][0].should.eql(controller.events[0])
        method.restore()
        help.DataHelper.prototype.load.restore();

        res.body['b'].should.eql('I came from B');
        res.body['a'].should.eql('Results for B found: true');

        cleanup(done);
      });
    })
  })

  describe('Preload Events', function(done) {
    it('should load preloadEvents in the controller instance', function(done) {
      config.set('api.enabled', false);

      var page = getPageWithPreloadEvents();
      controller = Controller(page, options);
      controller.preloadEvents.should.exist;
      controller.preloadEvents[0].name.should.eql(page.preloadEvents[0]);
      done();
    })

    it('should run preloadEvents within the get request', function(done) {
      config.set('api.enabled', false);
      config.set('allowJsonView', true);

      var page = getPageWithPreloadEvents();
      startServer(page);

      // provide API response
      var apiResults = { results: [{_id: 1, title: 'books'}] }
      sinon.stub(help.DataHelper.prototype, 'load').yields(null, apiResults);

      // provide event response
      var results = { results: [{_id: 1, title: 'books'}] }
      var method = sinon.spy(Controller.Controller.prototype, 'loadEventData');

      var client = request(connectionString);

      client
      .get(page.route.paths[0] + '?json=true')
      //.expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        method.called.should.eql(true);
        method.firstCall.args[0].should.eql(controller.preloadEvents);
        method.restore()
        help.DataHelper.prototype.load.restore();

        res.body['preload'].should.eql(true);
        res.body['run'].should.eql(true);

        cleanup(done);
      });
    })
  })

  describe('Global Events', function(done) {
    it('should load globalEvents in the controller instance', function(done) {
      config.set('api.enabled', false);
      config.set('globalEvents', ['test_global_event'])

      var page = getPage();
      controller = Controller(page, options);
      controller.preloadEvents.should.exist;
      controller.preloadEvents[0].name.should.eql('test_global_event');
      done();
    })

    it('should run globalEvents within the get request', function(done) {
      config.set('api.enabled', false);
      config.set('allowJsonView', true);
      config.set('globalEvents', ['test_global_event'])

      var page = getPage();
      startServer(page);

      // provide API response
      var apiResults = { results: [{_id: 1, title: 'books'}] }
      sinon.stub(help.DataHelper.prototype, 'load').yields(null, apiResults);

      // provide event response
      var results = { results: [{_id: 1, title: 'books'}] }
      var method = sinon.spy(Controller.Controller.prototype, 'loadEventData');

      var client = request(connectionString);

      client
      .get(page.route.paths[0] + '?json=true')
      //.expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        method.called.should.eql(true);
        method.firstCall.args[0].should.eql(controller.preloadEvents);
        method.restore()
        help.DataHelper.prototype.load.restore();

        res.body['global_event'].should.eql('FIRED');

        cleanup(done);
      });
    })
  })

  describe('Global Events', function(done) {
    it('should load globalEvents in the controller instance', function(done) {
      config.set('api.enabled', false);
      config.set('globalEvents', ['test_global_event'])

      var page = getPage();
      controller = Controller(page, options);
      controller.preloadEvents.should.exist;
      controller.preloadEvents[0].name.should.eql('test_global_event');
      done();
    })

    it('should run globalEvents within the get request', function(done) {
      config.set('api.enabled', false);
      config.set('allowJsonView', true);
      config.set('globalEvents', ['test_global_event'])

      var page = getPage();
      startServer(page);

      // provide API response
      var apiResults = { results: [{_id: 1, title: 'books'}] }
      sinon.stub(help.DataHelper.prototype, 'load').yields(null, apiResults);

      // provide event response
      var results = { results: [{_id: 1, title: 'books'}] }
      var method = sinon.spy(Controller.Controller.prototype, 'loadEventData');

      var client = request(connectionString);

      client
      .get(page.route.paths[0] + '?json=true')
      //.expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        method.called.should.eql(true);
        method.firstCall.args[0].should.eql(controller.preloadEvents);
        method.restore()
        help.DataHelper.prototype.load.restore();

        res.body['global_event'].should.eql('FIRED');

        cleanup(done);
      });
    })
  })

  describe('Datasource Filter Events', function(done) {
    it('should run an attached `filterEvent` before datasource loads', function(done) {

      var name = 'test';
      var schema = testHelper.getPageSchema();
      schema.datasources = ['car-makes-unchained', 'filters']
      schema.events = []
      var page = Page(name, schema);
      page.template = 'test.dust';
      page.route.paths[0] = '/test';
      page.settings.cache = false;
      startServer(page);

      // provide API response
      var apiResults = { results: [{_id: 1, title: 'books'}] }
      //var dataStub = sinon.stub(help.DataHelper.prototype, 'load');
      // dataStub.onCall(0).returns(null, apiResults);
      // dataStub.onCall(1).returns(null, apiResults);

      sinon.stub(help.DataHelper.prototype, 'load').yields(null, apiResults);

      var client = request(connectionString);

      client
      .get(page.route.paths[0] + '?json=true')
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        cleanup(function() {
          help.DataHelper.prototype.load.restore();

          res.body['car-makes-unchained'].should.exist;
          res.body['filters'].should.exist;

          controller.datasources['filters'].schema.datasource.filterEventResult.should.exist;
          controller.datasources['filters'].schema.datasource.filterEventResult.x.should.exist;
          controller.datasources['filters'].schema.datasource.filterEventResult.x.should.eql('1');

          controller.datasources['filters'].schema.datasource.filter.x.should.exist;
          controller.datasources['filters'].schema.datasource.filter.x.should.eql('1');

          controller.datasources['filters'].schema.datasource.filter.y.should.exist;
          controller.datasources['filters'].schema.datasource.filter.y.should.eql('2');

          done();
        })
      })
    })
  })

})
