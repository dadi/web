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

  it("should postProcess the HTML output of a page when set at page level", function(
    done
  ) {
    var name = "test"
    var schema = TestHelper.getPageSchema()
    schema.template = "test.dust"
    schema.settings.postProcessors = ["replace-h1"]

    // load a template
    var template = "<h1>This is testing postProcessors</h1>"
    var expected = "<h2>This is testing postProcessors</h2>"

    var compiled = dust.compile(template, "test", true)
    dust.loadSource(compiled)

    var req = { url: "/test" }
    var p = page(name, schema)
    var v = view(req.url, p, false)

    v.render(function(err, result) {
      result.should.eql(expected)
      done()
    })
  })
})
