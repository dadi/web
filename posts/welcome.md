---
date: 2016-05-10
title: Successfully installed and running!
handle: welcome
author: The DADI Team
---

Explore the [documentation](http://docs.dadi.tech) and the source code to our site as an [example project](https://github.com/dadi/dadi.tech).

### Things to try

1. You are reading <em>posts/welcome-to-dadi.md</em>. Try changing something in this file, save and refresh to see it updated here.

2. Create your first datasource. Here is an example of a markdown based one:
```JSON
	{
	 "datasource": {
	   "key": "articles",
	   "name": "Latest blog posts.",
	   "source": {
	     "type": "markdown",
	     "path": "../posts"
	   },
	   "paginate": true,
	   "count": 10,
	   "sort": {
	     "date": -1
	   },
	   "requestParams": [
	     {
	       "param": "article", "field": "handle"
	     }
	   ]
	 }
	}
```

3. Learn more about [DADI API](https://dadi.tech/platform/api/) and how you can use it with your new installation of <em>DADI Web</em>