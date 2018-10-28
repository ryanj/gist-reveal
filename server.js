var express		= require('express');
var fs			= require('fs');
var crypto		= require('crypto');
var cc                  = require('config-multipaas');
var http = require('http')
var path    = require('path');
var mkdirp  = require('mkdirp');
var request = require('request');
var app = express()
var server = http.createServer(app)
var io = require('socket.io')(server);
var sanitizeHtml = require('sanitize-html');
var rate_limit_slides = require('./rate_limit_response.json');
var default_slides = require('./default_response.json');
var error_slides = require('./error_response.json');
var local_slide_resp = require('./local_slides.json');
var sanitize = function(slideshow_content){
  return sanitizeHtml(slideshow_content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','section','h1','h2','aside','span','hr','br','div','blockquote']),
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
      'blockquote': ['class','style'],
      'pre': ['class','style'],
      'dl': ['class','style'],
      'dt': ['class','style'],
      'dd': ['class','style'],
      'table': ['class','style'],
      'tr': ['class','style'],
      'td': ['class','style'],
      'span': ['class','style'],
      'audio': ['class','style','data-autoplay','data-src'],
      'video': ['class','style','data-autoplay','data-src'],
      'aside': ['class'],
      'code': ['class','style','contenteditable','data-trim'],
      'a': ['href', 'name', 'target', 'style','class'],
      'img': ['src','class','style','data-src'],
      'section': ['data-markdown', 'id', 'data-state', 'data-transition', 'data-background-transition', 'data-background', 'data-background-color', 'data-autoslide','data-background-image','data-background-size','data-background-position','data-background-repeat', 'data-background-video-loop', 'data-background-video-muted', 'data-background-video', 'data-transition-speed']
    }
})}

// needs gc, max size = 25?
var bitly_short_names = [];
var bitly_gist_ids = [];

var config = cc({
  REVEAL_SOCKET_SECRET : process.env.REVEAL_SOCKET_SECRET || (Math.floor(Math.random()*1000).toString() + new Date().getTime().toString())
, WEBSOCKET_ENABLED : process.env.WEBSOCKET_ENABLED || "true"
, DEFAULT_GIST : process.env.DEFAULT_GIST || 'af84d40e58c5c2a908dd'
, REVEAL_THEME : process.env.REVEAL_THEME || '450836bbaebcf4c4ae08b331343a7886'
, DEBUG : Number(process.env.DEBUG) || 0
, GIST_THEMES : process.env.GIST_THEMES || "true"
, GH_CLIENT_ID : process.env.GH_CLIENT_ID
, GH_CLIENT_SECRET : process.env.GH_CLIENT_SECRET
, GA_TRACKER : process.env.GA_TRACKER
, REVEAL_WEB_HOST : process.env.REVEAL_WEB_HOST || process.env.OPENSHIFT_APP_DNS || 'localhost:8080'
, GIST_PATH : process.env.GIST_PATH || __dirname || '.'
, GIST_FILENAME : process.env.GIST_FILENAME
, TEMPLATE_LOGO_TEXT : process.env.TEMPLATE_LOGO_TEXT || "Runs on Kubernetes"
, TEMPLATE_LOGO_IMG : process.env.TEMPLATE_LOGO_IMG || "/img/runsonk8s.svg"
, TEMPLATE_LOGO_URL : process.env.TEMPLATE_LOGO_URL || "https://github.com/ryanj/gist-reveal#running-gist-revealit"
, TEMPLATE_GIST_TEXT : process.env.TEMPLATE_GIST_TEXT || "Presented by: @"
, TEMPLATE_GIST_IMG : process.env.TEMPLATE_GIST_IMG || "/img/presented_by/"
, TEMPLATE_GIST_URL : process.env.TEMPLATE_GIST_URL || "https://gist.github.com/"
});
var createHash = function(secret) {
	var cipher = crypto.createCipher('blowfish', secret);
	return(cipher.final('hex'));
};
var presented_by = fs.readFileSync(__dirname + '/img/presented_by.svg');
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
    var index = cb( fs.readFileSync( __dirname + '/index.html').toString()
                           .replace(/\{\{slides}}/, slides)
                           .replace(/hosted: {}/, getClientConfig())
                           .replace(/\{\{title}}/, title)
                           .replace(/\/\/\{\{ga-tracker}}/, ga_tracker_html(config.get('GA_TRACKER')))
                           .replace(/\{\{theme}}/, themename)
                           .replace(/\{\{template_logo_url}}/, config.get('TEMPLATE_LOGO_URL'))
                           .replace(/\{\{template_logo_text}}/, config.get('TEMPLATE_LOGO_TEXT'))
                           .replace(/\{\{template_logo_img}}/, config.get('TEMPLATE_LOGO_IMG'))
                           .replace(/\{\{template_gist_url}}/, config.get('TEMPLATE_GIST_URL')+gist.id)
                           .replace(/\{\{template_gist_text}}/, config.get('TEMPLATE_GIST_TEXT')+user)
                           .replace(/\{\{template_gist_img}}/, config.get('TEMPLATE_GIST_IMG')+user+'.svg')
                           .replace(/\{\{gist_id}}/, gist.id)
                           .replace(/\{\{user}}/, user)
                           .replace(/\{\{description}}/, description)
    )
    return index;
  });
};

