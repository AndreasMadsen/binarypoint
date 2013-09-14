#binarypoint

> Split a binary duplex stream up at its null bytes

## Installation

```sheel
npm install binarypoint
```

## Documentation

This is a duplex stream there wraps a binary duplex stream. The `binarypoint`
then splits the binary data up at its null bytes (`0x00`). It also adds the
null byte when you write to it.

In reality this is an object stream, since the buffer objects don't get
concatenated, but it acts very much like a buffer stream and you can use it
at such.

**Features:**

* The module supports backpresure on the underlying socket.
* Allows for smart encodeing, by not pre converting the strings to buffers.
* Relay close event on the underlying socket.
* Relay error events on the underlying socket.

**Example:**

```JavaScript
var binarypoint = require('binarypoint');
var socket = net.connect(5000);

var spliter = binarypoint(socket);

spliter.once('readable', function () {
  // socket rescived two messages as "hallo\0world\0".
  // those messages got split up. Note that if the
  // socket ended, the last null byte is optional.
  spliter.read() // <Buffer 68 61 6c 6c 6f>
  spliter.read() // <Buffer 77 6f 72 6c 64>
});

// Writes: "hallo\0Again\0".
spliter.write('hallo');
spliter.write('again');
spliter.end();
```

##License

**The software is license under "MIT"**

> Copyright (c) 2013 Andreas Madsen
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
