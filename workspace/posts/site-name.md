---
date: 2016-04-05
title: How to change the site name in the header
handle: site-name
author: The DADI Team
---

To change the name of this example site, look into the `config/config.development.json` file.

```JSON
"global": {
	"site": "Your site name",
	"description": "An exciting beginning."
}
```

Any variables you add in the `global` object will be available for use in your page templates. 