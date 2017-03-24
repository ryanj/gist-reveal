var express		= require('express');
var fs			= require('fs');
var crypto		= require('crypto');
var cc                  = require('config-multipaas');
var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);
var path    = require('path');
var request = require('request');
var sanitizeHtml = require('sanitize-html');
var mkdirp  = require('mkdirp');
var rate_limit_slides = require('./rate_limit_response.json');
var default_slides = require('./default_response.json');
var error_slides = require('./error_response.json');
var slideshow_template = fs.readFileSync( __dirname + '/index.html');
var sanitize = function(slideshow_content){
  return sanitizeHtml(slideshow_content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','section','h1','h2','aside','span','hr','br','div']),
    allowedAttributes: {
      'h1': ['class','style'],
      'h2': ['class','style'],
      'h3': ['class','style'],
      'h4': ['class','style'],
      'h5': ['class','style'],
      'h6': ['class','style'],
      'p': ['class','style'],
      'div': ['class','style'],
      'ol': ['class','style'],
      'ul': ['class','style'],
      'li': ['class','style'],
      'pre': ['class','style'],
      'dl': ['class','style'],
      'dt': ['class','style'],
      'dd': ['class','style'],
      'table': ['class','style'],
      'tr': ['class','style'],
      'td': ['class','style'],
      'span': ['class','style'],
      'aside': ['class'],
      'code': ['class','style','contenteditable'],
      'a': ['href', 'name', 'target', 'style','class'],
      'img': ['src','class','style'],
      'section': ['data-markdown', 'id', 'data-state', 'data-transition', 'data-background-transition', 'data-background']
    }
})}
var config = cc({
  REVEAL_SOCKET_SECRET : process.env.REVEAL_SOCKET_SECRET || (Math.floor(Math.random()*1000).toString() + new Date().getTime().toString())
, DEFAULT_GIST : process.env.DEFAULT_GIST || 'af84d40e58c5c2a908dd'
, REVEAL_THEME : process.env.REVEAL_THEME || '450836bbaebcf4c4ae08b331343a7886'
, GIST_THEMES : process.env.GIST_THEMES || "true"
, GH_CLIENT_ID : process.env.GH_CLIENT_ID
, GH_CLIENT_SECRET : process.env.GH_CLIENT_SECRET
, GA_TRACKER : process.env.GA_TRACKER
, REVEAL_WEB_HOST : process.env.REVEAL_WEB_HOST || process.env.OPENSHIFT_APP_DNS || 'localhost:8080'
, TEMPLATE_LOGO_TEXT : process.env.TEMPLATE_LOGO_TEXT || "Runs on Kubernetes"
, TEMPLATE_LOGO_IMG : process.env.TEMPLATE_LOGO_IMG || "img/runsonk8s.svg"
, TEMPLATE_LOGO_URL : process.env.TEMPLATE_LOGO_URL || "https://github.com/ryanj/gist-reveal#running-gist-revealit"
, TEMPLATE_GIST_TEXT : process.env.TEMPLATE_GIST_TEXT || "Presentation Source"
, TEMPLATE_GIST_IMG : process.env.TEMPLATE_GIST_IMG || "img/presentation_source.svg"
, TEMPLATE_GIST_URL : process.env.TEMPLATE_GIST_URL || "https://gist.github.com/"
});
var createHash = function(secret) {
	var cipher = crypto.createCipher('blowfish', secret);
	return(cipher.final('hex'));
};
var ga_tracker_html = function(tracker_id){
  if(typeof(tracker_id) !== 'undefined'){
    return "<script>(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){\n" + 
    "(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),\n" + 
    "m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)\n" + 
    "})(window,document,'script','//www.google-analytics.com/analytics.js','ga');\n" + 
    "ga('create', '"+tracker_id+"', 'auto');\n" + 
    "ga('send', 'pageview');</script>";
  }else{
    return "";
  }
};

var render_slideshow = function(gist, theme, cb) {
  for(var i in gist.files){
    if( gist.files[i].type == "text/html" || gist.files[i].type.indexOf('image' < 0 ) ){
      var title = sanitize(i);
      var slides = sanitize(gist.files[i].content);
      var description = sanitize(gist.description);
      var user = gist.owner.login;
      break;
    }
  }
  get_theme(theme, function(themename){
    var index = cb(slideshow_template.toString()
                           .replace(/\{\{slides}}/, slides)
                           .replace(/hosted: {}/, getClientConfig())
                           .replace(/\{\{title}}/, title)
                           .replace(/\/\/\{\{ga-tracker}}/, ga_tracker_html(config.get('GA_TRACKER')))
                           .replace(/\{\{theme}}/, themename)
                           .replace(/\{\{template_logo_url}}/, config.get('TEMPLATE_LOGO_URL'))
                           .replace(/\{\{template_logo_text}}/, config.get('TEMPLATE_LOGO_TEXT'))
                           .replace(/\{\{template_logo_img}}/, config.get('TEMPLATE_LOGO_IMG'))
                           .replace(/\{\{template_gist_url}}/, config.get('TEMPLATE_GIST_URL')+gist.id)
                           .replace(/\{\{template_gist_text}}/, config.get('TEMPLATE_GIST_TEXT'))
                           .replace(/\{\{template_gist_img}}/, config.get('TEMPLATE_GIST_IMG'))
                           .replace(/\{\{user}}/, user)
                           .replace(/\{\{description}}/, description)
    )
    return index;
  });
};

