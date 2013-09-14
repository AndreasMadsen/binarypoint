
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
  var start = 0;

  // Optimization:
  // * Since Buffer.concat copy the buffer in any case we skip that if there
  //   is no reason to copy.
  // * Also don't scan the bytes there has already been scaned
  if (this._buffer.length !== 0) {
    start = this._buffer.length;
    chunk = Buffer.concat([this._buffer, chunk]);
  }

  var total = chunk.length;
  var nopause = true;
  var lastindex = 0;
  for (var i = start; i < total; i++) {
    if (chunk[i] !== 0x00) continue;

    // To make things simple just push until the buffer is empty and let
    // node buffer the messages internally. The bytes will in the memory
    // somewhere anyway.
    nopause = this.push(chunk.slice(lastindex, i));
    lastindex = i + 1;
  }

  // At last slice the remaining part of the buffer and keep only that
  this._buffer = chunk.slice(lastindex);

  // Also pause the stream if it makes sence, so we don't consume more bytes
  // than we ought to.
  if (!nopause) this._socket.pause();
};

BinaryPoint.prototype._end = function () {
  // if the buffer contains something, thread that as a message and flush
  // the buffer
  if (this._buffer.length !== 0) {
    this.push(this._buffer);
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

var NULLBYTE_BUFFER = new Buffer([0x00]);

BinaryPoint.prototype._write = function (binary, encoding, done) {
  // Optimization:
  // * When running in objectMode, encoding is not always zero, this also allows
  //   for blazing fast ascii writing, if the user chose to care about that.
  this._socket.write(binary, encoding);

  // Optimization:
  // * Yes, the first write might have requested a pause, but again we might
  //   as well flush 0x00 now and let node buffer it. This way we skip an early
  //   check.
  // * But do wait for the drain event in cause no more should be written.
  // * Always just fast ascii writing for the 0x00 buffer.
  if (this._socket.write(NULLBYTE_BUFFER, 'ascii')) {
    done(null);
  } else {
    this._socket.once('drain', done);
  }
};
