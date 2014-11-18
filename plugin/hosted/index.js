var express		= require('express');
var fs			= require('fs');
var io			= require('socket.io');
var crypto		= require('crypto');
var app			= express.createServer();
var staticDir	= express.static;
var io			= io.listen(app);
var path    = require('path');
var request = require('request');
var sanitizeHtml = require('sanitize-html');
var mkdirp  = require('mkdirp');
var sanitize = function(slideshow_content){
  return sanitizeHtml(slideshow_content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','section','h1','h2','aside','span']),
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

var opts = {
	port: process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
  ipAddr : process.env.IP_ADDR || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
  web_host: process.env.REVEAL_WEB_HOST || process.env.OPENSHIFT_APP_DNS || 'localhost:8080',
  socket_host: process.env.REVEAL_SOCKET_HOST || process.env.REVEAL_WEB_HOST || process.env.OPENSHIFT_APP_DNS || 'localhost',
  socket_secret : process.env.REVEAL_SOCKET_SECRET,
  default_gist_id : process.env.DEFAULT_GIST || 'af84d40e58c5c2a908dd',
  theme : process.env.REVEAL_THEME || '60e54843de11a545897e',
  install_gist_themes : process.env.GIST_THEMES || "true",
  template_logo_text : process.env.TEMPLATE_LOGO_TEXT || "Launch on OpenShift",
  template_logo_img : process.env.TEMPLATE_LOGO_IMG || "img/launchbutton.svg",
  template_logo_url : process.env.TEMPLATE_LOGO_URL || "https://openshift.redhat.com/app/console/application_types/custom?name=slides&initial_git_url=https%3A%2F%2Fgithub.com/ryanj/gist-reveal.it.git&cartridges[]=nodejs-0.10",
  ga_tracker_key : process.env.GA_TRACKER,
  gh_client_secret : process.env.GH_CLIENT_SECRET,
  gh_client_id : process.env.GH_CLIENT_ID,
	baseDir : __dirname + '/../../'
};
var rate_limit_slides = require('./rate_limit_response.json');
var default_slides = require('./default_response.json');
var error_slides = require('./error_response.json');
var slideshow_template = fs.readFileSync(opts.baseDir + '/index.html');

var createHash = function(secret) {
	var cipher = crypto.createCipher('blowfish', secret);
	return(cipher.final('hex'));
};

app.configure(function() {
	[ 'css', 'js', 'plugin', 'lib', 'img' ].forEach(function(dir) {
		app.use('/' + dir, staticDir(opts.baseDir + dir));
	});
});

var ga_tracker_html = function(tracker_id, hostname){
  if(typeof(tracker_id) !== 'undefined'){
    return "<script>(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){\n" + 
    "(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o)\n" + 
    "m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,\n" + 
    "})(window,document,'script','//www.google-analytics.com/analytics.js','ga');\n" + 
    "ga('create', '"+tracker_id+"', '"+hostname+"');\n" + 
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
    cb(slideshow_template.toString()
                           .replace(/\{\{slides}}/, slides)
                           .replace(/hosted: {}/, getClientConfig())
                           .replace(/\{\{title}}/, title)
                           .replace(/\/\/\{\{ga-tracker}}/, ga_tracker_html(opts.ga_tracker_key, opts.web_host))
                           .replace(/\{\{hostname}}/, opts.web_host)
                           .replace(/\{\{theme}}/, themename)
                           .replace(/\{\{template_logo_url}}/, opts.template_logo_url)
                           .replace(/\{\{template_logo_text}}/, opts.template_logo_text)
                           .replace(/\{\{template_logo_img}}/, opts.template_logo_img)
                           .replace(/\{\{user}}/, user)
                           .replace(/\{\{description}}/, description)
  )});
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
      request({url: gist.files[i].raw_url}).pipe(fs.createWriteStream(filename))
    }
  }
}

var get_theme = function(gist_id, cb) {
  if( opts.install_gist_themes == 'false' ){
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
  var gist_id = req.param('gist_id', opts.default_gist_id);
  var theme = req.param('theme', opts.theme);
  get_gist(gist_id, function (error, response, api_response) {
    if (!error && response.statusCode == 200) {
      gist = JSON.parse(api_response);
    }else if (response.statusCode == 403){
      gist = rate_limit_slides;
    }else{
      gist = error_slides;
    }
    render_slideshow(gist, theme, function(slides){
      return res.send(slides, 200, {'Content-Type': 'text/html'});
    });
  });
}

var get_gist = function(gist_id, cb) {
  var gist_api_url = "https://api.github.com/gists/";
  // hits rate limits quickly when auth is omitted
  var authentication = ""; 
  if( typeof(opts.gh_client_secret) !== "undefined" && 
      typeof(opts.gh_client_id)     !== "undefined" ){
    authentication = "?client_id="+opts.gh_client_id+"&client_secret="+opts.gh_client_secret;
  }
  request({
    url: gist_api_url + gist_id + authentication, 
    headers: {'User-Agent': 'request'}
  }, cb)
}

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
app.listen(opts.port, opts.ipAddr, function(){
  get_theme(opts.theme, function(){
    //if the default theme is a gist_id, prime the cache 
  })
});

var brown = '\033[33m',
	green = '\033[32m',
	reset = '\033[0m';

console.log( brown + "reveal.js:" + reset + " Multiplex running on port " + green + opts.port + reset );