var install_theme = function(gist){
  var title, data;
  var theme_folder = path.resolve('css','theme',gist.id);
  console.log("installing gist: "+gist.id);
  mkdirp(theme_folder);
  for(var i in gist.files){
    filenm = gist.files[i].filename;
    data = gist.files[i].content;
    if( gist.files[i].type == "text/css"){
      filename = path.resolve('css','theme',gist.id,gist.id+".css")
      fs.writeFile(filename, data, function(err){
        console.log('theme installed: '+gist.id);
      });
    }else{
      filename = path.resolve('css','theme',gist.id,filenm)
      request({url: gist.files[i].raw_url}).pipe(fs.createWriteStream(filename)).on('error', function(err) {
          console.log(err)
      })
    }
  }
}

var get_theme = function(gist_id, cb) {
  if( !config.get('GIST_THEMES') ){
    // if theme installation is disabled, return immediately
    cb(gist_id)
  }
  var theme_folder = path.resolve( 'css','theme', gist_id );
  //if theme is found locally, return gist_id;
  fs.stat( theme_folder, function(err, stats){
    if(!err){
      //console.log("not installing locally available theme: " + gist_id);
      cb(gist_id+'/'+gist_id);
    }else{
      //console.log("installing css theme: " + gist_id);
      get_gist(gist_id, function(error, response, api_response){
        //cache the content
        if (!error && response.statusCode == 200) {
          gist = JSON.parse(api_response);
          install_theme(gist);
          console.log("gist retrieved : " + gist_id);
          cb(gist_id+'/'+gist_id)
        }else{
          //not found
          console.log("gist not found");
          cb(gist_id)
        }
      })
    }
  })
}

var get_slides = function(req, res, next) {
  var gist_id = req.params.gist_id || req.query.gist_id || config.get('DEFAULT_GIST');
  var theme = req.query['theme'] || config.get('REVEAL_THEME');
  get_gist(gist_id, function (error, response, api_response) {
    if (!error && response.statusCode == 200) {
      gist = JSON.parse(api_response);
    }else if (response.statusCode == 403){
      gist = rate_limit_slides;
    }else{
      gist = error_slides;
    }
    render_slideshow(gist, theme, function(slides){
      res.send(slides);
      //return next();
    });
  });
}

var get_gist = function(gist_id, cb) {
  var gist_api_url = "https://api.github.com/gists/";
  // hits rate limits quickly when auth is omitted
  var authentication = ""; 
  if( typeof config.get('GH_CLIENT_SECRET') !== "undefined" && config.get('GH_CLIENT_SECRET') !== "" &&
      typeof config.get('GH_CLIENT_ID')     !== "undefined" && config.get('GH_CLIENT_ID') !== "" ){
    authentication = "?client_id="+config.get('GH_CLIENT_ID')+"&client_secret="+config.get('GH_CLIENT_SECRET');
  }
  request({
    url: gist_api_url + gist_id + authentication, 
    headers: {'User-Agent': 'request'}
  }, cb)
}


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

var getTokens = function(){
  var secret = config.get('REVEAL_SOCKET_SECRET');
  var socket = createHash(secret);
  response = {"socket_secret": secret, "socket_id": socket};
  return response;
};

var getClientConfig = function(){
  var tokens = getTokens();
  return "hosted:{ id: '"+tokens.socket_id+"' }";
};
app.get("/", get_slides);
app.get("/status", function(req,res,next) {
  return res.send('ok');
});

// Static files:
app.use(express.static(__dirname))

// Gist templates:
app.get("/:gist_id", get_slides);

// Actually listen
server.listen(config.get('PORT'), config.get('IP'), function(){
  get_theme(config.get('REVEAL_THEME'), function(){
    //if the default theme is a gist_id, prime the cache 
  })
});

var brown = '\033[33m',
	green = '\033[32m',
	reset = '\033[0m';

console.log( brown + "reveal.js:" + reset + " Multiplex running on port " + green + config.get('PORT') + reset );
