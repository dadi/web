var _ = require("underscore")
var fs = require("fs")
var nock = require("nock")
var request = require("supertest")
var path = require("path")
var should = require("should")
var sinon = require("sinon")

var api = require(__dirname + "/../../dadi/lib/api")
var Server = require(__dirname + "/../../dadi/lib")
var Page = require(__dirname + "/../../dadi/lib/page")
var Controller = require(__dirname + "/../../dadi/lib/controller")
var TestHelper = require(__dirname + "/../help")()
var config = require(__dirname + "/../../config")
var help = require(__dirname + "/../../dadi/lib/help")
var remoteProvider = require(__dirname + "/../../dadi/lib/providers/remote")
var apiProvider = require(__dirname + "/../../dadi/lib/providers/dadiapi")
var Helper = require(__dirname + "/../../dadi/lib/help")

var connectionString =
  "http://" + config.get("server.host") + ":" + config.get("server.port")

describe("Help", done => {
  beforeEach(done => {
    TestHelper.resetConfig().then(() => {
      TestHelper.disableApiConfig().then(() => {
        done()
      })
    })
  })

  afterEach(done => {
    TestHelper.stopServer(done)
  })

  describe("HtmlEncode", () => {
    it("should HTML encode the specified string", done => {
      Helper.htmlEncode("\u00A0").should.eql("&#160;")
      done()
    })
  })

  describe("Timer", () => {
    it("should save and return stats", done => {
      sinon.stub(Helper.timer, "isDebugEnabled", () => {
        return true
      })

      var key = "load"

      Helper.timer.start(key)
      Helper.timer.stop(key)

      var stats = Helper.timer.getStats()

      Helper.timer.isDebugEnabled.restore()

      stats[0].key.should.eql(key)
      should.exist(stats[0].value)
      done()
    })
  })

  describe.only("File system helpers", () => {
    var mockStatSync = path => {
      return {
        isDirectory: () => path.indexOf(".") === -1,
        isFile: () => path.indexOf(".") !== -1
      }
    }

    describe("readDirectory", () => {
      it("returns an empty array if the directory is not found, or the read operation fails, and `failIfNotFound` is falsy", done => {
        var directory = "some/directory"
        var fsReadError = new Error("Some error")

        fsReadError.code = "ENOENT"

        var mockReaddir = sinon.stub(fs, "readdir").yields(fsReadError)

        Helper.readDirectory(directory, {}).then(response => {
          response.should.be.Array
          response.should.be.empty()

          done()
        })

        mockReaddir.restore()
      })

      it("throws an error if the directory is not found, or the read operation fails, and `failIfNotFound` is truthy", done => {
        var directory = "some/directory"
        var fsReadError = new Error("Some error")

        fsReadError.code = "ENOENT"

        var mockReaddir = sinon.stub(fs, "readdir").yields(fsReadError)

        Helper.readDirectory(directory, {
          failIfNotFound: true
        }).catch(err => {
          err.message.should.eql(fsReadError.message)
          err.code.should.eql(fsReadError.code)

          done()
        })

        mockReaddir.restore()
      })

      it("lists all files in a directory, returning a list of full paths", done => {
        var directory = "some/directory"
        var files = ["directory1", "file1.js", "file2.png"]

        var mockReaddir = sinon.stub(fs, "readdir").yields(null, files)
        var mockStat = sinon.stub(fs, "statSync", mockStatSync)

        Helper.readDirectory(directory, {}).then(response => {
          response.should.deepEqual([
            path.join(directory, "file1.js"),
            path.join(directory, "file2.png")
          ])
          mockReaddir.getCall(0).args[0].should.eql(directory)

          done()
        })

        mockReaddir.restore()
        mockStat.restore()
      })

      it("lists all files in a directory, filtered by extension, returning a list of full paths", done => {
        var directory = "some/directory"
        var files = [
          "directory1",
          "file1.js",
          "file2.png",
          "file3.js",
          "file4.txt"
        ]

        var mockReaddir = sinon.stub(fs, "readdir").yields(null, files)
        var mockStat = sinon.stub(fs, "statSync", mockStatSync)

        Helper.readDirectory(directory, {
          extensions: [".js", ".txt"]
        }).then(response => {
          response.should.deepEqual([
            path.join(directory, "file1.js"),
            path.join(directory, "file3.js"),
            path.join(directory, "file4.txt")
          ])

          done()
        })

        mockReaddir.restore()
        mockStat.restore()
      })

      it("lists all files in a directory and searches sub-directories recursively, returning a list of full paths", done => {
        var directory = "some/directory"
        var filesLevel1 = ["directory1", "file1.js", "file2.png"]
        var filesLevel2 = ["file3.js"]

        var mockReaddir = sinon
          .stub(fs, "readdir")
          .onCall(0)
          .yields(null, filesLevel1)
          .onCall(1)
          .yields(null, filesLevel2)
        var mockStat = sinon.stub(fs, "statSync", mockStatSync)

        Helper.readDirectory(directory, {
          extensions: [".js"],
          recursive: true
        }).then(response => {
          response.should.deepEqual([
            path.join(directory, "file1.js"),
            path.join(directory, "directory1", "file3.js")
          ])

          done()
        })

        mockStat.restore()
      })
    })

    describe("readFiles", () => {
      it("executes a callback for each file in a given list of full paths with the path as a parameter", done => {
        var files = [
          "some/directory/sub-directory1",
          "some/directory/sub-directory1/file1.js",
          "some/directory/file2.js",
          "some/directory/file3.png"
        ]
        var mockStat = sinon.stub(fs, "statSync", mockStatSync)
        var callbackFn = sinon.spy()

        Helper.readFiles(files, {
          callback: callbackFn
        }).then(response => {
          callbackFn.callCount.should.eql(3)
          callbackFn.getCall(0).args[0].should.eql(files[1])
          callbackFn.getCall(1).args[0].should.eql(files[2])
          callbackFn.getCall(2).args[0].should.eql(files[3])

          done()
        })

        mockStat.restore()
      })

      it("executes a callback for each file in a given list of full paths, filtered by extension, with the path as a parameter", done => {
        var files = [
          "some/directory/sub-directory1",
          "some/directory/sub-directory1/file1.js",
          "some/directory/file2.js",
          "some/directory/file3.png"
        ]
        var mockStat = sinon.stub(fs, "statSync", mockStatSync)
        var callbackFn = sinon.spy()

        Helper.readFiles(files, {
          callback: callbackFn,
          extensions: [".png"]
        }).then(response => {
          callbackFn.callCount.should.eql(1)
          callbackFn.getCall(0).args[0].should.eql(files[3])

          done()
        })

        mockStat.restore()
      })

      it("rejects if the callback is missing or is invalid", done => {
        var files = ["some/directory/sub-directory1"]

        Helper.readFiles(files, {
          callback: "notAFunction"
        }).catch(error1 => {
          return Helper.readFiles(files, {}).catch(err => {
            done()
          })
        })
      })
    })
  })
})
