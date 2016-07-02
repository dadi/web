var dust = require('dustjs-linkedin');
var JSON5 = require('json5');
var marked = require('marked');
var moment = require('moment');
var pluralist = require('pluralist');
var _ = require('underscore');
var s = require('underscore.string');
var html_strip = require('htmlstrip-native');
var url  = require('url');

/*
* Returns the supplied 'data' parameter truncated using the supplied 'length' parameter
* Usage: {@Truncate data="{body}" length="250" ellipsis="true"/}
*/
dust.helpers.Truncate = function(chunk, context, bodies, params) {
    var data   = context.resolve(params.data),
        length = context.resolve(params.length),
        ellipsis = context.resolve(params.ellipsis);
    var str;
    if (ellipsis === 'true' && data.length > length) {
        str = data.substr(0, length);
        if(data) {
            str = str.replace(/[\W]*$/, '&hellip;');
        }
    }
    else {
        str = data.substr(0, length);
    }
    return chunk.write(str);
}

/*
* Returns the supplied 'data' parameter trimmed of whitespace on both left and right sides
* Usage: {@Trim data="{body}"/}
*/
dust.helpers.Trim = function(chunk, context, bodies, params) {
    var data   = context.resolve(params.data);
    return chunk.write(data.trim());
}

/*
* Returns the supplied 'data' parameter formatted using the supplied 'format' parameter
* Pass a unix epoch time (expects milliseconds) in the 'unix' parameter. For seconds use 'unix_sec'
* Usage: {@formatDate data="{body}" [unix="{lastModifiedAt}"] format="YYYY-MM-DDTh:mm:ss+01:00"/}
*/
dust.helpers.formatDate = function(chunk, context, bodies, params) {
    var format = context.resolve(params.format);
    var parseFormat = context.resolve(params.parseFormat);

    if (params.unix_sec) {
        var unix_sec = context.resolve(params.unix_sec);
        return chunk.write(moment.unix(unix_sec).format(format));
    }
    else if (params.unix) {
        var unix = context.resolve(params.unix);
        return chunk.write(moment.unix(unix / 1000).format(format));
    }
    else {
        var data = context.resolve(params.data);
        return chunk.write(moment(data, parseFormat || format).format(format));
    }
}

/*
* Returns the supplied 'data' parameter formatted using the supplied parameters
* See https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Number/toLocaleString
* Params:
*   localeString:   e.g. 'en-GB'
*   style
*   currency
*   minimumFractionDigits
*
*   options:        An object containing properties to determine how the formatting should be applied.
*                   Unless above params exist, the default is: {style: 'decimal', minimumFractionDigits: 0}
* Usage:
*     {@formatNumber data="12345" localeString="en-GB" /} => 12,345
*     {@formatNumber data="12345" localeString="en-GB" style="currency" currency="GBP" minimumFractionDigits="0"/} => £12,345
*/
dust.helpers.formatNumber = function(chunk, context, bodies, params) {
    var data         = context.resolve(params.data);
    var localeString = context.resolve(params.localeString);
    var style        = context.resolve(params.style);
    var currency     = context.resolve(params.currency);
    var fractionDigits = context.resolve(params.minimumFractionDigits);

    var options      = {style: 'decimal', minimumFractionDigits: 0};

    if (style) options.style = style;
    if (currency) options.currency = currency;
    if (fractionDigits) options.minimumFractionDigits = fractionDigits;

    if (data) {
        return chunk.write(data);
    }
}

/*
* Returns the markdown content formatted as HTML
*/
dust.helpers.markdown = function(chunk, context, bodies, params) {

    var renderer = new marked.Renderer();
    renderer.link = function (href, title, text) {

        var attrArray = href.split('|');
        var attrs = {};

        var first = attrArray.shift();
        if (first) href = first;

        for (var i = 0; i < attrArray.length; i++) {
            var attr = attrArray[i];
            var attrName = "";
            var attrValue = "";
            var pos = attr.indexOf('=');
            if (pos > 0) {
                attrName = attr.substr(0, pos);
                attrValue = attr.substr(pos + 1);
            }
            attrs[attrName] = attrValue;
        };

        var attrString = "";
        Object.keys(attrs).forEach(function (key) {
            attrString = attrString + key + '="' + attrs[key] + '" ';
        });

        if (title && title.length > 0) {
            title = ' title="' + title + '"';
        }
        else {
          title = '';
        }

        return '<a href="' + href + '" ' + attrString + title + '>' + text + '</a>';
    }

    if (bodies.block) {
        return chunk.capture(bodies.block, context, function(string, chunk) {

            chunk.end(marked(string, { renderer: renderer }));
        });
    }
    return chunk;
};

