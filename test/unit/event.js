const path = require('path')
const should = require('should')
const sinon = require('sinon')
const e = require(`${__dirname}/../../dadi/lib/event`)
const TestHelper = require(`${__dirname}/../help`)()

describe('Event', done => {
  before(done => {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  it('should export constructor', done => {
    e.Event.should.be.Function
    done()
  })

  it('should export a `loadEvent()` function', done => {
    const pageName = 'test'
    const eventName = 'car-reviews'
    e(pageName, eventName, {}).loadEvent.should.be.Function
    done()
  })

  it('should export a `run()` function', done => {
    const pageName = 'test'
    const eventName = 'car-reviews'
    e(pageName, eventName, {}).run.should.be.Function
    done()
  })

  it('should export function that returns an instance', done => {
    e.should.be.Function
    const pageName = 'test'
    const eventName = 'car-reviews'
    e(pageName, eventName, {}).should.be.an.instanceOf(e.Event)
    done()
  })

  it('should attach name to event', done => {
    const pageName = 'test'
    const eventName = 'car-reviews'
    e(pageName, eventName, {}).name.should.eql(eventName)
    done()
  })

  it('should attach page to event', done => {
    const pageName = 'test'
    const eventName = 'car-reviews'
    e(pageName, eventName, {}).page.should.eql(pageName)
    done()
  })

  it('should attach default `options` to event', done => {
    const pageName = 'test'
    const eventName = 'car-reviews'
    const newEvent = e(pageName, eventName, null)
    newEvent.options.should.eql({})
    done()
  })

  it('should attach specified `options` to event', done => {
    const pageName = 'test'
    const eventName = 'car-reviews'
    const newEvent = e(pageName, eventName, { cache: true })
    newEvent.options.cache.should.be.true
    done()
  })

  it.skip('should throw error if specified page name is not specified', done => {
    const pageName = null
    const eventName = 'car-reviews'

    should.throws(() => {
      e(pageName, eventName, {})
    }, Error)

    done()
  })

  it('should run the attached event', done => {
    const pageName = 'test'
    const eventName = 'test_event'
    const newEvent = e(pageName, eventName, {
      eventPath: path.join(__dirname, '../app/events')
    })

    const data = { test: true }
    newEvent.run({}, {}, data, (err, result) => {
      result.should.eql({ test: true, run: true })
      done()
    })
  })

  it('should handle errors gracefully when they occur in the attached event', done => {
    const pageName = 'test'
    const eventName = 'test_event_error'
    const newEvent = e(pageName, eventName, {
      eventPath: path.join(__dirname, '../app/events')
    })

    const data = { test: true }

    const req = {
      url: '/test',
      params: { one: 1 }
    }

    newEvent.run(req, {}, data, (err, result) => {
      should.not.exist(err)
      should.not.exist(result)
      done()
    })
  })

  it('should load the referenced event file from the filesystem', done => {
    const pageName = 'test'
    const eventName = 'test_event'
    const newEvent = e(pageName, eventName, {
      eventPath: path.join(__dirname, '../app/events')
    })

    const file = newEvent.loadEvent()
    const expected = require(path.join(
      __dirname,
      '../app/events/test_event.js'
    ))

    file.should.eql(expected)
    done()
  })

  it('should throw an error if the referenced event file can not be found', done => {
    const pageName = 'test'
    const eventName = 'test_event_xxx'
    const newEvent = e(pageName, eventName, {
      eventPath: path.join(__dirname, '../app/events')
    })

    should.throws(() => {
      newEvent.loadEvent()
    })
    done()
  })
})
