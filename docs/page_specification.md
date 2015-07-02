### Page Specification

#### Example Page Specification

```js
	{
	    "page": {
	        "name": "Car Reviews",
	        "description": "A collection of car reviews.",
	        "language": "en",
	        "cache": true
	    },
	    "route": "/car-reviews/:make/:model", // route configuration (optional)
	    "template": "car-reviews.dust", // template filename (optional)
	    "datasources": [ // specifies attached data sources
	        "car-makes",
	        "car-models"
	    ],
	    "events": [ ]
	}

```

#### Routing

The `route` property is used to specify the URL for the page. The default value for this property is a route matching the page name. For example if the page name is `books` the route becomes `/books`.

##### Named Parameters
It is possible to specify a route containing named parameters which can be utilised by the datasources attached to the page.

For example the route `/cars/:make/:model` will ensure this page is loaded for any request matching this format. Rosecomb will extract the `:make` and `:model` parameters making them available as filter parameters in the page's attached datasources.

The following URLs all match this page's route:

```
/cars/ford/focus -> named parameters :make = ford, :model = focus
/cars/nissan/pathfinder -> named parameters :make = nissan, :model = pathfinder
/cars/bmw/3-series -> named parameters :make = bmw, :model = 3-series
```

See [Datasource Specification](datasource_specification.md) for more information regarding the use of named parameters.

