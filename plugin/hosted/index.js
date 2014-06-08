var express		= require('express');
var fs			= require('fs');
var io			= require('socket.io');
var crypto		= require('crypto');
var app			= express.createServer();
var staticDir	= express.static;
var io			= io.listen(app);
var request = require('request');
var default_slides = require('./default_response.json');
var error_slides = require('./error_response.json');

var opts = {
	port: process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
  ipAddr : process.env.IP_ADDR || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1',
  web_host: process.env.REVEAL_WEB_HOST || process.env.OPENSHIFT_APP_DNS || 'localhost:8080',
  socket_host: process.env.REVEAL_SOCKET_HOST || process.env.OPENSHIFT_APP_DNS || 'localhost',
  socket_secret : process.env.REVEAL_SOCKET_SECRET,
	baseDir : __dirname + '/../../'
};
var slideshow_template = fs.readFileSync(opts.baseDir + '/index.html');

var createHash = function(secret) {
	var cipher = crypto.createCipher('blowfish', secret);
	return(cipher.final('hex'));
};

app.configure(function() {
	[ 'css', 'js', 'plugin', 'lib' ].forEach(function(dir) {
		app.use('/' + dir, staticDir(opts.baseDir + dir));
	});
});

var render_slideshow = function(gist) {
  for(var i in gist.files){
    var title = i;
    var slides = gist.files[i].content;
    var description = gist.description;
    var user = gist.owner.login;
    break;
  }
  return slideshow_template.toString()
                           .replace(/\{\{slides\}\}/, slides)
                           .replace(/hosted: {}/, getClientConfig())
                           .replace(/\{\{title}}/, title)
                           .replace(/\{\{user}}/, user)
                           .replace(/\{\{description}}/, description);
};

var get_slides = function(req, res, next) {
  if(typeof(req.params.gist_id) !== "undefined"){
    var gist_api_url = "https://api.github.com/gists/";
    var gist_id = req.params.gist_id;
    request({
      url: gist_api_url + gist_id, 
      headers: {'User-Agent': 'request'}
    },function (error, response, api_response) {
      if (!error && response.statusCode == 200) {
        gist = JSON.parse(api_response);
      }else{
        gist = error_slides;
      }
      return res.send(render_slideshow(gist), 200, {'Content-Type': 'text/html'});
    });
  }else{
    return res.send(render_slideshow(default_slides), 200, {'Content-Type': 'text/html'});
  }
};

app.get("/", get_slides);
app.get("/:gist_id", get_slides);

app.get("/token", function(req,res) {
  res.send('Information about setting up your presentation environment is available in the server logs');
});

io.sockets.on('connection', function(socket) {
  var checkAndReflect = function(data){
    if (typeof data.secret == 'undefined' || data.secret == null || data.secret === '') {console.log('Discarding mismatched socket data');return;} 
    if (createHash(data.secret) === data.socketId) {
      data.secret = null; 
      socket.broadcast.emit(data.socketId, data);
      console.dir(data);
    }else{
      console.log('Discarding mismatched socket data:');
      console.dir(data);
    };      
  };
	socket.on('slidechanged', checkAndReflect);
  socket.on('navigation', checkAndReflect);
});

var printTokenUsageInfo = function(token){
  var hostnm = opts.web_host;
  if(!process.env.OPENSHIFT_APP_NAME){
    //Printing generic hosted / local host info:
    console.log("Set your broadcast token as an environment variable and restart your server:");
    console.log("  export REVEAL_SOCKET_SECRET='"+token.socket_secret+"'");
    console.log("  npm start");
    console.log("Then, configure your browser as a presentation device by loading the following URL:");
    console.log("  http://" + hostnm + "/?setToken=" + token.socket_secret);
  }else{
    var appnm = process.env.OPENSHIFT_APP_NAME;

    //Printing OpenShift-specific usage info:
    console.log("Tell OpenShift to save this broadcast token and publish it as an environment variable:");
    console.log("  rhc env set REVEAL_SOCKET_SECRET="+token.socket_secret+" -a " + appnm);
    console.log("  rhc app restart " + appnm);
    console.log("Then, configure your browser as a presentation device by loading the following URL: ");
    console.log("  http://" + hostnm + "/?setToken=" + token.socket_secret);
  }
}

var getTokens = function(){
	var ts = new Date().getTime();
	var rand = Math.floor(Math.random()*9999999);
	var secret = opts.socket_secret || ts.toString() + rand.toString();
	var socket = createHash(secret);
  response = {"socket_secret": secret, "socket_id": socket};
  printTokenUsageInfo(response);
  return response;
};

var getClientConfig = function(){
  var tokens = getTokens();
  return "hosted:{ id: '"+tokens.socket_id+"', url: '"+opts.socket_host+"'}";
};

// Actually listen
app.listen(opts.port, opts.ipAddr);

var brown = '\033[33m',
	green = '\033[32m',
	reset = '\033[0m';

console.log( brown + "reveal.js:" + reset + " Multiplex running on port " + green + opts.port + reset );
