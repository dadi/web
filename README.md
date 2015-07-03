![Rosecomb](rosecomb.png)

![Build Status](http://img.shields.io/badge/Release-0.1.2_Beta-green.svg?style=flat-square)&nbsp;[![License](http://img.shields.io/:License-MIT-blue.svg?style=flat-square)](http://dadi.mit-license.org)

## Contents

* [Overview](#overview)
* [Pages](docs/page_specification.md) 
* [Data sources](docs/datasource_specification.md) 
* [Setup and installation](#setup-and-installation)
* [Running the demo application](#running-the-demo-application)
* [Running the server](#running-the-server)

* [Configuration notes](#configuration-notes)
* [Further reading](#further-reading)
* [Development](#development)


## Overview

Rosecomb is built on Node.JS. It is a high performance schemaless templating layer designed in support of API-first development and the principle of COPE.

It can opperate as a stand alone platform or in conjunction with [Serama](https://github.com/bantam-framework/serama) as a full stack web application.

Rosecomb is part of [Bantam](https://github.com/bantam-framework/), a suite of components covering the full development stack, built for performance and scale.

Rosecomb is based on Node.JS, using latest stable versions.

### Terminology/Folder Structure

#### Page descriptors
These files describe the application's pages and the routes which load them. Data sources and events used by the page are specified within these files.

#### Pages
Pages are the main template files. Templating is based around the *dust* (http://akdubya.github.io/dustjs/) templating language.

#### Partials
These are reusable template files that may be referenced from the main page templates. Partials may also contain *dust* code and have access to the same data sources as the page they are included in.

#### Data sources
Data sources are the main link between Rosecomb and a Serama REST API or other third party end point. Data sources describe which endpoints to use, how to authenticate against that service, whether caching and pagination are enabled and can include default filters to pass to Serama. See [Datasource Specification](datasource_specification.md) for a sample data source.

Data sources are assigned to pages in the page descriptor file.

#### Events
These files add additional server side functionality to pages. Events are run after a page has loaded data from all of it's data sources, so they have access to the retrieved data.

See [Events](events.md) for more information and a sample event file.

Events are assigned to pages in the page descriptor file.

### xFunctionality

Rosecomb constantly monitors the workspace folder for changes modifies it's behaviour according to file changes.

New pages can be initialized by simply creating new files in `workspace/pages/{page name}.dust` and `workspace/pages/{page name}.json`

This will create a new page at *http://{url}/{page name}*

    
The page descriptor file ({page name}.json) describes the taxonomy and the interaction between Serama and Rosecomb.

Multiple datasource files (workspace/data-sources/{datasource name}.json) can be attached to a page. Each data source file descibes which Serama endpoint to use, which filters to use, how many records to return etc. A full option list can be found below.

Pages and data sources can also be created and modifyed through Rosecomb's authenticated API.

### More on Events

Events will add additional functionality to a page/dust template. Events will be server side JavaScript and can be attached to a page. If an event is attached to a page, that page should be able to access variables and values defined in that event. A good way to see this is as a workaround to implement logic to a logicless Dust template.

Use case:
A Rosecomb developer would like count how many people clicked on a 'plus' button.

To achieve this he has to create a new event and attach it to the page where he has the 'plus' button.

The developer then implements a code in the event which will look for specific event (i.e. POST buttonpressed) and inside this he will increase a counter stored in a text file.

The developer then returns the updated counter number from the event which is made accessible within the Dust template.

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
