const sinon = require('sinon')
const api = require(`${__dirname}/../../dadi/lib/api`)
const Server = require(`${__dirname}/../help`).Server
const should = require('should')
const pathToRegexp = require('path-to-regexp')
const page = require(`${__dirname}/../../dadi/lib/page`)
const TestHelper = require(`${__dirname}/../help`)()
const path = require('path')
const config = require(path.resolve(path.join(__dirname, '/../../config')))

describe('Page', done => {
  before(done => {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  it('should export constructor', done => {
    page.Page.should.be.Function
    done()
  })

  it('should export function that returns an instance', done => {
    page.should.be.Function
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    page(name, schema).should.be.an.instanceOf(page.Page)
    done()
  })

  it('should attach name to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    page(name, schema).name.should.eql('test')
    done()
  })

  it('should attach key using name if not supplied', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    page(name, schema).key.should.eql('test')
    done()
  })

  it('should attach key if supplied', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.page.key = 'key!'
    page(name, schema).key.should.eql('key!')
    done()
  })

  it('should attach default `routes` to page if not specified', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    delete schema.routes
    page(name, schema).routes[0].path.should.eql('/test')
    done()
  })

  it('should attach specified `route` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    page(name, schema).routes[0].path.should.eql('/car-reviews/:make/:model')
    done()
  })

  it('should attach specified `route` to page when its a string instead of an array', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()

    delete schema.routes
    schema.route = {
      path: '/car-reviews/:make/:model'
    }

    const p = page(name, schema)
    p.routes[0].path.should.eql('/car-reviews/:make/:model')
    done()
  })

  it('should attach specified `route` to page when it is correct in the schema', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()

    schema.routes = [
      {
        path: '/car-reviews/:make/:model'
      }
    ]

    const p = page(name, schema)
    p.routes.should.eql(schema.routes)
    done()
  })

  it('should attach specified `route constraint` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.route = {
      path: '/test',
      constraint: 'getCategories'
    }
    page(name, schema).routes[0].constraint.should.eql('getCategories')
    done()
  })

  it('should attach specified `route constraint` to page when the `paths` is a string', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    delete schema.routes
    schema.route = {}
    schema.route.paths = '/car-reviews/:make/:model'
    schema.route.constraint = 'getCategories'
    page(name, schema).routes[0].constraint.should.eql('getCategories')
    done()
  })

  it('should generate `toPath` method for page paths', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)
    p.routes[0].path.should.eql('/car-reviews/:make/:model')

    p.toPath.should.be.a.Function

    const url = p.toPath({ make: 'bmw', model: '2-series' })
    url.should.eql('/car-reviews/bmw/2-series')

    done()
  })

  it('should return correct path when using `toPath` method with multiple paths and the first matches', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)

    p.routes[0].path.should.eql('/car-reviews/:make/:model')
    p.routes.push({ path: '/car-reviews/:make/:model/review/:subpage' })

    const url = p.toPath({ make: 'bmw', model: '2-series' })
    url.should.eql('/car-reviews/bmw/2-series')

    done()
  })

  it('should return correct path when using `toPath` method with multiple paths and the second matches', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)

    p.routes[0].path.should.eql('/car-reviews/:make/:model')
    p.routes.push({ path: '/car-reviews/:make/:model/review/:subpage' })

    const url = p.toPath({
      make: 'bmw',
      model: '2-series',
      subpage: 'on-the-road'
    })
    url.should.eql('/car-reviews/bmw/2-series/review/on-the-road')

    done()
  })

  it('should throw error when using `toPath` method with multiple paths and none match', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)

    p.routes[0].path.should.eql('/car-reviews/:make/:model')
    p.routes.push({ path: '/car-reviews/:make/:model/review/:subpage' })

    should.throws(() => {
      p.toPath({ make: 'bmw', yyy: '2-series', xxx: 'on-the-road' })
    }, Error)

    done()
  })

  it('should return correct path when using `toPath` method with multiple paths of the same length', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)

    p.routes[0].path.should.eql('/car-reviews/:make/:model')
    p.routes.push({ path: '/car-reviews/:make/:year' })

    const url = p.toPath({ make: 'bmw', year: '2005' })
    url.should.eql('/car-reviews/bmw/2005')

    done()
  })

  it('should be possible to retrieve a page from server components by key', done => {
    const server = sinon.mock(Server)
    server.object.app = api()

    server.object.components['/actualUrl'] = {
      page: {
        name: 'test page',
        key: 'test'
      },
      routes: [
        {
          path: '/actualUrl'
        }
      ],
      settings: {
        cache: true
      }
    }

    let component
    const matches = Object.keys(server.object.components).map(component => {
      if (server.object.components[component].page.key === 'test') {
        return server.object.components[component]
      }
    })

    if (matches.length > 0) {
      component = matches[0]
    }

    component.should.not.be.null
    component.page.key.should.eql('test')

    done()
  })

  it('should attach default `template` to page if not specified', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    delete schema.template
    page(name, schema, undefined, 'test.js').template.should.eql('test.js')
    done()
  })

  it('should attach specified `template` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    page(name, schema).template.should.eql('car-reviews.js')
    done()
  })

  it('should attach default `contentType` to page if not specified', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    delete schema.contentType
    page(name, schema).contentType.should.eql('text/html')
    done()
  })

  it('should attach specified `contentType` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.contentType = 'application/xml'
    page(name, schema).contentType.should.eql('application/xml')
    done()
  })

  it('should attach specified `settings` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)
    p.settings.should.exist
    p.settings.cache.should.exist
    p.settings.cache.should.be.true

    done()
  })

  it('should attach empty object when `settings` is not provided', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    delete schema.settings
    const p = page(name, schema)
    p.settings.should.eql({})

    done()
  })

  it('should set `passFilters` when `settings.passFilters` is provided', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.settings.passFilters = true
    const p = page(name, schema)
    p.passFilters.should.eql(true)
    done()
  })

  it('should not throw error if `cache` setting is not specified', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()

    delete schema.settings.cache

    const p = page(name, schema)

    p.key.should.eql(name)

    done()
  })

  it('should attach specified `datasources` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)
    p.datasources.should.exist
    p.datasources.should.eql(['car_makes'])
    done()
  })

  it('should attach empty `datasources` to page when not specified', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    delete schema.datasources
    const p = page(name, schema)
    p.datasources.should.exist
    p.datasources.should.eql([])
    done()
  })

  it('should attach specified `events` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)
    p.events.should.exist
    p.events.should.eql(['car-reviews'])
    done()
  })

  it('should attach empty `events` to page when not specified', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    delete schema.events
    const p = page(name, schema)
    p.events.should.exist
    p.events.should.eql([])
    done()
  })

  it('should attach specified `preloadEvents` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.preloadEvents = ['test_event']
    const p = page(name, schema)
    p.preloadEvents.should.exist
    p.preloadEvents.should.eql(['test_event'])
    done()
  })

  it('should attach empty `preloadEvents` to page when not specified', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)
    p.preloadEvents.should.exist
    p.preloadEvents.should.eql([])
    done()
  })

  it('should attach specified `requiredDatasources` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.requiredDatasources = ['car-reviews']
    const p = page(name, schema)
    p.requiredDatasources.should.exist
    p.requiredDatasources.should.eql(['car-reviews'])
    done()
  })

  it('should attach empty `requiredDatasources` to page when not specified', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)
    p.requiredDatasources.should.exist
    p.requiredDatasources.should.eql([])
    done()
  })

  it('should allow finding page by name', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)

    const found = page(name)
    found.should.equal(p)

    done()
  })

  it('should generate correct url for specific page paths', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const p = page(name, schema)

    const paths = []
    paths.push({ path: '/buy' })
    paths.push({ path: '/buy/how-we-do-it' })
    paths.push({ path: '/buy/testimonials' })
    paths.push({ path: '/buy/saved-offers' })
    paths.push({ path: '/buy/choose-by-category/:category?' })
    paths.push({ path: '/buy/choose-by-make/:make?' })
    paths.push({ path: '/buy/choose-by-price/:price?' })
    paths.push({ path: '/buy/choose-model' })
    paths.push({ path: '/buy/:make/:model/:body' })
    paths.push({ path: '/buy/configure/:make?/:model?' })
    paths.push({ path: '/buy/offers/:make/:model/:capId/:postcode?' })
    paths.push({ path: '/buy/offers/:make/:model/:capId/:offer-id/accept/' })
    paths.push({ path: '/buy/offers/:make/:model/:capId/:offer-id/details/' })
    paths.push({ path: '/buy/offers/:make/:model/:capId/:offer-id/options/' })
    paths.push({ path: '/contact-us' })
    paths.push({ path: '/map' })

    paths.forEach(path => {
      p.routes = [path]

      const tokens = pathToRegexp.parse(path.path)
      const parts = {}

      // console.log(tokens)
      tokens.forEach(token => {
        if (typeof token === 'object') {
          parts[token.name] = 'whatever'
        }
      })

      const url = p.toPath(parts)
      const expected = pathToRegexp.compile(path.path)(parts)
      // console.log(url)

      url.should.eql(expected)
    })

    done()
  })

  it('should attach `settings.postProcessors` to page', done => {
    const name = 'test'
    const schema = TestHelper.getPageSchema()
    schema.settings.postProcessors = ['minify-html']
    const p = page(name, schema)
    p.postProcessors.should.eql(['minify-html'])
    done()
  })
})
