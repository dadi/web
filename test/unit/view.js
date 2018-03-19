var webEngine = require("web-es6-templates")
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
    var v = view(req.url, p)

    v.url.should.eql("/test")
    v.page.name.should.eql("test")
    done()
  })

  it("should accept data via `setData()`", function(done) {
    var name = "test"
    var schema = TestHelper.getPageSchema()
    schema.template = "test.js"

    var req = { url: "/test" }
    var p = page(name, schema)
    var v = view(req.url, p)

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

  it("should return html when calling `render()`", function(done) {
    var name = "test"
    var schema = TestHelper.getPageSchema()
    schema.template = "test.js"

    var req = { url: "/test" }
    var p = page(name, schema)
    var v = view(req.url, p)

    var data = {
      names: [{ title: "Sir", name: "Moe" }, { title: "Sir", name: "Larry" }, { title: "Sir", name: "Curly" }]
    }

    v.setData(data)
    v.render(function(err, result) {
      if (err) return done(err)
      var expected = "Sir Moe\nSir Larry\nSir Curly"
      result.should.eql(expected)
      done()
    })
  })

  it("should postProcess the HTML output of a page when set at page level", function(done) {
    var name = "test"
    var schema = TestHelper.getPageSchema()
    schema.template = "test.js"
    schema.settings.postProcessors = ["replace-sir"]

    var req = { url: "/test" }
    var p = page(name, schema)
    var v = view(req.url, p)

    var data = {
      names: [{ title: "Sir", name: "Moe" }, { title: "Sir", name: "Larry" }, { title: "Sir", name: "Curly" }]
    }

    v.setData(data)

    v.render(function(err, result) {
      if (err) return done(err)
      var expected = "Madam Moe\nMadam Larry\nMadam Curly"
      result.should.eql(expected)
      done()
    })
  })

  it("should postProcess the HTML output of a page when set at global level", function(done) {
    var name = "test"
    var schema = TestHelper.getPageSchema()
    schema.template = "test.js"

    var req = { url: "/test" }
    var p = page(name, schema)
    var v = view(req.url, p)

    var data = {
      names: [{ title: "Sir", name: "Moe" }, { title: "Sir", name: "Larry" }, { title: "Sir", name: "Curly" }]
    }

    TestHelper.updateConfig({
      globalPostProcessors: ["replace-sir"]
    }).then(() => {
        v.setData(data)

        v.render(function(err, result) {
          if (err) return done(err)
          var expected = "Madam Moe\nMadam Larry\nMadam Curly"
          result.should.eql(expected)
          done()
        })
    })
  })
})
