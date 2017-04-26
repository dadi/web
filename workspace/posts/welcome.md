---
date: 2016-05-10
title: Successfully installed and running!
author: The DADI Team
---

We've setup a sample blog configuration for you to explore and modify. For example, this post can be found in `workspace/posts/welcome.md`

The next step is probably to explore the [documentation](http://docs.dadi.tech) and the source code to our site, [DADI.tech](https://dadi.tech) as an [example project](https://github.com/dadi/dadi.tech).

### Things to try

1. You are reading `workspace/posts/welcome.md`. Try changing something in this file, save and refresh to see it updated here.

2. Create your first datasource. Here is an example of a markdown based one, which is serving the content you are reading.

```json
{
  "datasource": {
    "key": "posts",
    "name": "Blog posts as markdown files.",
    "source": {
      "type": "markdown",
      "path": "./posts"
    },
    "paginate": true,
    "count": 5,
    "sort": {
      "date": -1
    },
    "requestParams": [
      {
        "param": "handle", "field": "handle"
      }
    ]
  }
}
```

3. Learn more about [DADI API](https://dadi.tech/platform/api/) and how you can use it with your new installation of <em>DADI Web</em>