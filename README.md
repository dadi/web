![Rosecomb](rosecomb.png)

![Build Status](http://img.shields.io/badge/Release-0.1.5_Beta-green.svg?style=flat-square)&nbsp;[![License](http://img.shields.io/:License-MIT-blue.svg?style=flat-square)](http://dadi.mit-license.org)&nbsp;![Coverage](http://img.shields.io/badge/Coverage-71%-yellow.svg?style=flat-square)

## Contents

* [Overview](#overview)
* [Pages](docs/page_specification.md)
* [Data sources](docs/datasource_specification.md)
* [Setup and installation](#setup-and-installation)
* [Configuration](#configuration)
* [Running the demo application](#running-the-demo-application)
* [Running the server](#running-the-server)
* [Further reading](#further-reading)
* [Development](#development)


## Overview

Rosecomb is built on Node.JS. It is a high performance schemaless templating layer designed in support of API-first development and the principle of COPE.

It can opperate as a stand alone platform or in conjunction with [Serama](https://github.com/bantam-framework/serama) as a full stack web application.

Rosecomb is part of [Bantam](https://github.com/bantam-framework/), a suite of components covering the full development stack, built for performance and scale.

Rosecomb is based on Node.JS, using latest stable versions.

### Component Terminology

#### Page descriptors
These files describe the application's pages and the routes which load them. Data sources and events used by the page are specified within these files.

Rosecomb monitors the `workspace` folder for changes and will automatically reload pages and templates when these files change.

New pages can be initialised by simply creating new page descriptor and template files in `workspace/pages/`. A new page descriptor should take the format `{pagename}.json`. It should either reference an existing template file or you can create a new one in `workspace/pages/` with the format `{pagename}.dust`.

Unless a custom route has been specified in the page descriptpr, the new page will be availabe at `http://www.example.com/{pagename}`.


Multiple datasource files (`workspace/data-sources/{datasourcename}.json`) can be attached to a page. Each data source file describes which Serama endpoint to use, which filters to use, how many records to return etc. A full list of options can be found in the [Datasource Specification](datasource_specification.md) document.

#### Data sources
Data sources are the main link between Rosecomb and a Serama REST API or other third party end point. Data sources describe which endpoints to use, how to authenticate against that service, whether caching and pagination are enabled and can include default filters to pass to Serama. See [Datasource Specification](datasource_specification.md) for more information and a sample data source.

Data sources are assigned to pages in the page descriptor file.

#### Events
These files add additional server side functionality to pages. Events are run after a page has loaded data from all of it's data sources, so they have access to all the data specified by a page's descriptor file.

See [Events](events.md) for more information and a sample event file.

Events are assigned to pages in the page descriptor file.

#### Pages and Partials
Pages are the main template files. Templating is based around the [DustJS](http://akdubya.github.io/dustjs/) templating language.

Partials are reusable template files that may be referenced from the main page templates. Partials may also contain *DustJS* code.

Pages and partials have access to the data loaded in data sources and events.

###### Error Pages

###### _HTTP 404 Not Found_
To enable a custom 404 Not Found error page, add a page descriptor and template to the pages directory:

```
workspace/pages/404.json
workspace/pages/404.dust
```

404 templates have access to data source and event data in the same way as standard pages.


### File structure
```  
  bantam/main.js
  workspace/data-sources/{datasource name}.json
  workspace/events/{event name}.json
  workspace/pages/{page name}.dust
  workspace/pages/{page name}.json
  workspace/partials/{partial name}.dust
```

### Setup and installation

	[sudo] npm install

### Configuration

#### File structure
```  
  config.js
  config/config.development.json
  config/config.test.json
  config/config.staging.json
  config/config.production.json
```

See [Configuration](docs/configuration.md) for more information and a sample configuration file.

### Running the demo application


  node demo/main.js


### Running the server

Rosecomb expects the Serama API to be running locally on port 3001. Start the Serama server before running Rosecomb.

	npm start


### How it works

The `workspace` directory contains the pages, partials and datasources required to display data retrieved from the Serama API.

Each page is defined in a JSON file specifying the datasources that will retrieve the data for display.

A datasource is a JSON file specifying the API endpoint to connect to along with parameters to use when querying the API.

### Example

If a request is made to Rosecomb running on `http://localhost:3000/articles` the application takes the `articles` parameter and looks for an `articles.json` page descriptor in `workspace/pages`. Any datasources that page descriptor specifies are loaded from `workspace/data-sources` and the data is retrieved from the datasource's API endpoint. In order to render the returned data to the browser, a Dust template must exist in `workspace/pages` with the same name as the requested page, e.g. `articles.dust`.

### Further Reading

The `docs/` directory contains additional documentation on the component parts of the system:

* [Configuration](docs/configuration.md)
* [Data sources](docs/datasource_specification.md)
* [Events](docs/events.md)
* [Pages](docs/page_specification.md)
* [Page Templates](docs/page_templates.md)
* [Routing](docs/routing.md)
* [Logging](docs/logging.md)

Feel free to contact the Bantam core development team on team@bant.am with questions.

## Development

Rosecomb was conceived, developed and is maintained by the engineering team at DADI+ ([https://dadi.co](https://dadi.co)).

Core contributors:

* Joseph Denne
* Viktor Fero
* James Lambie
* Dave Longworth

### Roadmap

We will capture planned updates and additions here. If you have anything to contribute in terms of future direction, please add as an enhancement request within [issues](https://github.com/bantam-framework/rosecomb/issues).


### Versioning

Semantic Versioning 2.0.0

Given a version number MAJOR.MINOR.PATCH, increment the:

* MAJOR version when you make incompatible API changes,
* MINOR version when you add functionality in a backwards-compatible manner, and
* PATCH version when you make backwards-compatible bug fixes.

_Additional labels for pre-release and build metadata are available as extensions to the MAJOR.MINOR.PATCH format._

### Contributing

Very daring.

Fork, hack, possibly even add some tests, then send a pull request :)

## Licence

Copyright (c) 2015, DADI+ Limited (https://dadi.co).

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
