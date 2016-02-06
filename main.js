var app = require(__dirname + '/index.js');
app.start();

// export the modules
module.exports.Config = require('./config');
module.exports.Event  = require(__dirname + '/dadi/lib/event');
module.exports.Log    = require(__dirname + '/dadi/lib/log.js');
