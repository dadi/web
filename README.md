<img src="https://dadi.tech/assets/products/dadi-web.png" alt="DADI Web" height="65"/>

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/web.svg?maxAge=10800&style=flat-square)](https://www.npmjs.com/package/@dadi/web)
[![coverage](https://img.shields.io/badge/coverage-70%25-yellow.svg?style=flat?style=flat-square)](https://github.com/dadi/web)
[![Build Status](https://travis-ci.org/dadi/web.svg?branch=master)](https://travis-ci.org/dadi/web)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)

## DADI Web

* [Overview](#overview)
* [Requirements](#requirements)
* [Getting started](#getting-started)
* [Links](#links)

## Overview

DADI Web is a high performance, schema-less templating layer built on Node.JS. it can operate as a stand-alone platform or in conjunction with [DADI API](https://github.com/dadi/api) as a full stack web application.

DADI Web makes it easy to build custom enterprise-grade Node.JS applications. Easily create static pages or connect to APIs to generate data-driven pages giving you the power to search, paginate, sort and filter your data.

DADI Web uses LinkedIn's Dust templating language which provides a simple yet powerful template layer for displaying your data. It has built in support for: Rotating log files, Nginx-style HTTP access logs, GZip compression, caching by mime-type, URL rewriting, database-backed sessions and more.

DADI Web is part of [DADI](https://github.com/dadi/), a suite of components covering the full development stack, built for performance and scale.

## Requirements

* Node.js versions:
  * 4.7.0
  * 5.12.0
  * 6.9.2

## Getting started

### Initialise the project

Running `npm init` adds a file called `package.json` to your project, allowing you to easily add dependencies to it:

```bash
$ npm init
```

### Install the module from NPM

All DADI platform microservices are available from [NPM](https://www.npmjs.com/). To add *Web* to your project as a dependency:

```bash
$ npm install --save @dadi/web
```

### Add an entry point

You'll need an entry point for your project. We'll create a file called `index.js` and later we will start the application with `node index.js`.

Add the following to the new file:

```js
/**
 *  index.js
 */
var app = require('@dadi/web')
```

### Configuration

Web requires a configuration file specific to the application environment. For example in the production environment it will look for a file named `config.production.json`.

Place configuration files in a `config` folder in your application root, for example `config/config.development.json`. Full configuration documentation can be found at http://docs.dadi.tech/web/getting-started/configuration/.

**Sample configuration**

```json
{
  "server": {
    "host": "localhost",
    "port": 3000
  },
  "api": {
    "host": "localhost",
    "port": 3001
  }
}
```

### Start the server

Web can be started from the command line simply by issuing the following command:

```bash
node index.js
```

With the configuration above, our Web server is available at http://localhost:3000.

#### Run Web as a service

To run your Web application in the background as a service, install Forever and Forever Service:

```bash
$ npm install forever forever-service -g

$ forever-service install -s index.js -e NODE_ENV=production web --start
```

> Note: the environment variable `NODE_ENV=production` must be set to required the configuration version matching the configuration files available in the `config` directory.


## Links
* [Web Documentation](http://docs.dadi.tech/web/)

## Licence

DADI is a data centric development and delivery stack, built specifically in support of the principles of API first and COPE.

Copyright notice<br />
(C) 2017 DADI+ Limited <support@dadi.tech><br />
All rights reserved

This product is part of DADI.<br />
DADI is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version ("the GPL").

**If you wish to use DADI outside the scope of the GPL, please
contact us at info@dadi.co for details of alternative licence
arrangements.**

**This product may be distributed alongside other components
available under different licences (which may not be GPL). See
those components themselves, or the documentation accompanying
them, to determine what licences are applicable.**

DADI is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

The GNU General Public License (GPL) is available at
http://www.gnu.org/licenses/gpl-3.0.en.html.<br />
A copy can be found in the file GPL.md distributed with
these files.

This copyright notice MUST APPEAR in all copies of the product!
