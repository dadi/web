var convict = require('convict');

// Define a schema
var conf = convict({
	server: {
    host: {
      doc: "Rosecomb IP address",
      format: 'ipaddress',
      default: '0.0.0.0'
    },
    port: {
      doc: "port to bind",
      format: 'port',
      default: 8080
    }
  },
	api: {
    host: {
      doc: "Serama IP address",
      format: 'ipaddress',
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
    enabled: {
      doc: "Determines if caching is enabled",
      format: Boolean,
      default: true
    },
    ttl: {
      doc: "",
      format: Number,
      default: 300
    },
    directory: {
      doc: "",
      format: String,
      default: "./cache/rosecomb/"
    },
    extension: {
      doc: "",
      format: String,
      default: "html"
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
  logging: {
  	enabled: {
      doc: "Determines if logging is enabled",
      format: Boolean,
      default: true
    },
    level: {
      doc: "",
      format: String,
      default: "DEBUG"
    },
    path: {
      doc: "",
      format: String,
      default: "./log"
    },
    filename: {
      doc: "",
      format: String,
      default: "rosecomb"
    },
    dateFormat: {
      doc: "",
      format: String,
      default: ""
    },
    extension: {
      doc: "",
      format: String,
      default: "log"
    },
    messageFormat: {
      doc: "",
      format: String,
      default: "<%= label %> - <%= date %> - <%= message %>"
    }
  },
  env: {
    doc: "The applicaton environment.",
    format: ["production", "development", "test", "staging"],
    default: "development",
    env: "NODE_ENV",
    arg: "node_env"
  },
  ip: {
    doc: "The IP address to bind.",
    format: "ipaddress",
    default: "127.0.0.1",
    env: "IP_ADDRESS",
  },
  port: {
    doc: "The port to bind.",
    format: "port",
    default: 0,
    env: "PORT"
  }
});

// Load environment dependent configuration
var env = conf.get('env');
conf.loadFile('./config/config.' + env + '.json');

// Perform validation
conf.validate({strict: false});

module.exports = conf;