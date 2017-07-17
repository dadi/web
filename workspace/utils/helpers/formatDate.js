var dust = require("dustjs-linkedin")
var moment = require("moment")

/*
* Returns the supplied 'data' parameter formatted using the supplied 'format' parameter
* Pass a unix epoch time (expects milliseconds) in the 'unix' parameter. For seconds use 'unix_sec'
* Usage: {@formatDate data="{body}" [unix="{lastModifiedAt}"] format="YYYY-MM-DDTh:mm:ss+01:00"/}
*/
dust.helpers.formatDate = function(chunk, context, bodies, params) {
  var format = context.resolve(params.format)
  var parseFormat = context.resolve(params.parseFormat)

  if (params.unix_sec) {
    var unixSec = context.resolve(params.unix_sec)
    return chunk.write(moment.unix(unixSec).format(format))
  } else if (params.unix) {
    var unix = context.resolve(params.unix)
    return chunk.write(moment.unix(unix / 1000).format(format))
  } else {
    var data = context.resolve(params.data)
    return chunk.write(moment(data, parseFormat || format).format(format))
  }
}
