var assert = require('assert')
var fs = require('fs')
var nock = require('nock')
var path = require('path')
var uuid = require('uuid')

var api = require(__dirname + '/../dadi/lib/api')
var Controller = require(__dirname + '/../dadi/lib/controller')
var Page = require(__dirname + '/../dadi/lib/page')
var Server = require(__dirname + '/../dadi/lib')

var serverOptions = {
  engines: [require('web-es6-templates')]
}

var Server = require(__dirname + '/../dadi/lib')(serverOptions)

var config
var testConfigString
var configKey = path.resolve(path.join(__dirname, '/../config'))

/**
 * Return the Set-Cookie header
 */
function cookie (res) {
  var setCookie = res.headers['set-cookie']
  return (setCookie && setCookie[0]) || undefined
}

var TestHelper = function () {
  config = require(configKey)
  this.originalConfigString = fs
    .readFileSync(config.configPath() + '.sample')
    .toString()
  // console.log(this)
  config.loadFile(path.resolve(config.configPath()))
}

TestHelper.prototype.setupApiIntercepts = function () {
  var host = 'http://' + config.get('api').host + ':' + config.get('api').port

  var apiTestScope = nock(host)
    .get('/')
    .reply(401)

  var authScope1 = nock(host)
    .post('/token')
    .times(10)
    .reply(200, { accessToken: uuid.v4() })
}

TestHelper.prototype.disableApiConfig = function () {
  return new Promise((resolve, reject) => {
    var apiConfig = {
      api: {
        enabled: false
      }
    }

    this.updateConfig(apiConfig).then(() => {
      return resolve('')
    })
  })
}

TestHelper.prototype.enableApiConfig = function () {
  return new Promise((resolve, reject) => {
    var apiConfig = {
      api: {
        enabled: true,
        host: '127.0.0.1',
        port: 3000
      }
    }

    this.updateConfig(apiConfig).then(() => {
      return resolve('')
    })
  })
}

TestHelper.prototype.getConfig = function () {
  return new Promise((resolve, reject) => {
    var originalConfig = JSON.parse(this.originalConfigString)
    return resolve(Object.assign({}, originalConfig))
  })
}

TestHelper.prototype.updateConfig = function (configBlock) {
  return new Promise((resolve, reject) => {
    var originalConfig = JSON.parse(this.originalConfigString)
    var newConfig = Object.assign(originalConfig, configBlock)

    fs.writeFileSync(config.configPath(), JSON.stringify(newConfig, null, 2))
    config.loadFile(path.resolve(config.configPath()))
    delete require.cache[configKey]
    return resolve(config)
  })
}

TestHelper.prototype.resetConfig = function () {
  return new Promise((resolve, reject) => {
    fs.writeFileSync(config.configPath(), this.originalConfigString)
    config.loadFile(path.resolve(config.configPath()))
    delete require.cache[configKey]
    return resolve(config)
  })
}

TestHelper.prototype.extractCookieValue = function (res, cookieName) {
  var cookies = res.headers['set-cookie']
  var cookie = cookies.find(cookie => {
    return cookie.startsWith(cookieName + '=')
  })
  var data = cookie.split(';')[0]
  var value = data.split('=')[1]
  return value
}

/**
 * Tests that the response has the Set-Cookie header equal to "name"
 */
TestHelper.prototype.shouldSetCookie = function (name) {
  return function (res) {
    // console.log("***")
    // console.log("headers:", res.headers)
    // console.log("***")
    var header = cookie(res)
    assert.ok(header, 'should have a cookie header')
    assert.equal(header.split('=')[0], name, 'should set cookie ' + name)
  }
}

/**
 * Test that the response does not have the specified header
 */
TestHelper.prototype.shouldNotHaveHeader = function (header) {
  return function (res) {
    assert.ok(
      !(header.toLowerCase() in res.headers),
      'should not have ' + header + ' header'
    )
  }
}

TestHelper.prototype.setUpPages = function () {
  // create page 1
  var page1 = Page('page1', this.getPageSchema())
  page1.template = 'test.js'
  page1.routes[0].path = '/test'
  page1.datasources = []
  page1.events = []
  page1.settings.cache = false

  var pages = []
  pages.push(page1)

  return pages
}

