### Page Specification

#### Example Page Specification

```js
	{
	    "page": {
				"key": "reviews",
        "name": "Car Reviews",
        "description": "A collection of car reviews.",
        "language": "en"
	    },
	    "settings": {
	      "cache": true,
				"beautify": false,
				"keepWhitespace": false
	    },
	    "route": {
	    	"paths": ["/car-reviews/:make/:model"],
	    	"constraint": ""
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

The `route.paths` property is used to specify the URLs that match the page. The default value for this property is a route matching the page name. For example if the page name is `books` the route property becomes:

```
"route": {
  	"paths": ["/books"]
}
```

##### Route Constraints

In the case of ambiguous routes it is possible to provide Rosecomb with a constraint function or datasource to check a matching route against some business logic or database records.

Returning `true` from a constraint instructs Rosecomb that this is the correct route.

Returning `false` from a constraint instructs Rosecomb to try the next matching route (or return a 404 if there are no further matching routes).

###### Constraint Functions

Constraint functions must be added to `workspace/routes/constraints.js`. In the following example a route has a dynamic parameter `content`. The constraint function `nextIfNewsOrFeatures` will check the value of the `content` parameter and return `false` if it matches "news" or "features.

_workspace/pages/movies.json_

```js
"route": {
	"paths": ["/movies/:content"],
	"constraint": "nextIfNewsOrFeatures"
},
```

_workspace/routes/constraints.js_

```js
module.exports.nextIfNewsOrFeatures = function (req, res, callback) {  
  if (req.params.content === 'news' || req.params.content === 'features' ) {
  	return callback(false);
  }
  else {
  	return callback(true);
  }
};
```

###### Constraint Datasources

An existing datasource can be used as the route constraint. The specified datasource must exist in `workspace/data-sources/`. The following examples have some missing properties for brevity.

_workspace/pages/manufacturer.json_

```js
"route": {
	"paths": ["/:manufacturer"],
	"constraint": "manufacturers"
},
```

_workspace/data-sources/manufacturers.json_

```js
{
	"datasource": {
		"key": "manufacturers",
		"name": "Car manufacturers datasource",
		"source": {
			"type": "remote",
			"protocol": "http",
			"host": "127.0.0.1",
			"port": "3000",
			"endpoint": "1.0/car/manufacturers"
		},
		"count": 1,
		"fields": { "name": 1, "_id": 0 },
		"requestParams": [
			{ "param": "manufacturer", "field": "name" }
		]
	}
}

```

In the above example a request for `http://www.example.com/nissan` will call the `manufacturers` datasource, using the `requestParams` to supply a filter to the endpoint. The request parameter `:manufacturer` will be set to `nissan` and the resulting datasource endpoint will become:

```
http://127.0.0.1:3000/1.0/car/manufacturers?filter={"name":"nissan"}
```

If there is a result for this datasource query, the constraint will return `true`, otherwise `false`.


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
