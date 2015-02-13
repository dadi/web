rosecomb
========

Templating layer concept for Bantam. Node.


### Install

	npm install

### Run

Rosecomb expects the Serama API to be running locally on port 3001. Start the Serama server before running Rosecomb.

	npm start


### How it works

The `workspace` directory contains the pages, partials and datasources required to display data retrieved from the Serama API.

Each page is defined in a JSON file specifying the datasources that will retrieve the data for display.

A datasource is a JSON file specifying the API endpoint to connect to along with parameters to use when querying the API.

### Example

If a request is made to Rosecomb running on `http://localhost:3000/articles` the application takes the `articles` parameter and looks for an `articles.json` page descriptor in `workspace/pages`. Any datasources that page descriptor specifies are loaded from `workspace/data-sources` and the data is retrieved from the datasource's API endpoint. In order to render the returned data to the browser, a Dust template must exist in `workspace/pages` with the same name as the requested page, e.g. `articles.dust`.
