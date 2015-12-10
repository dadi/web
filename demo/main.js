var app = require(__dirname + '/../dadi/lib/');

// Go!
app.start({
  workspacePath: __dirname + '/workspace',
  datasourcePath: __dirname + '/workspace/datasources',
  pagePath: __dirname + '/workspace/pages',
  partialPath: __dirname + '/workspace/partials',
  eventPath: __dirname + '/workspace/events',
  mediaPath: __dirname + '/media',
  publicPath: __dirname + '/public'
});
