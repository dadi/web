const path = require('path')
const should = require('should')
const sinon = require('sinon')

const middleware = require(`${__dirname}/../../dadi/lib/middleware`)
const TestHelper = require(`${__dirname}/../help`)()

describe('Middleware', done => {
  before(done => {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  it('should export constructor', done => {
    middleware.Middleware.should.be.Function
    done()
  })

  it('should export a `load()` function', done => {
    middleware('test', {}).load.should.be.Function
    done()
  })

  it('should export a `init()` function', done => {
    middleware('test', {}).init.should.be.Function
    done()
  })

  it('should export function that returns an instance', done => {
    middleware.should.be.Function
    middleware('test', {}).should.be.an.instanceOf(middleware.Middleware)
    done()
  })

  it('should attach name', done => {
    middleware('test', {}).name.should.eql('test')
    done()
  })

  it('should attach default `options`', done => {
    middleware('test').options.should.eql({})
    done()
  })

  it('should attach specified `options`', done => {
    middleware('test', { cache: true }).options.cache.should.eql(true)
    done()
  })

  it('should throw error if specified page name is not specified', done => {
    const pageName = null
    const eventName = 'car-reviews'

    should.throws(() => {
      e(pageName, eventName, {})
    }, Error)

    done()
  })

  it.skip('should use the attached middleware', done => {
    done()
  })

  it.skip('should throw errors when they occur in the attached middleware', done => {
    const mware = middleware('test', {
      middlewarePath: path.join(__dirname, '../app/middleware')
    })

    should.throws(() => {
      mware.init(app)({}, {}, data, (err, result) => {})
    })

    done()
  })

  it('should load the referenced middleware file from the filesystem', done => {
    const mware = middleware('test', {
      middlewarePath: path.join(__dirname, '../app/middleware')
    })
    const file = mware.load()

    const expected = require(path.join(__dirname, '../app/middleware/test.js'))

    file.should.eql(expected)
    done()
  })

  it('should throw an error if the referenced middleware file can not be found', done => {
    const mware = middleware('MISSING', {
      middlewarePath: path.join(__dirname, '../app/middleware')
    })
    const file = mware.loadEvent

    should.throws(() => {
      mware.load()
    })
    done()
  })
})