TestHelper.prototype.setUp404Page = function () {
  var page = Page('404', this.getPageSchema())
  page.name = '404'
  page.template = '404.js'
  page.routes[0].path = '/404'
  page.datasources = []
  page.events = []
  page.settings.cache = false

  var pages = []
  pages.push(page)

  return pages
}

TestHelper.prototype.newPage = function (
  name,
  path,
  template,
  datasources,
  events
) {
  var page = Page(name, this.getPageSchema())
  page.datasources = datasources
  page.template = template
  page.routes[0].path = path
  page.events = events

  var pages = []
  pages.push(page)

  return pages
}

TestHelper.prototype.startServer = function (pages) {
  return new Promise((resolve, reject) => {
    if (pages !== null && !Array.isArray(pages)) {
      pages = [pages]
    }

    var options = this.getPathOptions()

    Server.app = api()
    Server.components = {}

    if (pages === null) {
      pages = this.setUpPages()
    }

    Server.start(() => {
      var idx = 0
      // setTimeout(() => {
      pages.forEach(page => {
        var controller = Controller(page, options)

        Server.addComponent(
          {
            host: '',
            key: page.key,
            routes: page.routes,
            component: controller
          },
          false
        )

        if (++idx === pages.length) {
          return resolve(Server.compile(options).then(() => Server))
        }
      })
      // }, 100)
    })
  })
}

TestHelper.prototype.stopServer = function (done) {
  if (!Server.readyState) return done()
  Server.stop(function () {
    // setTimeout(function() {
    done()
    // }, 100)
  })
}

TestHelper.prototype.getPageSchema = function () {
  return {
    page: {
      name: 'Car Reviews',
      description: 'A collection of car reviews.',
      language: 'en'
    },
    settings: {
      cache: true
    },
    routes: [
      {
        path: '/car-reviews/:make/:model'
      }
    ],
    contentType: 'text/html',
    template: 'car-reviews.js',
    datasources: ['car_makes'],
    events: ['car-reviews']
  }
}

/**
 * Return the default set of paths, where events and datasources are located
 */
TestHelper.prototype.getPathOptions = function () {
  return {
    datasourcePath: __dirname + '/../test/app/datasources',
    pagePath: __dirname + '/../test/app/pages',
    partialPath: __dirname + '/../test/app/partials',
    eventPath: __dirname + '/../test/app/events',
    routesPath: __dirname + '/../test/app/routes',
    publicPath: __dirname + '/../test/app/public'
  }
}

TestHelper.prototype.getSchemaFromFile = function (
  path,
  name,
  propertyToDelete
) {
  var filepath = path + '/' + name + '.json'
  var schema
  if (fs.existsSync(filepath)) {
    schema = JSON.parse(fs.readFileSync(filepath, { encoding: 'utf-8' }))
    if (typeof propertyToDelete !== 'undefined') {
      delete schema.datasource[propertyToDelete]
    }
    return schema
  }
}

TestHelper.prototype.clearCache = function () {
  var deleteFolderRecursive = function (filepath) {
    if (fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory()) {
      fs.readdirSync(filepath).forEach(function (file, index) {
        var curPath = filepath + '/' + file
        if (fs.lstatSync(curPath).isDirectory()) {
          // recurse
          deleteFolderRecursive(curPath)
        } else {
          // delete file
          fs.unlinkSync(path.resolve(curPath))
        }
      })
      fs.rmdirSync(filepath)
    } else if (fs.existsSync(filepath) && fs.lstatSync(filepath).isFile()) {
      fs.unlinkSync(filepath)
    }
  }

  // for each directory in the cache folder, remove all files then
  // delete the folder
  var cachePath = path.resolve(config.get('caching.directory.path'))
  fs.stat(cachePath, function (err, stats) {
    if (err) return
    fs.readdirSync(cachePath).forEach(function (dirname) {
      deleteFolderRecursive(path.join(cachePath, dirname))
    })
  })
}

var instance
module.exports = function () {
  if (!instance) {
    instance = new TestHelper()
  }

  return instance
}

module.exports.TestHelper = TestHelper
module.exports.Server = Server
module.exports.getNewServer = options => {
  options = options || serverOptions

  return require(__dirname + '/../dadi/lib')(options)
}
