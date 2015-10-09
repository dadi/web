var path = require('path');
var should = require('should');
var sinon = require('sinon');
var moment = require('moment');
var log = require(__dirname + '/../../bantam/lib/log');
var help = require(__dirname + '/help');
var config = require(path.resolve(__dirname + '/../../config.js'));

describe('Logger', function (done) {

  it('should export a `format()` function', function (done) {
    log.format.should.be.Function;
    done();
  });

  it('should export a `debug()` function', function (done) {
    log.debug.should.be.Function;
    done();
  });

  it('should export a `stage()` function', function (done) {
    log.stage.should.be.Function;
    done();
  });

  it('should export a `prod()` function', function (done) {
    log.prod.should.be.Function;
    done();
  });

  it('should format the log message using config settings', function (done) {
    var message = 'Hello';
    config.set('logging.dateFormat', 'YYYY-MM-DD');
    config.set('logging.level', 'INFO');
    log.format({message:message}).should.eql('INFO - ' + moment().format('YYYY-MM-DD') + ' - Hello\n');
    done();
  });

  it('should log debug message if logLevel is = DEBUG', function (done) {

    config.set('logging.level', 'DEBUG');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.debug({message:message}, function() {});
    method.called.should.be.true;

    log._log.restore();

    done();
  });

  it('should log stage message if logLevel is = DEBUG', function (done) {

    config.set('logging.level', 'DEBUG');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.stage({message:message}, function() {});
    method.called.should.be.true;

    log._log.restore();

    done();
  });

  it('should log stage message if logLevel is = STAGE', function (done) {

    config.set('logging.level', 'STAGE');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.stage({message:message}, function() {});
    method.called.should.be.true;

    log._log.restore();

    done();
  });

  it('should log prod message if logLevel is = DEBUG', function (done) {

    config.set('logging.level', 'DEBUG');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.prod({message:message}, function() {});
    method.called.should.be.true;

    log._log.restore();

    done();
  });

  it('should log prod message if logLevel is = STAGE', function (done) {

    config.set('logging.level', 'STAGE');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.prod({message:message}, function() {});
    method.called.should.be.true;

    log._log.restore();

    done();
  });

  it('should log prod message if logLevel is = PROD', function (done) {

    config.set('logging.level', 'PROD');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.prod({message:message}, function() {});
    method.called.should.be.true;

    log._log.restore();

    done();
  });

  it('should not log debug message if logLevel > DEBUG', function (done) {

    config.set('logging.level', 'STAGE');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.debug({message:message}, function() {});
    method.called.should.be.false;

    log._log.restore();

    done();
  });

  it('should not log stage message if logLevel is > STAGE', function (done) {

    config.set('logging.level', 'PROD');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.stage({message:message}, function() {});
    method.called.should.be.false;

    log._log.restore();

    done();
  });

  it('should not log debug message if logLevel is not one of DEBUG STAGE PROD', function (done) {

    config.set('logging.level', 'INFO');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.debug({message:message}, function() {});
    method.called.should.be.false;

    log._log.restore();

    done();
  });

  it('should not log stage message if logLevel is not one of DEBUG STAGE PROD', function (done) {

    config.set('logging.level', 'INFO');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.stage({message:message}, function() {});
    method.called.should.be.false;

    log._log.restore();

    done();
  }); 

  it('should not log prod message if logLevel is not one of DEBUG STAGE PROD', function (done) {

    config.set('logging.level', 'INFO');
    var message = 'Hello';
    
    var method = sinon.spy(log, '_log');
    
    log.prod({message:message}, function() {});
    method.called.should.be.false;

    log._log.restore();

    done();
  });
});
