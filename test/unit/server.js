var path = require('path')
var should = require('should')
var sinon = require('sinon')

var api = require(__dirname + '/../../dadi/lib/api')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var Page = require(__dirname + '/../../dadi/lib/page')
var helpers = require(__dirname + '/../help')
var TestHelper = require(__dirname + '/../help')()

var Server

describe('Server', function (done) {
  before(function (done) {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  beforeEach(function (done) {
    Server = require(__dirname + '/../help').getNewServer()

    setTimeout(done, 200)
  })

  it('should export function that allows adding components', function (done) {
    Server.addComponent.should.be.Function
    done()
  })

  it('should export function that allows getting components', function (done) {
    Server.getComponent.should.be.Function
    done()
  })

  it('should allow adding components', function (done) {
    Server.app = api()

    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var page = Page(name, schema)

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

  it('should allow getting components by key', function (done) {
    Server.app = api()

    var name = 'test'
    var schema = TestHelper.getPageSchema()
    var page = Page(name, schema)

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

  it('should recursively create components from pages', function (done) {
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

  it('should not create components from templates without a schema', function (done) {
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
