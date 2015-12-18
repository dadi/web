var AWS = require('aws-sdk')
var KinesisStream = require('aws-kinesis-writable');
var kinesalite = require('kinesalite');
var path = require('path');
var should = require('should');
var sinon = require('sinon');
var bunyan = require('bunyan');
var stringify = require('json-stringify-safe');
var log = require(__dirname + '/../../dadi/lib/log');
var config = require(path.resolve(__dirname + '/../../config.js'));

const STREAM_NAME = 'rosecomb_test';
const REGION = 'us-east-1';

AWS.config.region = REGION;
// AWS.config.accessKeyId = read from environment variables or ~/.aws/credentials
// AWS.config.secretAccessKey = read from environment variables or ~/.aws/credentials

var kinesis;

describe('Logger', function (done) {

  before(function(done) {

    // for now, ignore
    return done();

    // Start a local Kinesis server
    var kinesaliteServer = kinesalite({path: './test/kinesis-test-db', createStreamMs: 1});

    // Listen on port 4567
    kinesaliteServer.listen(4567, function (err) {
      if (err) throw err;
      log.info('Kinesalite started on port 4567')

      // Create an AWS Kinesis connection
      kinesis = new AWS.Kinesis({region: REGION, /*credentials: { accessKeyId: AWS.config.accessKeyId, secretAccessKey: AWS.config.secretAccessKey },*/ endpoint: 'http://localhost:4567'})
      log.info('Kinesis client created');

      var params = {
        ShardCount: 1,
        StreamName: STREAM_NAME
      };

      kinesis.createStream(params, function(err, data) {
        if (err) {
          console.log(err, err.stack);
          log.error(err);
        }
        else {
          log.info('Stream created: ' + STREAM_NAME);
        }
        done();
      });
    })
  })

  beforeEach(function (done) {

    // for now, ignore
    return done();

    get_iterator(function (err, data) {
      if (err) return done(err);
      iterator = data.ShardIterator;
      done();
    });
  });

  after(function(done) {

    // for now, ignore
    return done();

    kinesis.listStreams({}, function(err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
        log.error(err);
      }

      var streams = data.StreamNames;

      // console.log(streams)

      if (streams.length) {

        // delete
        kinesis.deleteStream({StreamName: STREAM_NAME}, function(err, data) {
          if (err) {
            console.log(err, err.stack); // an error occurred
            done();
          }
          else {
            setTimeout(function() {
              log.info('Stream deleted: ' + STREAM_NAME);           // successful response
              done();
            }, 500);
          }
        })
      }
    })
  })

  it('should log to a kinesis stream if configured', function (done) {

    // for now, ignore
    return done();

    kinesis.listStreams({}, function(err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
        log.error(err);
      }

      var streams = data.StreamNames;

      // console.log(streams)

      if (streams.length) {

        // Create a log stream
        log.get().addStream(
          {
            name: 'Kinesis Log Stream',
            level: 'info',
            stream: new KinesisStream ({
              // accessKeyId:     AWS.config.accessKeyId,
              // secretAccessKey: AWS.config.secretAccessKey,
              region:          REGION,
              streamName:      STREAM_NAME,
              partitionKey:    'Rosecomb'
            })
          }
        );

        log.get().streams[2].stream._kinesis = kinesis;

        for (var i = 1; i < 50; i++) {
            log.info('logging message #' + i);
        }

        setTimeout(function() {

          var params = { ShardIterator: iterator, Limit: 1 }

          kinesis.getRecords(params, function (err, data) {
            if (err) return done(err);
            //console.log(data);
            var records = data.Records;
            records.forEach(function(r) {
              //console.log(r);
              var d = new Buffer(r.Data, 'base64').toString('utf8');
              var json = JSON.parse(d);
              json.msg.should.eql('logging message #1');
              done();
            });

          });

          // kinesis.describeStream(params, function(err, data) {
          //   if (err) console.log(err, err.stack); // an error occurred
          //   else     {
          //     console.log(data);           // successful response
          //     done();
          //   }
          // });

        }, 500)
      }

    });

  });

});

var iterator;
function get_iterator (callback) {
  kinesis.describeStream({
    StreamName: STREAM_NAME
  }, function (err, stream) {
    if (err) return callback(err);
    var params = {
      ShardId: stream.StreamDescription.Shards[0].ShardId,
      ShardIteratorType: 'LATEST',
      StreamName: STREAM_NAME
    };
    kinesis.getShardIterator(params, callback);
  });
}