/*
* Returns the markdown content formatted as HTML, but without <p> wrappers
*/
dust.helpers.soberMarkdown = function(chunk, context, bodies, params) {
    if (bodies.block) {
        return chunk.capture(bodies.block, context, function(string, chunk) {
            var md = marked(string);

            // Replace </p><p> with <br>
            var str = md.replace(/<\/p><p[^>]*>/igm, '<br>');

            // Remove wrapping <p></p> tags
            str = str.replace(/<p[^>]*>(.*?)<\/p>/igm, "$1");

            chunk.end(str);
        });
    }
    return chunk;
};

/*
* Returns the supplied 'str' parameter with any instanses of {...} resolved to {vartoreplace}
* Usage: {@forceRender str="{body}" value="{vartoreplace}" /}
*/
dust.helpers.forceRender = function(chunk, context, bodies, params) {
    str = context.resolve(params.str);
    value = context.resolve(params.value);

    str = str.replace(/{.*?}/gmi, value);

    return chunk.write(str);
}

/*
* iter iterates over `items`, much like using `{#items}{/items}`,
* but with the possiblity to loop over a subset, and in any direction
* Usage:
* ```
* {@iter items=arrayOfItems from=0 to=12}
*   run for each item, with the item as context
* {/iter}
* ```
*/
dust.helpers.iter = function(chunk, context, bodies, params) {

    params.items = params.items || [];
    params.from = params.from || 0;
    params.to = params.to === 0 ? 0 : params.to || params.items.length;

    var direction;
    if(params.from < params.to) {
        direction = 1;
    }
    else {
        direction = -1;
        // to reach the beginning of the array we need to go to -1
        params.to--;
    }

    var metaContext = {
        $idx: params.from,
        $len: params.items.length
    };
    context = context.push(metaContext);

    while(metaContext.$idx !== params.to) {
        if(params.items[metaContext.$idx]) {
            chunk = chunk.render(bodies.block, context.push(params.items[metaContext.$idx]));
        }
        metaContext.$idx += direction;
    }
    // pop metaContext
    context.pop();
    return chunk;
};


/*
* Strips HTML from passed content
* Uses: https://github.com/zaro/node-htmlstrip-native
*/
dust.helpers.htmlstrip = function(chunk, context, bodies, params) {
    return chunk.capture(bodies.block, context, function(data, chunk){
        var options = {
            include_script: false, // exclude the content of <script> tags
            include_style: false, // exclude the content of <style> tags
            compact_whitespace: false // compact consecutive '\s' whitespace into single char
        };

        data = html_strip.html_strip(data, options).trim();

        chunk.write(data);
        chunk.end();
    });
};

/*
* Default values for partials
*/

dust.helpers.defaultParam = function(chunk, context, bodies, params) {
    var key = params.key,
        value = params.value;

    if(typeof context.get(key) === 'undefined') {
        context.global[key] = value;
    }
};

/*
* Numbers with commas
*/

dust.helpers.numberCommas = function(chunk, context, bodies, params) {
    return chunk.capture(bodies.block, context, function(data, chunk){
        data = data.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")

        chunk.write(data);
        chunk.end();
    });
};

dust.helpers.plural = function(chunk, context, bodies, params) {
    var options = {
        val: params.val,
        auto: params.auto,
        one: params.one,
        many: params.many
    }

    if (typeof options.val !== 'undefined') {
      var multiple = Boolean(Number(options.val) - 1);

      if (typeof options.auto !== 'undefined') {
        return chunk.write( multiple ? pluralist.plural(options.auto).anglicised_plural : pluralist.singular(options.auto).singular_suffix );
      }
      else if (options.one && options.many) {
        var str = multiple ? options.many : options.one;
        return chunk.write( str );
      }
    }
    else if (options.auto) {
      return chunk.write(options.auto);
    }
    else {
      return chunk.write("");
    }
}
/*
* Encode html to json valid
*/
dust.helpers.htmlEncode = function(chunk, context, bodies, params) {
    return chunk.capture(bodies.block, context, function(data, chunk){
        data = JSON.stringify(data.toString());

        chunk.write(data);
        chunk.end();
    });
};

