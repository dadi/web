/**
 * @module: Error HTML output
 */

module.exports.error = function (error) {
  return `<!DOCTYPE html><html lang="en"><head> <meta charset="utf-8"> <title>${
    error.statusCode
  } Error</title> <style type="text/css"> *{padding: 0; margin: 0;}html{height: 100%;}body{background: #f4f4f4; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; text-align: center; font-size: 17px; line-height: 23px; min-height: 100%; display: -webkit-flex; display: -ms-flexbox; display: flex; -webkit-align-items: center; -ms-flex-align: center; align-items: center; -webkit-justify-content: center; -ms-flex-pack: center; justify-content: center}main{width: 100%; max-width: 500px; padding: 20px; margin: auto; text-align: left}div, .message{font-family: "Lucida Sans Typewriter", "Lucida Console", monaco, "Bitstream Vera Sans Mono", monospace}div{background: #e0e0e0; display: none; font-size: 14px; margin: 1.2em 0; overflow: hidden; border-radius: 3px; line-height: normal}#toggle:checked + div{display: block}pre{padding: 15px; overflow: scroll; -webkit-overflow-scroll: touch}h1{font-size: 24px; margin: 1em 0 0.6em}h2{background: #000; color: #fff; padding: 15px; font-size: 15px}p{margin: 0 0 1.2em 0}.message{color: #999; margin-top: 1.2em; font-size: 14px}.message span{color: #555}.message a{color: inherit}label{cursor: pointer; border-radius: 4px; background: #295def; color: #fff; padding: 4px 7px; user-select: none}</style></head><body> <main> <svg width="90" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96.2 83.9"> <style>.st0{fill: #f79800}</style> <path class="st0" d="M94.2 83.9H2c-.7 0-1.4-.4-1.7-1-.4-.6-.4-1.4 0-2L46.4 1c.4-.6 1-1 1.7-1s1.4.4 1.7 1l46.1 79.9c.4.6.4 1.4 0 2-.3.6-1 1-1.7 1zm-88.7-4h85.3L48.1 6 5.5 79.9z"/> <path class="st0" d="M48.1 59c-1.1 0-2-.9-2-2V30.8c0-1.1.9-2 2-2s2 .9 2 2V57c0 1.1-.9 2-2 2zM48.1 70.4c-1.1 0-2-.9-2-2v-2.8c0-1.1.9-2 2-2s2 .9 2 2v2.8c0 1.1-.9 2-2 2z"/> </svg> <h1>${
    error.headline
  }</h1> <p>${
    error.human
  }</p><label for="toggle">Show me the technical details</label> <input type="checkbox" name="toggle" id="toggle"/> <div> <h2>${
    error.developer
  }</h2> <pre>${
    error.stack
  }</pre> </div><p class="message"><a target="_blank" href="https://httpstatuses.com/${
    error.statusCode
  }">${error.statusCode}</a> ${error.error}<br>${
    error.server
  }</p></main></body></html>`
}

module.exports.debug = function (output) {
  return `<!DOCTYPE html><html lang="en"><head> <meta charset="utf-8"> <title>DADI Web</title>


    <script src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.3.1/ace.js"></script>  

    <script src="https://cdnjs.cloudflare.com/ajax/libs/jsoneditor/5.14.0/jsoneditor-minimalist.min.js"></script>

    <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/jsoneditor/5.14.0/jsoneditor.min.css">


  <style type="text/css"> *{padding: 0; margin: 0;}html{height: 100%;}
  body{-webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale; background: #191E24; font-family: Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace; text-align: center; min-height: 100%;}
    .code {
      float: left;
      width: 33.333% !important;
      border: 0;
      box-sizing: border-box;
      display: block;
      height: 100vh;
      background: #191E24 !important;
    }

    div.jsoneditor,
    div.jsoneditor-value,
    div.jsoneditor-field,
    div.jsoneditor td,
    .code {
      font-size: 12px;
      line-height: 18px;
    }

    div.jsoneditor-field {
      color: #fff;
    }

    div.jsoneditor,
    div.jsoneditor-menu {
      border: 0;
      background: none;
      color: #fff
    }

    div.jsoneditor-tree button {
      height: 21px;
    }

    div.jsoneditor td {
      color: inherit;
    }

    table.jsoneditor-search div.jsoneditor-frame {
      border-radius: 3px;
    }

    div.jsoneditor-menu>button {
      background-color: none !important;
    }

    div.jsoneditor tr:hover {
      background: #0b0e14;
    }

    table.jsoneditor-search div.jsoneditor-frame table tr:hover {
      background: none;
    }

    div.jsoneditor-value.jsoneditor-string,
    a.jsoneditor-value.jsoneditor-url, div.jsoneditor-value.jsoneditor-url {
      color: #39d902;
    }

    .ace_gutter {
      background: none !important;
      border-left: 1px solid #1D2733;
    }
    .ace_gutter-cell {
      font-size: 11px;
    }
    </style>
  </head><body>




   <div class="code" id="data"></div>
   <div class="code" id="template">${output.template
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')}</div>
   <div class="code" id="html">${output.html
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')}</div>

   <script>
   var data = new JSONEditor(document.getElementById('data'), {mode: 'view', navigationBar: false}, ${
     output.data
   })


   var options = {
    readOnly: true,
    tabSize: 2,
    wrap: true,
    indentedSoftWrap: true,
    foldStyle: 'markbegin',
    theme: 'ace/theme/cobalt',
    showPrintMargin: false
   };

   /*options.mode = 'ace/mode/json';
   ace.edit("data").setOptions(options);*/

   options.mode = 'ace/mode/handlebars';
   ace.edit("template").setOptions(options);

   options.mode = 'ace/mode/html';
   ace.edit("html").setOptions(options);

   </script> 

  </body></html>`
}
