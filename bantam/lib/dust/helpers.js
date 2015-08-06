var dust = require('dustjs-linkedin');
var markdown = require('markdown');
var moment = require('moment');

/*
* Returns the supplied 'data' parameter truncated using the supplied 'length' parameter 
* Usage: {@Truncate data="{body}" length="250"/}
*/
dust.helpers.Truncate = function(chunk, context, bodies, params) {
    var data   = dust.helpers.tap(params.data, chunk, context),
        length = dust.helpers.tap(params.length, chunk, context);
    return chunk.write(data.substr(0, length));
}

/*
* Returns the supplied 'data' parameter trimmed of whitespace on both left and right sides
* Usage: {@Trim data="{body}"/}
*/
dust.helpers.Trim = function(chunk, context, bodies, params) {
    var data   = dust.helpers.tap(params.data, chunk, context);
    return chunk.write(data.trim());
}

/*
* Returns the supplied 'data' parameter formatted using the supplied 'format' parameter 
* Usage: {@formatDate data="{body}" format="YYYY-MM-DDTh:mm:ss+01:00"/}
*/
dust.helpers.formatDate = function(chunk, context, bodies, params) {
    var data   = dust.helpers.tap(params.data, chunk, context),
        format = dust.helpers.tap(params.format, chunk, context);
    return chunk.write(moment().format(format));
}
 
/*
* Returns the markdown content formatted as HTML
*/
dust.helpers.markdown = function(chunk, context, bodies, params) {
    if (bodies.block) {
        return chunk.capture(bodies.block, context, function(string, chunk) {
            chunk.end(markdown.parse(string));
        });
    }
    return chunk;
};