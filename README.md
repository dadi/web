<img src="https://dadi.tech/assets/products/dadi-web-full.png" alt="DADI Web" height="65"/>

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/web.svg?maxAge=10800&style=flat-square)](https://www.npmjs.com/package/@dadi/web)
[![Coverage Status](https://coveralls.io/repos/github/dadi/web/badge.svg?branch=master)](https://coveralls.io/github/dadi/web?branch=master)
[![Build Status](https://travis-ci.org/dadi/web.svg?branch=master)](https://travis-ci.org/dadi/web)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)
[![Greenkeeper badge](https://badges.greenkeeper.io/dadi/web.svg)](https://greenkeeper.io/)

## DADI Web

* [Overview](#overview)
* [Requirements](#requirements)
* [Your First Web Project](#your-first-web-project)
* [Links](#links)

## Overview

DADI Web is a high performance, schema-less templating layer built on Node.JS. it can operate as a stand-alone platform or in conjunction with [DADI API](https://github.com/dadi/api) as a full stack web application.

DADI Web makes it easy to build custom enterprise-grade Node.JS applications. Easily create static pages or connect to APIs to generate data-driven pages giving you the power to search, paginate, sort and filter your data.

DADI Web uses LinkedIn's Dust templating language which provides a simple yet powerful template layer for displaying your data. It has built in support for: Rotating log files, Nginx-style HTTP access logs, GZip compression, caching by mime-type, URL rewriting, database-backed sessions and more.

DADI Web is part of [DADI](https://github.com/dadi/), a suite of components covering the full development stack, built for performance and scale.

## Requirements

* **[Node.js](https://www.nodejs.org/)** (supported versions: 6.11.1, 8.9.4)

## Your first Web project

### Install Web

All DADI platform microservices are available from [NPM](https://www.npmjs.com/). To add *Web* to your project as a dependency:

```bash
$ cd my-app
$ npm install --save @dadi/web
```

As part of the installation process of the `@dadi/web` package, several files and folders were added to your project:

* `config/config.development.json`
* `workspace/`
* `server.js`

This enables Web to boot straight out of the box with a default ‘blog’ style configuration and some suggestions of next steps. Start the server and open a browser to begin.

### Start the server

With the `server.js` in the root of your application, Web can be started from the command line simply by issuing the following command:

```bash
$ npm start
```

With the default configuration, our Web server is available at http://localhost:3001. Visit this URL in your browser to see a 'Welcome' page.

### Configuration

Web requires a configuration file specific to the application environment. For example in the production environment it will look for a file named `config.production.json`.

Configuration files live in a `config` folder in your application root, for example `config/config.development.json`. Web starts with a sensible default configuration, but you can find full configuration documentation at http://docs.dadi.tech/web/getting-started/configuration/.

#### Run Web as a service

To run your Web application in the background as a service, install Forever and Forever Service:

```bash
$ npm install forever forever-service -g

$ forever-service install -s server.js -e NODE_ENV=production web --start
```

You can now interact with the `web` service using the following commands:

```bash
$ [sudo] service web start
$ [sudo] service web stop
$ [sudo] service web status
$ [sudo] service web restart
```

> Note: the environment variable `NODE_ENV=production` must be set to the required configuration version matching the configuration files available in the `config` directory.


## Links
* [Web Documentation](https://docs.dadi.cloud/web/)

## Licence

DADI is a data centric development and delivery stack, built specifically in support of the principles of API first and COPE.

Copyright notice<br />
(C) 2018 DADI+ Limited <support@dadi.tech><br />
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
