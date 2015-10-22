var bunyan = require('bunyan');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var util = require('util');
var _ = require('underscore');

var config = require(path.resolve(__dirname + '/../../config.js'));
var enabled = config.get('logging.enabled');
var logPath = path.resolve(config.get('logging.path') + '/' + config.get('logging.filename') + '.' + config.get('env') + '.' + config.get('logging.extension'));

// create log directory if it doesn't exist
mkdirp(path.resolve(config.get('logging.path')), {}, function(err, made) {
    if (err) {
        module.exports.error(err);
    }

    if (made) {
        module.exports.info('[LOGGER] Log directory created at ' + made);
    }
});

var log = bunyan.createLogger({
    name: 'rosecomb',
    serializers: {
        err: bunyan.stdSerializers.err,
        res: bunyan.stdSerializers.res
    },
    streams: [
        {
          level: 'info',
          path: logPath
          //stream: process.stdout            // log INFO and above to stdout
        },
        {
          level: 'error',
          path: logPath  // log ERROR and above to a file
        }
    ]
});

var self = module.exports = {

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

