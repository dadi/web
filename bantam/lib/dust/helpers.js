var dust = require('dustjs-linkedin');
//var dustHelpers = require('dustjs-helpers');

dust.helpers.Truncate = function(chunk, context, bodies, params) {
    var data   = dust.helpers.tap(params.data, chunk, context),
        length = dust.helpers.tap(params.length, chunk, context);
    return chunk.write(data.substr(0, length));
}
