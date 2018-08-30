const path = require('path')
const should = require('should')
const sinon = require('sinon')

const api = require(`${__dirname}/../../dadi/lib/api`)
const Controller = require(`${__dirname}/../../dadi/lib/controller`)
const Page = require(`${__dirname}/../../dadi/lib/page`)
const helpers = require(`${__dirname}/../help`)
const TestHelper = require(`${__dirname}/../help`)()

let Server

describe('Server', done => {
  before(done => {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  beforeEach(done => {
    Server = require(`${__dirname}/../help`).getNewServer()

    setTimeout(done, 200)
  })

  it('should export function that allows adding components', done => {
    Server.addComponent.should.be.Function
    done()
  })

  it('should export function that allows getting components', done => {
    Server.getComponent.should.be.Function
    done()
  })

  it('should allow adding components', done => {
    Server.app = api()

    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const page = Page(name, schema)

    Server.components = {}
    Server.addComponent(
      {
        key: page.key,
        routes: page.routes,
        component: { page: page }
      },
      false
    )

    Object.keys(Server.components).length.should.eql(1)
    done()
  })

  it('should allow getting components by key', done => {
    Server.app = api()

    const name = 'test'
    const schema = TestHelper.getPageSchema()
    const page = Page(name, schema)

    Server.addComponent(
      {
        key: page.key,
        routes: page.routes,
        component: { page: page }
      },
      false
    )

    Server.getComponent('test').should.not.be.null
    done()
  })

  it('should recursively create components from pages', done => {
    Server.app = api()

    const config = TestHelper.getConfig().then(config => {
      const options = Server.loadPaths()
      const pagesPath = path.resolve(config.paths.pages)

      Server.updatePages(pagesPath, options, false).then(server => {
        server.components['/'].should.be.Function
        server.components['/subdir/page1'].should.be.Function
        server.components['/subdir/subsubdir/page2'].should.be.Function

        done()
      })
    })
  })

  it('should not create components from templates without a schema', done => {
    Server.app = api()

    const config = TestHelper.getConfig().then(config => {
      const options = Server.loadPaths()
      const pagesPath = path.resolve(config.paths.pages)

      Server.updatePages(pagesPath, options, false).then(server => {
        should.not.exist(server.components['/404'])
        should.not.exist(server.components['/test'])

        done()
      })
    })
  })
})
