var _ = require("underscore")
var dust = require("dustjs-linkedin")
var dustHelpers = require("dustjs-helpers")
var fs = require("fs")
var path = require("path")
var pathToRegexp = require("path-to-regexp")
var should = require("should")
var sinon = require("sinon")

var api = require(__dirname + "/../../dadi/lib/api")
var page = require(__dirname + "/../../dadi/lib/page")
var Server = require(__dirname + "/../../dadi/lib")
var TestHelper = require(__dirname + "/../help")()
var view = require(__dirname + "/../../dadi/lib/view")

var config = require(path.resolve(path.join(__dirname, "/../../config")))

function cleanupPath(path, done) {
  try {
    fs.unlink(path, function() {
      done()
    })
  } catch (err) {
    console.log(err)
  }
}

describe("View", function(done) {
  beforeEach(function(done) {
    TestHelper.resetConfig().then(() => {
      done()
    })
  })

  it("should export constructor", function(done) {
    view.View.should.be.Function
    done()
  })

  it("should attach params to View", function(done) {
    var name = "test"
    var schema = TestHelper.getPageSchema()

    var req = { url: "/test" }
    var p = page(name, schema)
    var v = view(req.url, p, false)

    v.url.should.eql("/test")
    v.json.should.eql(false)
    v.page.name.should.eql("test")
    done()
  })

  it("should accept data via `setData()`", function(done) {
    var name = "test"
    var schema = TestHelper.getPageSchema()
    schema.template = "test.dust"

    var req = { url: "/test" }
    var p = page(name, schema)
    var v = view(req.url, p, false)

    var data = {
      title: "Sir",
      names: [
        {
          name: "Moe"
        },
        {
          name: "Larry"
        },
        {
          name: "Curly"
        }
      ]
    }

    v.setData(data)
    v.data.title.should.eql("Sir")
    done()
  })

  it("should return json when calling `render()`", function(done) {
    var name = "test"
    var schema = TestHelper.getPageSchema()
    schema.template = "test.dust"

    // load a template
    var template = "{#names}{title} {name}{~n}{/names}"
    var compiled = dust.compile(template, "test", true)
    dust.loadSource(compiled)

    var req = { url: "/test" }
    var p = page(name, schema)
    var v = view(req.url, p, true)

    var data = {
      title: "Sir",
      names: [{ name: "Moe" }, { name: "Larry" }, { name: "Curly" }]
    }

    v.setData(data)

    v.render(function(err, result) {
      result.should.eql(data)
      done()
    })
  })

  it("should return html when calling `render()`", function(done) {
    var name = "test"
    var schema = TestHelper.getPageSchema()
    schema.template = "test.dust"

    // load a template
    var template = "{#names}{title} {name}{~n}{/names}"
    var compiled = dust.compile(template, "test", true)
    dust.loadSource(compiled)

    var req = { url: "/test" }
    var p = page(name, schema)
    var v = view(req.url, p, false)

    var data = {
      title: "Sir",
      names: [{ name: "Moe" }, { name: "Larry" }, { name: "Curly" }]
    }

    v.setData(data)
    v.render(function(err, result) {
      var expected = "Sir Moe\nSir Larry\nSir Curly\n"
      result.should.eql(expected)
      done()
    })
  })

  // it.skip(
  //   "should throw an error if the configured helper path cannot be found",
  //   function(done) {
  //     // set a helper path in config
  //     var pathConfig = {
  //       paths: {
  //         helpers: "test/app/utils/not/here/helpers"
  //       }
  //     }

  //     TestHelper.updateConfig(pathConfig).then(() => {
  //       var name = "test"
  //       var schema = TestHelper.getPageSchema()
  //       schema.template = "test.dust"

  //       // load a template
  //       var template = "<h1>Code Helper Example</h1>"
  //       template += "{@code}"
  //       template += "alert('Hello World')"
  //       template += "{/code}"

  //       var compiled = dust.compile(template, "test", true)
  //       dust.loadSource(compiled)

  //       var req = { url: "/test" }
  //       var p = page(name, schema)

  //       should.throws(function() {
  //         view(req.url, p, false)
  //       }, Error)

  //       done()
  //     })
  //   }
  // )

  // it("should still render if custom dust helper cannot be found when calling `render()`", function(
  //   done
  // ) {
  //   var name = "test"
  //   var schema = TestHelper.getPageSchema()
  //   schema.template = "test.dust"

  //   // load a template
  //   var template = "<h1>Code Helper Example</h1>"
  //   template += "{@code}"
  //   template += "alert('Hello World')"
  //   template += "{/code}"

  //   var expected = "<h1>Code Helper Example</h1>"

  //   var compiled = dust.compile(template, "test", true)
  //   dust.loadSource(compiled)

  //   var req = { url: "/test" }
  //   var p = page(name, schema)
  //   var v = view(req.url, p, false)

  //   v.render(function(err, result) {
  //     result.should.eql(expected)
  //     done()
  //   })
  // })

  // it('should have access to custom dust helpers when calling `render()`', function (done) {
  //   // set a helper path in config
  //   var pathConfig = {
  //     paths: {
  //       helpers: 'test/app/utils/helpers'
  //     }
  //   }

  //   TestHelper.updateConfig(pathConfig).then(() => {
  //     var name = 'test'
  //     var schema = TestHelper.getPageSchema()
  //     schema.template = 'test.dust'

  //     // write a temporary helper file
  //     var helper = ''
  //     helper += "var dust = require('dustjs-linkedin')\n\n"
  //     helper += 'dust.helpers.code = function(chunk, context, bodies, params) {\n'
  //     helper += '  if (bodies.block) {\n'
  //     helper += '    return chunk.capture(bodies.block, context, function(string, chunk) {\n'
  //     helper += "      chunk.end('<pre>' + string + '</pre>')\n"
  //     helper += '    })\n'
  //     helper += '  }\n'
  //     helper += '  return chunk\n'
  //     helper += '}'

  //     var helperPath = path.join(config.get('paths.helpers'), 'code.js')
  //     fs.writeFileSync(helperPath, helper)

  //     dustLib.requireDirectory(path.resolve(config.get('paths.helpers'))).then(() => {
  //       // load a template
  //       var template = '<h1>Code Helper Example</h1>'
  //       template += '{@code}'
  //       template += "alert('Hello World')"
  //       template += '{/code}'

  //       var compiled = dust.compile(template, 'test', true)
  //       dust.loadSource(compiled, 'test')

  //       // expected rendered output
  //       var expected = "<h1>Code Helper Example</h1><pre>alert('Hello World')</pre>"

  //       var req = { url: '/test' }
  //       var p = page(name, schema)
  //       var v = view(req.url, p, false)

  //       v.render(function (err, result) {
  //         // remove temporary helper file
  //         cleanupPath(helperPath, function () {
  //           // test the result
  //           result.should.eql(expected)
  //           done()
  //         })
  //       })
  //     })
  //   })
  // })

  // it('should have access to custom dust filters when calling `render()`', function (done) {
  //   var pathConfig = {
  //     paths: {
  //       filters: 'test/app/utils/filters'
  //     }
  //   }

  //   TestHelper.updateConfig(pathConfig).then(() => {
  //     var name = 'test'
  //     var schema = TestHelper.getPageSchema()
  //     schema.template = 'test.dust'

  //   // write a temporary filter file
  //     var filter = ''
  //     filter += "var dust = require('dustjs-linkedin')\n\n"
  //     filter += 'dust.filters.unicorn = function(value) {\n'
  //     filter += " if (typeof value === 'string') {\n"
  //     filter += "    return value.replace('unicorn', 'horse')\n"
  //     filter += '  }\n'
  //     filter += '  return value\n'
  //     filter += '}\n'

  //     var filterPath = __dirname + '/../app/utils/filters/index.js'
  //     fs.writeFileSync(filterPath, filter)

  //     dustLib.requireDirectory(path.resolve(config.get('paths.filters'))).then(() => {
  //       // load a template
  //       var template = '<h1>Unicorns to Horses</h1>'
  //       template += '{myInput|unicorn}'

  //       var compiled = dust.compile(template, 'test', true)
  //       dust.loadSource(compiled)

  //       // expected rendered output
  //       var expected = '<h1>Unicorns to Horses</h1>I love horses'

  //       var req = { url: '/test' }
  //       var p = page(name, schema)
  //       var v = view(req.url, p, false)

  //       var data = {
  //         myInput: 'I love unicorns'
  //       }

  //       v.setData(data)

  //       v.render(function (err, result) {
  //         // remove temporary helper file
  //         cleanupPath(filterPath, function () {
  //           // test the result
  //           result.should.eql(expected)
  //           done()
  //         })
  //       })
  //     })
  //   })
  // })
})
