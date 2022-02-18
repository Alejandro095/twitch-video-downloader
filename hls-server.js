var httpAttach = require("http-attach");
var HLSServer = require("hls-server");
var http = require("http");

const vodID = 800558240;
const resolution = "1080p60";

var server = http.createServer();
var hls = new HLSServer(server, {
    path: "/streams", // Base URI to output HLS streams
    dir: `./downloads/videos/${vodID}/hls/${resolution}/` // Directory that input files are stored
});

httpAttach(server, (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
});

server.listen(8000);

console.log("Server is ready on: http://localhost:8000/player.html");
console.log("Stream link on: http://localhost:8000/streams/index.m3u8");
