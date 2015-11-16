var app = require(__dirname + '/../bantam/lib/');

// Go!
app.start({
  workspacePath: __dirname + '/workspace',
  datasourcePath: __dirname + '/workspace/data-sources',
  pagePath: __dirname + '/workspace/pages',
  partialPath: __dirname + '/workspace/partials',
  eventPath: __dirname + '/workspace/events',
  mediaPath: __dirname + '/media',
  publicPath: __dirname + '/public'
});
