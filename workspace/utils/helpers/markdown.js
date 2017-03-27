var dust = require('dustjs-linkedin')
var marked = require('marked')

/*
* Returns the markdown content formatted as HTML
*/
dust.helpers.markdown = function (chunk, context, bodies, params) {
  if (bodies.block) {
    return chunk.capture(bodies.block, context, function (string, chunk) {
      chunk.end(marked(string))
    })
  }
  return chunk
}