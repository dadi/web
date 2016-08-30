var path = require('path')
var should = require('should')
var sinon = require('sinon')

var api = require(__dirname + '/../../dadi/lib/api')
var Server = require(__dirname + '/../../dadi/lib')
var cache = require(__dirname + '/../../dadi/lib/cache')
var datasource = require(__dirname + '/../../dadi/lib/datasource')
var page = require(__dirname + '/../../dadi/lib/page')
var TestHelper = require(__dirname + '/../help')()
var config = require(path.resolve(path.join(__dirname, '/../../config')))

describe('Cache', function (done) {
  beforeEach(function(done) {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  afterEach(function(done) {
    TestHelper.stopServer(done)
  })

  it('should be a function', function (done) {
    cache.should.be.Function
    done()
  })

  it('should take a server instance as an argument', sinon.test(function (done) {
    var server = sinon.mock(Server)
    server.object.app = api()

    var method = sinon.spy(server.object.app, 'use')
    cache.reset()
    cache(server.object).init()

    method.called.should.eql(true)
    done()
  }))

  it("should cache if the app's config settings allow", sinon.test(function (done) {
    var server = sinon.mock(Server)
    server.object.app = api()

    var cacheConfig = {
      caching: {
        directory: {
          enabled: true
        }
      }
    }

    TestHelper.updateConfig(cacheConfig).then(() => {
      var e = cache(server.object).enabled
      e.should.eql(true)
      done()
    })
  }))

  it("should not cache if the app's config settings don't allow", sinon.test(function (done) {
    var server = sinon.mock(Server)
    server.object.app = api()

    var cacheConfig = {
      caching: {
        directory: {
          enabled: false
        }
      }
    }

    TestHelper.updateConfig(cacheConfig).then(() => {
      cache(server.object).enabled.should.eql(true)
      done()
    })
  }))

  it("should not cache if the url key can't be found in the loaded keys", sinon.test(function (done) {
    var server = sinon.mock(Server)
    server.object.app = api()

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        settings: {
          cache: true
        }
      }
    }

    var req = {
      paths: ['/fakeUrl'],
      url: 'http://www.example.com/fakeUrl'
    }

    cache.reset()
    cache(server.object).cachingEnabled(req).should.eql(false)

    done()
  }))

  it('should cache if the url key can be found in the loaded keys and it allows caching', sinon.test(function (done) {
    var server = sinon.mock(Server)
    server.object.app = api()

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: '/actualUrl'
        }],
        settings: {
          cache: true
        }
      }
    }

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl'
    }

    var cacheConfig = {
      caching: {
        directory: {
          enabled: true
        }
      }
    }

    TestHelper.updateConfig(cacheConfig).then(() => {
      cache.reset()
      var c = cache(server.object)
      c.cachingEnabled(req).should.eql(true)
      done()
    })
  }))

  it('should not cache if the url key can be found in the loaded keys but it does not specify options', sinon.test(function (done) {
    var server = sinon.mock(Server)
    server.object.app = api()

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: '/actualUrl'
        }],
        xxx: {
          cache: false
        }
      }
    }

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl'
    }

    cache.reset()
    cache(server.object).cachingEnabled(req).should.eql(false)

    done()
  }))

  it('should not cache if the url key can be found in the loaded keys but ?json=true exists in the query', sinon.test(function (done) {
    var server = sinon.mock(Server)
    server.object.app = api()

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        xxx: {
          cache: false
        }
      }
    }

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl?json=true'
    }

    cache.reset()
    cache(server.object).cachingEnabled(req).should.eql(false)

    done()
  }))

  it('should cache if the url key can be found in the loaded keys and ?json=false exists in the query', sinon.test(function (done) {
    var server = sinon.mock(Server)
    server.object.app = api()

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        settings: {
          cache: true
        }
      }
    }

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl?json=false'
    }

    var cacheConfig = {
      caching: {
        directory: {
          enabled: true
        }
      }
    }

    TestHelper.updateConfig(cacheConfig).then(() => {
      cache.reset()
      var c = cache(server.object)
      c.cachingEnabled(req).should.eql(true)
      done()
    })
  }))

  it('should not cache if the url key can be found in the loaded keys but it does not allow caching', sinon.test(function (done) {
    var server = sinon.mock(Server)
    server.object.app = api()

    server.object.components['/actualUrl'] = {
      page: {
        routes: [{
          path: ['/actualUrl']
        }],
        settings: {
          cache: false
        }
      }
    }

    var req = {
      paths: ['/actualUrl'],
      url: 'http://www.example.com/actualUrl'
    }

    cache.reset()
    cache(server.object).cachingEnabled(req).should.eql(false)
    done()
  }))
})
