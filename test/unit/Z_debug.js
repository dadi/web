var fs = require('fs')
var nock = require('nock')
var path = require('path')
var should = require('should')
var request = require('supertest')
var cheerio = require('cheerio')
var sinon = require("sinon")

var api = require(__dirname + '/../../dadi/lib/api')
var Controller = require(__dirname + '/../../dadi/lib/controller')
var Datasource = require(__dirname + '/../../dadi/lib/datasource')
var help = require(__dirname + '/../../dadi/lib/help')
var Page = require(__dirname + '/../../dadi/lib/page')
var Server = require(__dirname + '/../../dadi/lib')
var TestHelper = require(__dirname + '/../help')()

var config = require(path.resolve(path.join(__dirname, '/../../config')))

describe("Debug view", function(done) {
  beforeEach(function(done) {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(function(done) {
    
      TestHelper.resetConfig().then(() => {
        TestHelper.stopServer(() => {
          setTimeout(function(){
        //TestHelper.disableApiConfig().then(() => {
          done()
        //})
      },200)
      })
    })
  })

  it('should enable the debug view if specified in the config', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=json')
          .end((err, res) => {
            res.body.should.not.eql({})
            res.body.page.name.should.eql('page1')
            done()
          })
      })
    })
  })

  it('should disable the debug view if specified in the config', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: false
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=json')
          .end((err, res) => {
            res.body.should.eql({})
            done()
          })
      })
    })
  })

  it('should return page data, template and output by default', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug')
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#data').length.should.be.above(0)
            $('#template').length.should.be.above(0)
            $('#result').length.should.be.above(0)
      
            done()
          })
      })
    })
  })

  it('should return rendered page output if ?debug=result', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=result')
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#unprocessed').length.should.be.above(0)
      
            done()
          })
      })
    })
  })

  it('should return page data if ?debug=data', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=data')
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#template').length.should.eql(0)
            
            $('.view > script').html().toString().trim().should.startWith("var data = new JSONEditor(document.getElementById(\'data\'), {mode: \'view\'}, {\n  \"query\": {}")
      
            done()
          })
      })
    })
  })

  it('should return page info if ?debug=page', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=page')
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#template').length.should.eql(0)

            $('.view > script').html().toString().trim().should.startWith("var data = new JSONEditor(document.getElementById(\'data\'), {mode: \'view\'}, {\n  \"name\": \"page1\"")
      
            done()
          })
      })
    })
  })

  it('should return route info if ?debug=route', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=route')
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#template').length.should.eql(0)

            $('.view').html().toString().trim().should.startWith('<input type="text" id="inputPath" placeholder="/path/value/" value="/test">')
      
            done()
          })
      })
    })
  })

  it('should return headers if ?debug=headers', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=headers')
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#template').length.should.eql(0)

            $('.view > script').html().toString().trim().should.startWith("var data = new JSONEditor(document.getElementById(\'data\'), {mode: \'view\'}, {\n  \"request\"")
      
            done()
          })
      })
    })
  })

  it('should return stats if ?debug=stats', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=stats')
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#template').length.should.eql(0)

            $('.view > script').html().toString().trim().should.startWith("var data = new JSONEditor(document.getElementById(\'data\'), {mode: \'view\'}, {\n  \"get\"")
      
            done()
          })
      })
    })
  })

  it('should return stats if ?debug=ds', function (
    done
  ) {
    var pages = TestHelper.setUpPages()

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=ds')
          .end((err, res) => {
            const $ = cheerio.load(res.text)

            $('#template').length.should.eql(0)

            $('.view > script').html().toString().trim().should.startWith("var data = new JSONEditor(document.getElementById(\'data\'), {mode: \'view\'}, {}")
      
            done()
          })
      })
    })
  })

  it('should return both rendered page outputs if ?debug=result and a post-processor used', function (
    done
  ) {
    var pages = TestHelper.setUpPages()
    pages[0].template = "test.js"
    pages[0].postProcessors = ["replace-sir"]

    // provide API response
    var results = {
      debugView: 'result',
      names: [{ title: "Sir", name: "Moe" }, { title: "Sir", name: "Larry" }, { title: "Sir", name: "Curly" }]
    }
    var fake = sinon
      .stub(Controller.Controller.prototype, "loadData")
      .yields(null, results)

    TestHelper.updateConfig({
      allowDebugView: true
    }).then(() => {
      TestHelper.startServer(pages).then(() => {
        var connectionString = `http://${config.get('server.host')}:${config.get('server.port')}`
        var client = request(connectionString)

        client
          .get(pages[0].routes[0].path + '?debug=result')
          .end((err, res) => {
            //console.log(res.text)
            const $ = cheerio.load(res.text)
            
            $('#unprocessed').length.should.be.above(0)
            $('#processed').length.should.be.above(0)

            fake.reset()
      
            done()
          })
      })
    })
  })
})