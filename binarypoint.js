
var util = require('util');
var stream = require('stream');

function BinaryPoint(socket) {
  if (!(this instanceof BinaryPoint)) return new BinaryPoint(socket);
  stream.Duplex.call(this, {
    // Prevent concatenation of buffers there needs to be splited with 0x00
    objectMode: true,
    // Prevent 16k buffer objects from being stored, just 16
    highWaterMark: 16
  });
  var self = this;

  // Store the socket
  this._socket = socket;

  // Handle data chunks
  this._awaitSize = true;
  this._messageSize = 0;
  this._buffer = new Buffer(0);
  this._socket.on('data', function (chunk) { self._data(chunk); });
  this._socket.once('end', function (chunk) { self._end(); });

  // Relay end call
  this.once('finish', this._socket.end.bind(this._socket));

  // Relay events
  this._socket.once('close', this.emit.bind(this, 'close'));
  this._socket.on('error', this.emit.bind(this, 'error'));
}
module.exports = BinaryPoint;
util.inherits(BinaryPoint, stream.Duplex);

BinaryPoint.prototype._data = function (chunk) {
  // Optimization:
  // * Since Buffer.concat copy the buffer in any case we skip that if there
  //   is no reason to copy.
  if (this._buffer.length !== 0) {
    chunk = Buffer.concat([this._buffer, chunk]);
  }

  var total = chunk.length;
  var lastindex = 0;
  var nextindex = 0;
  var more = true;
  while(true) {
    // Should look for size infomation
    if (this._awaitSize === true) {
      nextindex = lastindex + 2;

      // Size information found, so read it and offset the index
      if (total >= nextindex) {
        this._messageSize = chunk.readUInt16BE(lastindex);
        this._awaitSize = false;
        lastindex = nextindex;
      } else {
        break;
      }
    }

    // Slice out message if the size criteria was met
    nextindex = lastindex + this._messageSize;
    if (total >= nextindex) {
      more = this.push(chunk.slice(lastindex, nextindex));
      this._awaitSize = true;
      lastindex = nextindex;
    } else {
      break;
    }
  }

  // At last cleanup the buffer, by sliceing out the consumed part
  this._buffer = chunk.slice(lastindex);

  // Also pause the stream if it makes sence, so we don't consume more bytes
  // than we ought to.
  if (!more) this._socket.pause();
};

BinaryPoint.prototype._end = function () {
  // if the buffer contains something, the the size criteria wasn't met and
  // the message must be incomplete. So just clear the buffer.
  if (this._buffer.length !== 0) {
    this._buffer = new Buffer(0);
  }

  // No more data
  this.push(null);
};

// Data we don't yet have has been requested, so resume the socket in case it
// was paused.
BinaryPoint.prototype._read = function () {
  this._socket.resume();
};

BinaryPoint.prototype._write = function (binary, encoding, done) {
  // Optimization:
  // * When running in objectMode, encoding is not always binary, this also allows
  //   for blazing fast ascii writing, if the user chose to care about that.
  if (Buffer.isBuffer(binary) === false) {
    binary = new Buffer(binary, encoding);
  }

  // Write the size information
  var sizeBuffer = new Buffer(2);
      sizeBuffer.writeUInt16BE(binary.length, 0);
  this._socket.write(sizeBuffer);

  // Optimization:
  // * Yes, the first write might have requested a pause, but again we might
  //   as well flush the message now and let node buffer it. This way we skip a
  //   complex state check.
  // * But do wait for the drain event in cause no more should be written.
  if (this._socket.write(binary)) {
    done(null);
  } else {
    this._socket.once('drain', done);
  }
};
