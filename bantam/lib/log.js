var bunyan = require('bunyan');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var util = require('util');
var _ = require('underscore');

var config = require(path.resolve(__dirname + '/../../config'));
var options = config.get('logging');
var enabled = options.enabled;
var logPath = path.resolve(options.path + '/' + options.filename + '.' + config.get('env') + '.' + options.extension);
var accessLogPath = path.resolve(options.path + '/' + options.filename + '.access.' + options.extension);

// create log directory if it doesn't exist
mkdirp(path.resolve(options.path), {}, function(err, made) {
    if (err) {
        module.exports.error(err);
    }

    if (made) {
        module.exports.info('Log directory created at ' + made);
    }
});

var log = bunyan.createLogger({
    name: 'rosecomb',
    serializers: bunyan.stdSerializers,
    streams: [
      //{ level: 'debug', stream: process.stdout },
      { level: 'info', path: logPath },
      { level: 'error', path: logPath }
    ]
});

var accessLog = bunyan.createLogger({
    name: 'rosecomb',
    serializers: bunyan.stdSerializers,
    streams: [
      {
        type: 'rotating-file',
        path: accessLogPath,
        period: '1d',   // daily rotation
        count: 3        // keep 7 back copies
      }
    ]
});

var self = module.exports = {

    access: function access() {
        if (enabled) accessLog.info.apply(accessLog, arguments);
    },

    debug: function debug() {
        if (enabled) log.debug.apply(log, arguments);
    },

    info: function info() {
        if (enabled) log.info.apply(log, arguments);
    },

    warn: function warn() {
        if (enabled) log.warn.apply(log, arguments);
    },

    error: function error() {
        if (enabled) log.error.apply(log, arguments);
    },

    trace: function trace() {
        if (enabled) log.trace.apply(log, arguments);
    },

    get: function get() {
        return log;
    }

}

/**
 * DEPRECATED Log message if running at stage level
 *
 * @param {String} message
 * @return undefined
 * @api public
 */
module.exports.stage = util.deprecate(function (message, done) {
    module.exports.info(message);
}, module.exports.warn('log.stage() is deprecated and will be removed in a future release. Use log.debug(), log.info(), log.warn(), log.error(), log.trace() instead.'));

/**
 * DEPRECATED Log message if running at production level
 *
 * @param {String} message
 * @return undefined
 * @api public
 */
module.exports.prod = util.deprecate(function (message, done) {
    module.exports.info(message);
}, module.exports.warn('log.prod() is deprecated and will be removed in a future release. Use log.debug(), log.info(), log.warn(), log.error(), log.trace() instead.'));
