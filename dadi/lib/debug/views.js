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

module.exports.debug = function (debug) {
  return `<!DOCTYPE html><html lang="en"><head> <meta charset="utf-8"> <title>DADI Web</title>


    <script src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.3.1/ace.js"></script>  

    <script src="https://cdnjs.cloudflare.com/ajax/libs/jsoneditor/5.14.0/jsoneditor-minimalist.min.js"></script>

    <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/jsoneditor/5.14.0/jsoneditor.min.css">


  <style type="text/css"> *{padding: 0; margin: 0;}html{height: 100%;}
  body{-webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale; background: #191E24; font-family: Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace; text-align: center; min-height: 100%; display: -webkit-flex; display: -ms-flexbox; display: flex;}
    .view {
      display flex;
      flex: 1;
      position: relative;
    }
    .code {
      border: 0;
      box-sizing: border-box;
      background: #191E24 !important;
      max-height: 100vh;
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
    }
    .info {
      position: absolute;
      bottom: 0;
      right: 0;
      left: 0;
      z-index: 1000;
      color: #fff;
      font-size: 12px;
      font-weight: bold;
      color: #ccc;
      padding: 10px 20px;
      text-align: right;
      background: -moz-linear-gradient(top, rgba(21,26,31,0) 0%, rgba(21,26,31,1) 50%);
      background: -webkit-linear-gradient(top, rgba(21,26,31,0) 0%,rgba(21,26,31,1) 50%);
      background: linear-gradient(to bottom, rgba(21,26,31,0) 0%,rgba(21,26,31,1) 50%);
      border-left: 1px solid #1D2733;
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

    div.jsoneditor-navigation-bar {
      border: 0;
      background: none;
      text-align: left;
      overflow: hidden;
      position: absolute;
      bottom: 5px; left: 0; right: 0;
      z-index: 1000;
      display: inline-block;
    }
    div.jsoneditor-treepath {
      padding: 0 15px;
    }
    div.jsoneditor-navigation-bar.nav-bar-empty:after {
      display: none;
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

    nav {
      background: #101417;
      position: relative;
      z-index: 100;
      text-align: left;
    }

    nav ol {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: right;
    }

    nav li {
      list-style: none;
    }
    nav li a {
      display: block;
      color: #fff;
      font-size: 12px;
      padding: 9px 13px;
      text-decoration: none;
    }
    nav li a:hover {
      color: #326ff4;
      background: #191e24;
    }
    nav li a.active {
     background: #326ff4;
      color: #fff;
    }

    .inputRoute,
    #inputPath {
      background: none;
      color: #fff;
      border: none;
      border-bottom: 1px solid #1e2833;
      padding: 20px;
      font-size: 13px;
      width: 100%;
      box-sizing: border-box;
      outline: none;
      font-family: Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace;
    }
    #inputPath {
      background: #1e2833;
      font-size: 16px;
    }
    .inputRoute.match {
      background: #88c34b;
      color: #fff;
    }
    </style>
  </head><body>


  <nav>
  <ul>
    <li><a href="?debug" ${
      debug.mode === 'main' ? `class="active"` : ''
    }>View</a></li>
    <li><a href="?debug=data" ${
      debug.mode === 'data' ? `class="active"` : ''
    }>Data</a></li>
    <li><a href="?debug=page" ${
      debug.mode === 'page' ? `class="active"` : ''
    }>Page</a></li>
    <li><a href="?debug=ds" ${
      debug.mode === 'ds' ? `class="active"` : ''
    }>Datasources</a></li>
    <li><a href="?debug=result" ${
      debug.mode === 'result' ? `class="active"` : ''
    }>Result</a></li>
    <li><a href="?debug=stats" ${
      debug.mode === 'stats' ? `class="active"` : ''
    }>Stats</a></li>
    <li><a href="?debug=route" ${
      debug.mode === 'route' ? `class="active"` : ''
    }>Route</a></li>
  </ul>
  <ol>
    <li><a href="https://github.com/nodejs/Release#release-schedule">Node.js ${Number(
      process.version.match(/^v(\d+\.\d+)/)[1]
    )}</a></li>
    <li><a href="https://dadi.cloud/web">v.${debug.version}</a></li>
  </ol>
  </nav>

   ${
     debug.data
       ? `<div class="view"><div class="info">${
           debug.pane1 ? debug.pane1 : ''
         }</div><div class="code" id="data"></div></div>`
       : ''
   }
   ${
     debug.template
       ? `<div class="view">
            <div class="info">${debug.pane2 ? debug.pane2 : ''}</div>
            <div class="code" id="template">${debug.template
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}
            </div>
          </div>
        `
       : ''
   }
   
   ${
     debug.output
       ? `<div class="view"><div class="info">${
           debug.pane3 ? debug.pane3 : ''
         }</div><div class="code" id="output">${debug.output
           .replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;')}</div></div>`
       : ''
   }

   ${
     debug.output2
       ? `<div class="view"><div class="code" id="output2">${debug.output2
           .replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;')}</div></div>`
       : ''
   }

   ${debug.view ? `<div class="view">${debug.view}</div>` : ''}

   <script>
   ${
     debug.data
       ? `var data = new JSONEditor(document.getElementById('data'), {mode: 'view'}, ${debug.data
           .replace(/&/g, '&amp;')
           .replace(/</g, '&lt;')
           .replace(/>/g, '&gt;')})`
       : ''
   }

   var options = {
    readOnly: true,
    tabSize: 2,
    wrap: true,
    indentedSoftWrap: true,
    foldStyle: 'markbegin',
    theme: 'ace/theme/cobalt',
    showPrintMargin: false
   };

   ${
     debug.template
       ? `options.mode = 'ace/mode/handlebars';
   ace.edit("template").setOptions(options);`
       : ''
   }

   ${
     debug.output
       ? `
   options.mode = 'ace/mode/${debug.type}';
   ace.edit("output").setOptions(options);
   `
       : ''
   }

   ${debug.output2 ? `ace.edit("output2").setOptions(options);` : ''}

   </script> 

  </body></html>`
}
