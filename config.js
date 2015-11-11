var convict = require('convict');

// Define a schema
var conf = convict({
  app: {
    name: {
      doc: "The applicaton name",
      format: String,
      default: "Rosecomb (Repo Default)"
    }
  },
	server: {
    host: {
      doc: "Rosecomb IP address",
      format: '*',
      default: '0.0.0.0'
    },
    port: {
      doc: "port to bind",
      format: 'port',
      default: 8080
    },
    name: {
      doc: "The server name.",
      format: String,
      default: "Bantam (Rosecomb)"
    }
  },
	api: {
    host: {
      doc: "Serama IP address",
      format: '*',
      default: '0.0.0.0'
    },
    port: {
      doc: "port to bind",
      format: 'port',
      default: 8080
    }
  },
  auth: {
  	tokenUrl: {
      doc: "",
      format: String,
      default: "/token"
    },
    clientId: {
      doc: "",
      format: String,
      default: "rosecombClient"
    },
    secret: {
      doc: "",
      format: String,
      default: "superSecret"
    }
  },
  caching: {
    ttl: {
      doc: "",
      format: Number,
      default: 300
    },
    directory: {
      enabled: {
        doc: "",
        format: Boolean,
        default: true
      },
      path: {
        doc: "",
        format: String,
        default: "./cache/rosecomb"
      },
      extension: {
        doc: "",
        format: String,
        default: "html"
      }
    },
    redis: {
      enabled: {
        doc: "",
        format: Boolean,
        default: false
      },
      host: {
        doc: "",
        format: String,
        default: "tresting.qvhlji.ng.0001.euw1.cache.amazonaws.com"
      },
      port: {
        doc: "port to bind",
        format: 'port',
        default: 6379
      },
      password: {
        doc: "",
        format: String,
        default: ""
      }
    }
  },
  dust: {
  	cache: {
      doc: "Determines if Dust caching is enabled",
      format: Boolean,
      default: true
    },
    debug: {
      doc: "",
      format: Boolean,
      default: true
    },
    debugLevel: {
      doc: "",
      format: String,
      default: "DEBUG"
    },
    whitespace: {
      doc: "",
      format: Boolean,
      default: false
    }
  },
  headers: {
    useGzipCompression: {
      doc: "If true, uses gzip compression and adds a 'Content-Encoding:gzip' header to the response.",
      format: Boolean,
      default: false
    },
    cacheControl: {
      doc: "A set of custom cache control headers for different content types. For example 'cacheControl': { 'text/css': 'public, max-age=1000' }",
      format: Object,
      default: {
        "text/css": "public, max-age=86400",
        "text/javascript": "public, max-age=86400",
        "application/javascript": "public, max-age=86400"
      }
    }
  },
  logging: {
  	enabled: {
      doc: "If true, logging is enabled using the following settings.",
      format: Boolean,
      default: true
    },
    path: {
      doc: "The absolute or relative path to the directory for log files.",
      format: String,
      default: "./log"
    },
    filename: {
      doc: "The name to use for the log file, without extension.",
      format: String,
      default: "rosecomb"
    },
    extension: {
      doc: "The extension to use for the log file.",
      format: String,
      default: "log"
    },
    accessLog: {
      enabled: {
        doc: "If true, HTTP access logging is enabled. The log file name is similar to the setting used for normal logging, with the addition of 'access'. For example `rosecomb.access.log`.",
        format: Boolean,
        default: true
      },
      fileRotationPeriod: {
        doc: "The period at which to rotate the access log file. This is a string of the format '$number$scope' where '$scope' is one of 'ms' (milliseconds), 'h' (hours), 'd' (days), 'w' (weeks), 'm' (months), 'y' (years). The following names can be used 'hourly' (= '1h'), 'daily (= '1d'), 'weekly' ('1w'), 'monthly' ('1m'), 'yearly' ('1y').",
        format: String,
        default: "1d"  // daily rotation
      },
      fileRetentionCount: {
        doc: "The number of rotated log files to keep.",
        format: Number,
        default: 7    // keep 7 back copies
      },
      kinesisStream: {
        doc: "An AWS Kinesis stream to write to log records to.",
        format: String,
        default: ""
      }
    },
    slack: {
      enabled: {
        doc: "If true, error logs are sent to the specified Slack channel.",
        format: Boolean,
        default: false
      },
      webhook_url:  {
        doc: "The web hook URL you have configured for your Slack integration.",
        format: String,
        default: ""
      },
      channel:  {
        doc: "The Slack channel to post errors to.",
        format: String,
        default: "#rosecomb-status"
      },
      username: {
        doc: "The username to display when posting errors to Slack.",
        format: String,
        default: "Rosecomb"
      },
      icon_emoji: {
        doc: "The emoji to display when posting errors to Slack.",
        format: String,
        default: ":scream_cat:"
      }
    }
  },
  rewrites: {
    datasource: {
      doc: "",
      format: String,
      default: ""
    },
    path: {
      doc: "",
      format: String,
      default: "workspace/routes/rewrites.txt"
    },
    forceTrailingSlash: {
      doc: "",
      format: Boolean,
      default: false
    }
  },
  env: {
    doc: "The applicaton environment.",
    format: ["production", "development", "test", "qa"],
    default: "development",
    env: "NODE_ENV",
    arg: "node_env"
  },
  debug: {
    doc: "If true, debug mode is enabled and a panel containing the JSON loaded for each page is displayed alongside the normal content.",
    format: Boolean,
    default: false
  },
  allowJsonView: {
    doc: "If true, allows appending ?json=true to the querystring to view the raw JSON output for each page.",
    format: Boolean,
    default: false
  }
});

// Load environment dependent configuration
var env = conf.get('env');
conf.loadFile('./config/config.' + env + '.json');

// Perform validation
conf.validate({strict: false});

module.exports = conf;
