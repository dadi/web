### Page Specification

#### Example Page Specification

```js
	{
	    "page": {
        "name": "Car Reviews",
        "description": "A collection of car reviews.",
        "language": "en"
	    },
	    "settings": {
	      "cache": true
	    },
	    "route": {
	    	"path": "/car-reviews/:make/:model", // route configuration (optional)
	    },
	    "contentType": "application/xml", // (optional, default = text/html)
	    "template": "car-reviews.dust", // template filename (optional)
	    "datasources": [ // specifies attached data sources
        "car-makes",
        "car-models"
	    ],
	    "events": [ ] // specifies optional attached events
	}

```

#### Routing

The `route` property is used to specify the URL for the page. The default value for this property is a route matching the page name. For example if the page name is `books` the route becomes `/books`.

##### Named Parameters
It is possible to specify a route containing named parameters which can be utilised by the datasources attached to the page.

For example the route `/cars/:make/:model` will ensure this page is loaded for any request matching this format. Rosecomb will extract the `:make` and `:model` parameters making them available as filter parameters in the page's attached datasources.

The following URLs all match this page's route:

URL       | Named Parameters                 
:---------------|:---------------------------
/cars/ford/focus           |    :make = ford, :model = focus
/cars/nissan/pathfinder           |    :make = nissan, :model = pathfinder
/cars/bmw/3-series           |    :make = bmw, :model = 3-series

##### Optional Parameters

Parameters can be made optional by adding a question mark (?). 

For example the route `/cars/:make/:page?` will match requests in both the following formats:

URL       | Named Parameters                 
:---------------|:---------------------------
/cars/ford | :make = ford
/cars/ford/2 | :make = ford, :page = 2


#### More Information

 * See [Datasource Specification](datasource_specification.md) for more information regarding the use of named parameters.
 * Rosecomb uses the [Path to Regexp](https://github.com/pillarjs/path-to-regexp) library when parsing routes. More information on parameter usage can be found in the Github repository.
