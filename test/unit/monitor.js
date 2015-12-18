var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var should = require('should');
var _ = require('underscore');
var monitor = require(__dirname + '/../../dadi/lib/monitor');
var help = require(__dirname + '/../help');

describe('Monitor', function (done) {

  after(function(done) {
      try {
        fs.unlinkSync(path.join(__dirname, 'test.txt'));
      }
      catch (err) {

      }
      done();
  })

  it('should export constructor', function (done) {
    monitor.Monitor.should.be.a.Function;
    done();
  });

  it('should export function that returns an instance', function (done) {
    monitor.should.be.a.Function;
    var p = __dirname;
    monitor(p).should.be.an.instanceOf(monitor.Monitor);
    done();
  });

  it('should fire `change` event when watched path changes', function (done) {
    var p = path.join(__dirname, 'test.txt');

    fs.writeFile(p, 'Hello World', function (err) {

      var m = monitor(p);
      m.on('change', function (fileName) {
        fileName.should.eql('test.txt');
      });

      m.close();

      done();
    });

  });
});