var install_theme = function(gist){
  var title, data;
  var theme_folder = path.resolve('css','theme','gists',gist.id);
  console.log("installing gist: "+gist.id);
  mkdirp(theme_folder);
  for(var i in gist.files){
    filenm = gist.files[i].filename;
    data = gist.files[i].content;
    if( gist.files[i].type == "text/css"){
      filename = path.resolve('css','theme','gists',gist.id,gist.id+".css")
      fs.writeFile(filename, data, function(err){
        console.log('theme installed: '+gist.id);
      });
    }else{
      filename = path.resolve('css','theme','gists',gist.id,filenm)
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
  var theme_folder = path.resolve( 'css','theme', 'gists', gist_id );
  //if theme is found locally, return gist_id;
  fs.stat( theme_folder, function(err, stats){
    if(!err){
      //console.log("not installing locally available theme: " + gist_id);
      cb('gists/'+gist_id+'/'+gist_id);
    }else{
      //console.log("installing css theme: " + gist_id);
      get_gist(gist_id, function(error, response, api_response){
        //cache the content
        if (!error && response.statusCode == 200) {
          gist = JSON.parse(api_response);
          install_theme(gist);
          console.log("gist retrieved : " + gist_id);
          cb('gists/'+gist_id+'/'+gist_id)
        }else{
          //not found
          console.log("gist not found");
          cb(gist_id)
        }
      })
    }
  })
}

var svgtemplate = function (req, res, next)
{
  var presenter_name = req.params.username || 'gist-reveal';
  //var presented_by = fs.readFileSync(__dirname + '/img/presented_by.svg');
  //console.log('button: {text: "'+presenter_name+'"}')
  //console.log("request url:" + req.url)
  res.status(200);
  res.header('Content-Type', 'image/svg+xml');
  res.end(presented_by.toString().replace(/gist-reveal/, "@"+presenter_name));
};

var concurrency = 0;

var get_bitlink = function(req, res, next) {
  var short_name = req.params.short_name || req.query.short_name;
  var payload_id,payload_offset,id_start,payload_end;
  var payload_identifier="<meta name=\"gist_id\" content=\"";

  //if the bitly_short_name is in the cache, call get_slides on the cached id
  if( !!bitly_short_names[short_name] ){
    //console.log("gist_id found in bitlink cache");
    req.params.gist_id = bitly_short_names[short_name];
    get_slides(req, res, next);
  
  //else return a redirect to bit.ly, let them service the request
  } else {

    console.log('looking up bitlink: http://bit.ly/' + short_name );
    request({url: "http://bit.ly/"+short_name },
      function(error, response, payload){
        if (!error && response.statusCode == 200) {
          payload_offset = payload.indexOf(payload_identifier)
          id_start = payload_offset+payload_identifier.length;
          payload_end = payload.indexOf('"', id_start)
          payload_id = payload.substring(id_start, payload_end);
          //console.log("bitlink id: " + payload_id);
          if(payload_offset !== -1 && payload_id){
            if(!bitly_short_names[short_name] && !bitly_gist_ids[payload_id]){
              bitly_short_names[short_name] = payload_id;
              bitly_gist_ids[payload_id] = short_name;
              console.log("bitlink gist_id cached: " + payload_id);
            }
          }else{
            console.log("bitlink not found: bit.ly/"+short_name);
          }
        }else{
          console.log("bitlink not found: bit.ly/"+short_name);
        }
      }
    );

    //console.log("redirecting to: bit.ly/" + short_name);
    res.redirect('http://bit.ly/' + short_name);
  }
};

var get_local_slides = function(cb){
  var path = config.get('GIST_PATH');
  var filename = config.get('GIST_FILENAME');
  var escaped=filename.replace(/\//g, "//").replace(/'/g, "\'").replace(/"/g, '\"'); 
  var filejson = {};
  filejson[escaped]={'type': "text/html"};
  local_slide_resp.files=filejson;
  
  //look up local file, inject it into the template
  fs.readFile(path+'/'+filename, function( error, local_content ){
    if(error){
      local_slide_resp.files[escaped].content="<section>"+error+"</section>"
    }else{
      local_slide_resp.files[escaped].content=local_content
    }
    cb(local_slide_resp)
  })
}

var get_slides = function(req, res, next) {
  var theme = req.query['theme'] || config.get('REVEAL_THEME');
  var gist_id = req.params.gist_id || req.query.gist_id || config.get('DEFAULT_GIST');
  if( !!bitly_gist_ids[gist_id] && req.path.indexOf('bit') == -1 ){
    //console.log("redirecting to: /bit.ly/" + bitly_gist_ids[gist_id]);
    if( req.query['theme'] ){
      res.redirect('/bit.ly/'+bitly_gist_ids[gist_id]+'?theme='+theme);
    }else{
      res.redirect("/bit.ly/"+bitly_gist_ids[gist_id]);
    }
  }else if( config.get('GIST_FILENAME')){
    get_local_slides(function(gist){
      render_slideshow(gist, theme, function(slides){
        res.send(slides);
        //return next();
      });
    });
  }else{
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

if(config.get('WEBSOCKET_ENABLED') !== "false"){ 
  io.on('connection', function(socket) {
    concurrency = concurrency+1;
    if(config.get('DEBUG') >= 2){
      console.log("Concurrency: " + concurrency)
    }
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
    socket.on('disconnect', function(){
      concurrency = concurrency -1;
      if(config.get('DEBUG') >= 2){
        console.log("Concurrency: " + concurrency)
      }
    })
  });
}

var getTokens = function(){
  var secret = config.get('REVEAL_SOCKET_SECRET');
  var socket = createHash(secret);
  response = {"socket_secret": secret, "socket_id": socket};
  return response;
};

var getClientConfig = function(){
  var tokens = getTokens();
  if(config.get('WEBSOCKET_ENABLED') == "false"){
    return "hosted: false";
  }
  return "hosted:{ id: '"+tokens.socket_id+"' }";
};
app.get("/", get_slides);
app.get("/status", function(req,res,next) {
  return res.send('ok');
});

// Static files:
app.use(express.static(__dirname))

// SVG templating
app.get("/img/presented_by/:username\.svg", svgtemplate);
app.get("/img/presented_by/:username.svg", svgtemplate);
app.get("/img/presented_by/:username", svgtemplate);

// Bit.ly shortname integration
app.get("/bitly/:short_name", get_bitlink);
app.get("/bit\.ly/:short_name", get_bitlink);

// Gist templates:
app.get("/:gist_id", get_slides);

// Actually listen
server.listen(config.get('PORT'), config.get('IP'), function(){
  var brown = '\033[33m',
      green = '\033[32m',
      reset = '\033[0m';

  console.log( brown + "reveal.js:" + reset + " Multiplex running on "+config.get('IP')+":" + green + config.get('PORT') + reset );
});
