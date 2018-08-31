const path = require('path')
const should = require('should')

const sinon = require('sinon')
const sinonTest = require('sinon-test')

sinon.test = sinonTest.configureTest(sinon)
sinon.testCase = sinonTest.configureTestCase(sinon)

const api = require(`${__dirname}/../../dadi/lib/api`)
const Server = require(`${__dirname}/../help`).Server
const cache = require(`${__dirname}/../../dadi/lib/cache`)
const datasource = require(`${__dirname}/../../dadi/lib/datasource`)
const page = require(`${__dirname}/../../dadi/lib/page`)
const TestHelper = require(`${__dirname}/../help`)()
const config = require(path.resolve(path.join(__dirname, '/../../config')))

describe('Cache', done => {
  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  afterEach(done => {
    TestHelper.stopServer(done)
  })

  it('should be a function', done => {
    cache.should.be.Function
    done()
  })

  it(
    "should cache if the app's config settings allow",
    sinon.test(done => {
      const server = sinon.mock(Server)
      server.object.app = api()

      const cacheConfig = {
        caching: {
          directory: {
            enabled: true
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        const e = cache(server.object).enabled
        e.should.eql(true)
        done()
      })
    })
  )

  it(
    "should not cache if the app's config settings do not allow",
    sinon.test(done => {
      const server = sinon.mock(Server)
      server.object.app = api()

      const cacheConfig = {
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
    })
  )

  it(
    'should not cache if the url key can not be found in the loaded keys',
    sinon.test(done => {
      const server = sinon.mock(Server)
      server.object.app = api()

      server.object.components['/actualUrl'] = {
        page: {
          routes: [
            {
              path: ['/actualUrl']
            }
          ],
          settings: {
            cache: true
          }
        }
      }

      const req = {
        paths: ['/fakeUrl'],
        url: 'http://www.example.com/fakeUrl'
      }

      cache.reset()
      cache(server.object)
        .cachingEnabled(req)
        .should.eql(false)

      done()
    })
  )

  it(
    'should locate the component that matches the current request URL',
    sinon.test(done => {
      const server = sinon.mock(Server)
      server.object.app = api()

      server.object.components['/:anotherURL'] = {
        page: {
          routes: [
            {
              path: '/:anotherURL'
            }
          ],
          settings: {
            cache: true
          }
        }
      }

      server.object.components['/actualUrl'] = {
        page: {
          routes: [
            {
              path: '/actualUrl'
            }
          ],
          settings: {
            cache: true
          }
        }
      }

      const req = {
        paths: ['/:anotherURL', '/actualUrl'],
        url: 'http://www.example.com/actualUrl'
      }

      const cacheConfig = {
        caching: {
          directory: {
            enabled: true
          }
        }
      }

      cache.reset()
      const c = cache(server.object)
      const spy = sinon.spy(c, 'getEndpointMatchingRequest')

      TestHelper.updateConfig(cacheConfig).then(() => {
        c.cachingEnabled(req)

        spy.calledOnce.should.eql(true)
        should.exist(spy.lastCall.returnValue)

        spy.lastCall.returnValue.should.eql(
          server.object.components['/actualUrl']
        )
        done()
      })
    })
  )

  it(
    'should cache if the url key can be found in the loaded keys and it allows caching',
    sinon.test(done => {
      const server = sinon.mock(Server)
      server.object.app = api()

      server.object.components['/actualUrl'] = {
        page: {
          routes: [
            {
              path: '/actualUrl'
            }
          ],
          settings: {
            cache: true
          }
        }
      }

      const req = {
        paths: ['/actualUrl'],
        url: 'http://www.example.com/actualUrl'
      }

      const cacheConfig = {
        caching: {
          directory: {
            enabled: true
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        cache.reset()
        const c = cache(server.object)
        c.cachingEnabled(req).should.eql(true)
        done()
      })
    })
  )

  it(
    'should not cache if the url key can be found in the loaded keys but ?debug=json exists in the query',
    sinon.test(done => {
      const server = sinon.mock(Server)
      server.object.app = api()

      server.object.components['/actualUrl'] = {
        page: {
          routes: [
            {
              path: '/actualUrl'
            }
          ],
          xxx: {
            cache: false
          }
        }
      }

      const req = {
        paths: ['/actualUrl'],
        url: 'http://www.example.com/actualUrl?debug=json'
      }

      cache.reset()
      cache(server.object)
        .cachingEnabled(req)
        .should.eql(false)

      done()
    })
  )

  it(
    'should cache if the url key can be found in the loaded keys and ?json=false exists in the query',
    sinon.test(done => {
      const server = sinon.mock(Server)
      server.object.app = api()

      server.object.components['/actualUrl'] = {
        page: {
          routes: [
            {
              path: '/actualUrl'
            }
          ],
          settings: {
            cache: true
          }
        }
      }

      const req = {
        paths: ['/actualUrl'],
        url: 'http://www.example.com/actualUrl?json=false'
      }

      const cacheConfig = {
        caching: {
          directory: {
            enabled: true
          }
        }
      }

      TestHelper.updateConfig(cacheConfig).then(() => {
        cache.reset()
        const c = cache(server.object)
        c.cachingEnabled(req).should.eql(true)
        done()
      })
    })
  )

  it(
    'should not cache if the url key can be found in the loaded keys but it does not allow caching',
    sinon.test(done => {
      const server = sinon.mock(Server)
      server.object.app = api()

      server.object.components['/actualUrl'] = {
        page: {
          routes: [
            {
              path: '/actualUrl'
            }
          ],
          settings: {
            cache: false
          }
        }
      }

      const req = {
        paths: ['/actualUrl'],
        url: 'http://www.example.com/actualUrl'
      }

      cache.reset()
      cache(server.object)
        .cachingEnabled(req)
        .should.eql(false)
      done()
    })
  )
})