/*
* Generate URLs based on routes by sending in page names & parameters
* Usage:
* ```
* {@url page="pagename" param="val" otherparam=variableval/}
* ```
*/
dust.helpers.url = (function() {
    var core;
    return function(chunk, context, bodies, params) {
        if (!core) {
            // requiring core here is due to this file is loaded by the core, and so requiring it elsewhere won't work
            core = require(__dirname + '/../');
        }

        // Ensure a page name is input
        if (typeof params.page === 'undefined') {
            throw new Error('The @url helper needs a page to work. Please send it in as a string (double quote marks if not referencing a variable).');
        }

        // Get the page
        var component = core.getComponent(params.page);
        if (!component) {
            throw new Error('The @url helper could not find a page with the key "' + params.page + '".');
        }

        // Get the route
        return component.page.toPath(_.omit(params, 'page'));
    };
}());

/*
* Use the Underscore.JS Slugify method to generate a URL friendly string
* Usage:
* ```
* {@slugify}{title}{/slugify}
* ```
*/
dust.helpers.slugify = function(chunk, context, bodies, params) {
    return chunk.capture(bodies.block, context, function(data, chunk){
        data = s.slugify(data);

        chunk.write(data);
        chunk.end();
    });
};

/**
 * Performs a global search and replace within a string.
 * In the following example, we replace all periods in the
 * message string with dashes.
 *
 * {@replace str="{message}" search="." replace="-" /}
 *
 * str - the input string within which the search and replace will be performed
 * search - the character or sequence to search
 * replace - the character or sequence used to replace
 */
dust.helpers.replace = function (chunk, context, bodies, params) {
  var str = context.resolve(params.str);
  var search = context.resolve(params.search);
  var replace = context.resolve(params.replace);

  var result = str.replace(new RegExp(escapeRegExp(search), 'g'), replace);

  return chunk.write(result);
};

/**
 * Processes the given string to escape special meta characters used within
 * Regular Expressions. This is used by the replace helper.
 */
function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

