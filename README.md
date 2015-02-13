# Rosecomb

### What is Rosecomb?

Rosecomb is a high performance schemaless templating layer designed in support of API-first development and the principle of COPE.

It can opperate as a stand alone platform or in conjunction with Serama as a full stack web application.

### Environment

Rosecomb is based on Node.JS, using latest stable versions.

### Terminology

`Pages` - Pages are the main template files. Templating is based around the *dust* (http://akdubya.github.io/dustjs/) templating language.

`Page descriptors` - These files are describing the pages. Page taxonomy can be set here as well which data sources and events does the page uses.

`Partials` - These are reusable *dust* snippets. They can be included in the main page files.

`Data sources` - Data sources are the main link between Serama (REST API [and other third party end points]) and Rosecomb. They describe which endpoints to use, if caching is enabled, pagination and filters. A sample file is incuded in the end of this document. These are assigned to the page in the page descriptor file.

`Events` - These files add additional server side functionality to pages. These are assigned to the page in the page descriptor file.

### Functionality

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
### Example files

#### workspace/pages/articles.json
```js
  {
      "page": {
          "name": "Articles", // Page title to be displayed in gui, also available for page file
          "description": "A collection of articles.",
          "language": "en"
      },
      "datasources": [ // Sets all attached data sources
          "articles"
      ],
      "events": [ // Sets all attached events
          "testa"
      ]
  }
```

####workspace/data-sources/articles.json
```js
  {
    "datasource": {
      "key": "articles", // Name of data-source this is used in the page descriptor to attach a data source
      "name": "Articles DS", // This is the name of the data source, it will be displayed on the front-end of the gui
      "endpoint": "editorial/articles", // Link to endpoint on Serama
      "cache": false, // Sets caching enabled or disabled on Serama
  
      "paginate": true, // Turns pagination on and off on Serama
  
      "filters": [ // List of filters - See Serama brief for more info
        { "category": ["blog"] }
      ],
  
      "count": 5, // Number of items Serama has to return
      "sort": { // Order of the result set
        "field": "_id",
        "order": "desc"
      },

      "fields": ["title", "author"] // Limit fields to return
    }
  }
```

### Installation

	[sudo] npm install

### Running the server

Rosecomb expects the Serama API to be running locally on port 3001. Start the Serama server before running Rosecomb.

	npm start


### How it works

The `workspace` directory contains the pages, partials and datasources required to display data retrieved from the Serama API.

Each page is defined in a JSON file specifying the datasources that will retrieve the data for display.

A datasource is a JSON file specifying the API endpoint to connect to along with parameters to use when querying the API.

### Example

If a request is made to Rosecomb running on `http://localhost:3000/articles` the application takes the `articles` parameter and looks for an `articles.json` page descriptor in `workspace/pages`. Any datasources that page descriptor specifies are loaded from `workspace/data-sources` and the data is retrieved from the datasource's API endpoint. In order to render the returned data to the browser, a Dust template must exist in `workspace/pages` with the same name as the requested page, e.g. `articles.dust`.
