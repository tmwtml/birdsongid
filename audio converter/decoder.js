const Lame = require("node-lame").Lame;

var mkdirp = require('mkdirp');
    
mkdirp('./audio', function (err) {
    if (err) console.error(err)
    else console.log('pow!')
});

const decoder = new Lame({
    output: "./audio/test.wav"
}).setFile("./test.mp3");
 
decoder
    .decode()
    .catch(error => {
        console.log(error)
    });