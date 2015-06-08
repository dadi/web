var dust = require('dustjs-linkedin');

/*
* Returns the supplied 'data' parameter truncated using the supplied 'length' parameter 
* Usage: {@Truncate data="{body}" length="250"/}
*/
dust.helpers.Truncate = function(chunk, context, bodies, params) {
    var data   = dust.helpers.tap(params.data, chunk, context),
        length = dust.helpers.tap(params.length, chunk, context);
    return chunk.write(data.substr(0, length));
}

markdown = require('markdown');
 
dust.helpers.markdown = function(chunk, context, bodies, params) {
    if (bodies.block) {
        return chunk.capture(bodies.block, context, function(string, chunk) {
            chunk.end(markdown.parse(string));
        });
    }
    return chunk;
};