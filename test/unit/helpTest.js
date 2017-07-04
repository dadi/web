var _ = require("underscore")
var fs = require("fs")
var nock = require("nock")
var request = require("supertest")
var path = require("path")
var should = require("should")
var sinon = require("sinon")

var helpers = require(__dirname + "/../../dadi/lib/help")

describe("Help", done => {
  describe("HtmlEncode", () => {
    it("should HTML encode the specified string", done => {
      helpers.htmlEncode("\u00A0").should.eql("&#160;")
      done()
    })
  })

  describe("Timer", () => {
    it("should save and return stats", done => {
      sinon.stub(helpers.timer, "isDebugEnabled").callsFake(() => {
        return true
      })

      var key = "load"

      helpers.timer.start(key)
      helpers.timer.stop(key)

      var stats = helpers.timer.getStats()

      helpers.timer.isDebugEnabled.restore()

      stats[0].key.should.eql(key)
      should.exist(stats[0].value)
      done()
    })
  })

  describe("File system helpers", () => {
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

        helpers.readDirectory(directory, {}).then(response => {
          response.should.be.Array
          response.should.be.empty()

          done()
        })

        fs.readdir.restore()
      })

      it("throws an error if the directory is not found, or the read operation fails, and `failIfNotFound` is truthy", done => {
        var directory = "some/directory"
        var fsReadError = new Error("Some error")

        fsReadError.code = "ENOENT"

        var mockReaddir = sinon.stub(fs, "readdir").yields(fsReadError)

        helpers
          .readDirectory(directory, {
            failIfNotFound: true
          })
          .catch(err => {
            err.message.should.eql(fsReadError.message)
            err.code.should.eql(fsReadError.code)

            done()
          })

        fs.readdir.restore()
      })

      it("lists all files in a directory, returning a list of full paths", done => {
        var directory = "some/directory"
        var files = ["directory1", "file1.js", "file2.png"]

        var mockReaddir = sinon.stub(fs, "readdir").yields(null, files)
        var mockStat = sinon.stub(fs, "statSync").callsFake(mockStatSync)

        helpers.readDirectory(directory, {}).then(response => {
          response.should.deepEqual([
            path.join(directory, "file1.js"),
            path.join(directory, "file2.png")
          ])
          mockReaddir.getCall(0).args[0].should.eql(directory)

          done()
        })

        fs.readdir.restore()
        fs.statSync.restore()
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
        var mockStat = sinon.stub(fs, "statSync").callsFake(mockStatSync)

        helpers
          .readDirectory(directory, {
            extensions: [".js", ".txt"]
          })
          .then(response => {
            response.should.deepEqual([
              path.join(directory, "file1.js"),
              path.join(directory, "file3.js"),
              path.join(directory, "file4.txt")
            ])

            done()
          })

        fs.readdir.restore()
        fs.statSync.restore()
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

        var mockStat = sinon.stub(fs, "statSync").callsFake(mockStatSync)

        helpers
          .readDirectory(directory, {
            extensions: [".js"],
            recursive: true
          })
          .then(response => {
            response.should.deepEqual([
              path.join(directory, "file1.js"),
              path.join(directory, "directory1", "file3.js")
            ])

            done()
          })

        fs.readdir.restore()
        fs.statSync.restore()
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
        var mockStat = sinon.stub(fs, "statSync").callsFake(mockStatSync)
        var callbackFn = sinon.spy()

        helpers
          .readFiles(files, {
            callback: callbackFn
          })
          .then(response => {
            callbackFn.callCount.should.eql(3)
            callbackFn.getCall(0).args[0].should.eql(files[1])
            callbackFn.getCall(1).args[0].should.eql(files[2])
            callbackFn.getCall(2).args[0].should.eql(files[3])

            done()
          })

        fs.statSync.restore()
      })

      it("executes a callback for each file in a given list of full paths, filtered by extension, with the path as a parameter", done => {
        var files = [
          "some/directory/sub-directory1",
          "some/directory/sub-directory1/file1.js",
          "some/directory/file2.js",
          "some/directory/file3.png"
        ]
        var mockStat = sinon.stub(fs, "statSync").callsFake(mockStatSync)
        var callbackFn = sinon.spy()

        helpers
          .readFiles(files, {
            callback: callbackFn,
            extensions: [".png"]
          })
          .then(response => {
            callbackFn.callCount.should.eql(1)
            callbackFn.getCall(0).args[0].should.eql(files[3])

            done()
          })

        fs.statSync.restore()
      })

      it("rejects if the callback is missing or is invalid", done => {
        var files = ["some/directory/sub-directory1"]

        helpers
          .readFiles(files, {
            callback: "notAFunction"
          })
          .catch(error1 => {
            return helpers.readFiles(files, {}).catch(err => {
              done()
            })
          })
      })
    })
  })
})
