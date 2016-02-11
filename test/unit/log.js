var path = require('path');
var should = require('should');
var sinon = require('sinon');
var log = require(__dirname + '/../../dadi/lib/log');
var help = require(__dirname + '/../help');
var cache = require(__dirname + '/../../dadi/lib/cache');
var Server = require(__dirname + '/../../dadi/lib');
var config = require(__dirname + '/../../config');
var api = require(__dirname + '/../../dadi/lib/api');

describe('Logger', function (done) {

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

  it('should not log when config level doesn\'t allow', function (done) {

    config.set('logging.level', 'info');

    var message = 'Hello';

    var logger = log.get();
    var method = sinon.spy(logger, 'debug');

    log.debug(message);
    logger.debug.restore();

    method.called.should.eql(false);

    done();
  });

  it('should use bunyan log.debug when log.debug is called', function (done) {

    config.set('logging.level', 'debug');

    var message = 'Hello';

    var logger = log.get();
    var method = sinon.spy(logger, 'debug');

    log.debug(message);
    logger.debug.restore();

    method.called.should.eql(false);

    done();
  });

  it('should use bunyan log.info when log.info is called', function (done) {

    config.set('logging.level', 'info');

    var message = 'Hello';

    var logger = log.get();
    var method = sinon.spy(logger, 'info');

    log.info(message);
    logger.info.restore();

    method.called.should.eql(true);

    done();
  });

  it('should write to the access log if enabled', function (done) {

    var message = 'Hello';

    var logger = log.getAccessLog();
    var method = sinon.spy(logger, 'info');

    log.access(message);
    logger.info.restore();

    method.called.should.eql(true);

    done();
  });

  it('should write to the access log if enabled', function (done) {

    config.set('logging.level', 'debug');

    var message = 'Hello';

    var logger = log.getAccessLog();
    var method = sinon.spy(logger, 'info');

    log.access(message);
    logger.info.restore();

    method.called.should.eql(true);

    done();
  });

  it('should write to the access log if enabled', function (done) {

    config.set('logging.level', 'debug');

    var message = 'Hello';

    var logger = log.getAccessLog();
    var method = sinon.spy(logger, 'info');

    log.access(message);
    logger.info.restore();

    method.called.should.eql(true);

    done();
  });

  it('should write to the access log if enabled', function (done) {

    config.set('logging.level', 'debug');

    var message = 'Hello';

    var logger = log.getAccessLog();
    var method = sinon.spy(logger, 'info');

    log.access(message);
    logger.info.restore();

    method.called.should.eql(true);

    done();
  });

  it('should write to the access log if enabled', function (done) {

    config.set('logging.level', 'debug');

    var message = 'Hello';

    var logger = log.getAccessLog();
    var method = sinon.spy(logger, 'info');

    log.access(message);
    logger.info.restore();

    method.called.should.eql(true);

    done();
  });

  it('should use bunyan log.warn when log.stage is called', function (done) {

    var message = 'Hello';

    var logger = log.get();
    var method = sinon.spy(logger, 'warn');

    log.stage(message);
    logger.warn.restore();

    method.called.should.eql(true);

    done();
  });

  it('should use bunyan log.warn when log.prod is called', function (done) {

    var message = 'Hello';

    var logger = log.get();
    var method = sinon.spy(logger, 'warn');

    log.prod(message);
    logger.warn.restore();

    method.called.should.eql(true);

    done();
  });

  it('should not log when enabled = false', function (done) {

    var message = 'Hello';

    var logger = log.get();
    var method = sinon.spy(logger, 'info');

    config.set('logging.enabled', false);

    log.info(message);

    config.set('logging.enabled', true);
    logger.info.restore();

    method.called.should.eql(false);

    done();
  });

  describe('module logging', function(done) {

    beforeEach(function(done) {
      done();
    })

    it('cache module should not log when enabled = false', function (done) {

      config.set('logging.enabled', false);

      var server = sinon.mock(Server);
      server.object.app = api();

      var logger = log.get();
      var method = sinon.spy(logger, 'info');
      cache(server.object).init();

      config.set('logging.enabled', true);
      logger.info.restore();
      cache.reset();

      method.called.should.eql(false);
      done();
    });

    it('cache module should not log when config level doesn\'t allow', function (done) {

      config.set('logging.enabled', true);
      config.set('logging.level', 'warn');

      var server = sinon.mock(Server);
      server.object.app = api();

      var logger = log.get();
      var method = sinon.spy(logger, 'info');
      cache(server.object).init();

      config.set('logging.level', 'info');
      logger.info.restore();
      cache.reset();

      method.called.should.eql(false);

      done();
    })

    it('cache module should log when config level allows', function (done) {

      config.set('logging.enabled', true);
      config.set('logging.level', 'debug');

      var server = sinon.mock(Server);
      server.object.app = api();

      var logger = log.get();
      var method = sinon.spy(logger, 'info');
      cache(server.object).init();

      config.set('logging.level', 'info');
      logger.info.restore();
      cache.reset();

      method.called.should.eql(true);

      done();
    })
  })
})
