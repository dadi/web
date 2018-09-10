const fs = require('fs')
const nock = require('nock')
const request = require('supertest')
const path = require('path')
const should = require('should')
const sinon = require('sinon')

const helpers = require(`${__dirname}/../../dadi/lib/help`)

describe('Help', done => {
  describe('Timer', () => {
    it('should save and return stats', done => {
      sinon.stub(helpers.timer, 'isDebugEnabled').callsFake(() => {
        return true
      })

      const key = 'load'

      helpers.timer.start(key)
      helpers.timer.stop(key)

      const stats = helpers.timer.getStats()

      helpers.timer.isDebugEnabled.restore()

      should.exist(stats[key].time)
      done()
    })
  })

  describe('File system helpers', () => {
    const mockStatSync = path => {
      return {
        isDirectory: () => path.indexOf('.') === -1,
        isFile: () => path.indexOf('.') !== -1
      }
    }

    describe('readDirectory', () => {
      it('returns an empty array if the directory is not found, or the read operation fails, and `failIfNotFound` is falsy', done => {
        const directory = 'some/directory'
        const fsReadError = new Error('Some error')

        fsReadError.code = 'ENOENT'

        const mockReaddir = sinon.stub(fs, 'readdir').yields(fsReadError)

        helpers.readDirectory(directory, {}).then(response => {
          response.should.be.Array
          response.should.be.empty()

          done()
        })

        fs.readdir.restore()
      })

      it('throws an error if the directory is not found, or the read operation fails, and `failIfNotFound` is truthy', done => {
        const directory = 'some/directory'
        const fsReadError = new Error('Some error')

        fsReadError.code = 'ENOENT'

        const mockReaddir = sinon.stub(fs, 'readdir').yields(fsReadError)

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

      it('lists all files in a directory, returning a list of full paths', done => {
        const directory = 'some/directory'
        const files = ['directory1', 'file1.js', 'file2.png']

        const mockReaddir = sinon.stub(fs, 'readdir').yields(null, files)
        const mockStat = sinon.stub(fs, 'statSync').callsFake(mockStatSync)

        helpers.readDirectory(directory, {}).then(response => {
          response.should.deepEqual([
            path.join(directory, 'file1.js'),
            path.join(directory, 'file2.png')
          ])
          mockReaddir.getCall(0).args[0].should.eql(directory)

          done()
        })

        fs.readdir.restore()
        fs.statSync.restore()
      })

      it('lists all files in a directory, filtered by extension, returning a list of full paths', done => {
        const directory = 'some/directory'
        const files = [
          'directory1',
          'file1.js',
          'file2.png',
          'file3.js',
          'file4.txt'
        ]

        const mockReaddir = sinon.stub(fs, 'readdir').yields(null, files)
        const mockStat = sinon.stub(fs, 'statSync').callsFake(mockStatSync)

        helpers
          .readDirectory(directory, {
            extensions: ['.js', '.txt']
          })
          .then(response => {
            response.should.deepEqual([
              path.join(directory, 'file1.js'),
              path.join(directory, 'file3.js'),
              path.join(directory, 'file4.txt')
            ])

            done()
          })

        fs.readdir.restore()
        fs.statSync.restore()
      })

      it('lists all files in a directory and searches sub-directories recursively, returning a list of full paths', done => {
        const directory = 'some/directory'
        const filesLevel1 = ['directory1', 'file1.js', 'file2.png']
        const filesLevel2 = ['file3.js']

        const mockReaddir = sinon
          .stub(fs, 'readdir')
          .onCall(0)
          .yields(null, filesLevel1)
          .onCall(1)
          .yields(null, filesLevel2)

        const mockStat = sinon.stub(fs, 'statSync').callsFake(mockStatSync)

        helpers
          .readDirectory(directory, {
            extensions: ['.js'],
            recursive: true
          })
          .then(response => {
            response.should.deepEqual([
              path.join(directory, 'file1.js'),
              path.join(directory, 'directory1', 'file3.js')
            ])

            done()
          })

        fs.readdir.restore()
        fs.statSync.restore()
      })
    })

    describe('readFiles', () => {
      it('executes a callback for each file in a given list of full paths with the path as a parameter', done => {
        const files = [
          'some/directory/sub-directory1',
          'some/directory/sub-directory1/file1.js',
          'some/directory/file2.js',
          'some/directory/file3.png'
        ]
        const mockStat = sinon.stub(fs, 'statSync').callsFake(mockStatSync)
        const callbackFn = sinon.spy()

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

      it('executes a callback for each file in a given list of full paths, filtered by extension, with the path as a parameter', done => {
        const files = [
          'some/directory/sub-directory1',
          'some/directory/sub-directory1/file1.js',
          'some/directory/file2.js',
          'some/directory/file3.png'
        ]
        const mockStat = sinon.stub(fs, 'statSync').callsFake(mockStatSync)
        const callbackFn = sinon.spy()

        helpers
          .readFiles(files, {
            callback: callbackFn,
            extensions: ['.png']
          })
          .then(response => {
            callbackFn.callCount.should.eql(1)
            callbackFn.getCall(0).args[0].should.eql(files[3])

            done()
          })

        fs.statSync.restore()
      })

      it('rejects if the callback is missing or is invalid', done => {
        const files = ['some/directory/sub-directory1']

        helpers
          .readFiles(files, {
            callback: 'notAFunction'
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