/*
* Paginate pages
* Usage:
* Send in current page, total pages, and a pattern for the path to generate.
* In the path pattern, use the  dust variable `n` where you want the page number inserted.
* The helper exposes five different blocks: default/initial, current, prev, next, else & gap.
* The default/initial/unnamed block is rendered for all steps but the current one, as well as
* for gaps if the gap block isn't defined. Leave the gap block blank to supress output of gaps.
* If there is only one page, the {:else} block is the only block that is rendered.
* When printing the path, if there's a searchstring, use the `|s` filter to
* disable escaping, as the url will render incorrectly (with `&amp;`'s) otherwise.
* Please note that this is not safe when printing user input!
* ```
* {@paginate page=currentPageNumber totalPages=totalPageCount path="/page/{n}"}
*   <a href="{path}">{n}</a>
* {:current}
*   <a href="{path}">Current page {n}</a>
* {:prev}
*   <a href="{path}">Prev</a>
* {:next}
*   <a href="{path}">Next</a>
* {/paginate}
* ```
* If you instead of having the page number in the pathname want it in the querystring, use the `param` option:
* ```
* {@paginate page=currentPage totalPages=totalPageCount path="/root" param="page"}
* - {path|s}
* {:current}- {path|s} (on)
* {/paginate}
* ```
* Which in the case of example above with `currentPage=2` & `totalPageCount=3` would give the following output:
* ```
* - /root
* - /root?page=2 (on)
* - /root?page=3
* ```
* If the `path` sent in already has a querystring the right param will be set/updated.
*/
dust.helpers.paginate = function(chunk, context, bodies, params) {
  var err;
  if(!('page' in params && 'totalPages' in params && 'path' in params)) {
    err = new Error('Insufficient information provided to @paginate helper');
  }
  var current = parseInt(params.page, 10);
  var totalPages = parseInt(params.totalPages, 10);
  if(!(isFinite(current) && isFinite(totalPages))) {
    err = new Error('Parameters provided to @paginate helper are not integers');
  }
  var queryParam = params.param;
  var paginateContext = {
    n: current,
    path: ''
  };
  if(err) {
    console.log(err);
    return chunk;
  }
  var context = context.push(paginateContext);

  function constructPath(pathPattern, n) {
    var outputPath = context.resolve(pathPattern);
    if(queryParam) {
      var parsedPath = url.parse(outputPath, true); //parse search string to query object
      parsedPath.query[queryParam] = n;
      if(n === 1) {
        delete parsedPath.query[queryParam];
      }
      delete parsedPath.search; //otherwise the search string is used instead of the query object
      outputPath = url.format(parsedPath);
    }
    else {
      if(n === 1) {
        // this is to make the path just the base path, without the number
        outputPath = (outputPath || '').replace(/1\/?$/, '');
      }
    }
    return outputPath;
  }
  function printStep(body, n) {
    paginateContext.n = n;
    paginateContext.path = constructPath(params.path, n);
    if(body) {
      chunk.render(body, context);
    }
  }
  var printGap = bodies.gap ? printStep.bind(null, bodies.gap) : function(){};
  function printStepOrGap(step) {
    if(step === '.') {
      printGap();
    }
    else {
      printStep(bodies.block, step);
    }
  }

  function getStepSize(distance) {
    if(distance > 550) { return 500; }
    else if(distance > 110) { return 100; }
    else if(distance > 53) { return distance - 25; }
    else if(distance > 23) { return distance - 10; }
    else if(distance >= 10) { return distance - 5; }
    else if(distance >= 5) { return distance - 2; }
    else { return 1; }
  }
  function makeSteps(start, end, tightness) {
    // start & end are non-inclusive
    var now, final, stepSize, steps = [];

    if(tightness === 'increase') {
      now = start;
      final = end;
      while(now < final) {
        if(now !== start) {
          steps.push(now);
        }
        stepSize = getStepSize(final - now);
        if(stepSize > 1) {
          steps.push('.');
        }
        now += stepSize;
      }
    }
    else { // decrease
      now = end;
      final = start;
      while(now > final) {
        if(now !== end) {
          steps.push(now);
        }
        stepSize = getStepSize(now - final);
        if(stepSize > 1) {
          steps.push('.');
        }
        now -= stepSize;
      }
      steps.reverse();
    }

    return steps;
  }

  // Only one page
  if(!totalPages || totalPages === 1) {
    if(bodies.else) {
      return chunk.render(bodies.else, context);
    }
    return chunk;
  }

  if(current > 1) {
    // Prev
    printStep(bodies.prev, current - 1);
    // First step
    printStep(bodies.block, 1);
    // Pre current
    _.each(makeSteps(1, current, 'increase'), printStepOrGap);
  }

  // Current
  printStep(bodies.current, current);

  if(current < totalPages) {
    // Post current
    _.each(makeSteps(current, totalPages, 'decrease'), printStepOrGap);
    // Last step
    printStep(bodies.block, totalPages);
    // Next
    printStep(bodies.next, current + 1);
  }

  return chunk;
};

/*
* Get the first item matching the sent in params. Replaces iteration+eq combos.
* Usage:
* For arrays of objects each object has its property at key checked for a match with the provided value, much like underscore's `findWhere`
* ```
* {@findWhere list=aList key="id" value=id}
* {.}
* {/findWhere}
* ```
* You can also supply the `list` with `props`, which is a (loosely parsed by json5)
* JSON object in a string. This makes it possible to combine multiple filters.
* ```
* {@findWhere list=aList props="{attr: "{strvalue}", other: {numericalId}}"}
* {.}
* {/findWhere}
* ```
* Whatever you send in you will at most ever get one item back.
*/
dust.helpers.findWhere = function(chunk, context, bodies, params) {
  var list = params.list;
  var key = params.key;
  var value = params.value;
  var props;
  var found;
  if('list' in params && 'key' in params && 'value' in params) {
    found = _.find(list, function(obj) {
      return (obj[key] == value);
    });
  }
  else if('list' in params && 'props' in params) {
    try {
      props = JSON5.parse(context.resolve(params.props));
    } catch(err) {
      throw new Error('The @findWhere dust helper received invalid json for props')
    }
    found = _.findWhere(list, props);
  }
  else {
    throw new Error('The @findWhere dust helper is missing a parameter');
  }
  if(found) {
    return chunk.render(bodies.block, context.push(found));
  }
  else if('else' in bodies) {
    return chunk.render(bodies.else, context);
  }
  return chunk;
};
