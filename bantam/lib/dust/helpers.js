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
