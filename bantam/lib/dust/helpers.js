var dust = require('dustjs-linkedin');
var marked = require('marked');
var moment = require('moment');
var pluralist = require('pluralist');
var _ = require('underscore');
var s = require('underscore.string');
var html_strip = require('htmlstrip-native');

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
