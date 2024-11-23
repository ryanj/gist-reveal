import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdirp } from 'mkdirp';
import { Server } from "socket.io";
import express from 'express';
import * as fs from 'fs';
import * as crypto from 'crypto';
import cc from 'config-multipaas';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import ye_olde_request from 'request';
import sanitizeHtml from "sanitize-html";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rate_limit_slides = JSON.parse(fs.readFileSync('./responses/rate_limit_response.json'));
const default_slides = JSON.parse(fs.readFileSync('./responses/default_response.json'));
const error_slides = JSON.parse(fs.readFileSync('./responses/error_response.json'));
const local_slide_resp = JSON.parse(fs.readFileSync('./local_slides.json'));

const app = express();
let tls = {};
try{
  tls = {
    key: process.env['PRIVATE_KEY'] || fs.readFileSync(__dirname + '/private.key', 'utf8'),
    cert: process.env['PUBLIC_CRT'] || fs.readFileSync(__dirname + '/public.crt',  'utf8'),
    maxVersion: 'TLSv1.3',
    minVersion: 'TLSv1.2'
  };
  // certificates available!
  console.log("protocol: https/wss")
} catch (err){
  console.error(err);
  // certificates unavailable
  // fallback to http/ws connections
  console.log("protocol: http/ws")
}
const protocol = ( Object.keys(tls).length != 0 ) ? https : http;
const server = protocol.createServer(tls, app);
let io = new Server(server);
// needs gc, max size = 25?
let bitly_short_names = [];
let bitly_gist_ids = [];

let config = cc({
  SOCKET_SECRET : process.env.SOCKET_SECRET || process.env.REVEAL_SOCKET_SECRET || (Math.floor(Math.random()*1000).toString() + new Date().getTime().toString())
, WEBSOCKET_ENABLED : process.env.WEBSOCKET_ENABLED || "true"
, DEFAULT_GIST : process.env.DEFAULT_GIST || 'af84d40e58c5c2a908dd'
, REVEAL_THEME : process.env.REVEAL_THEME || '450836bbaebcf4c4ae08b331343a7886'
, DEBUG : Number(process.env.DEBUG) || 0
, GIST_THEMES : process.env.GIST_THEMES || "true"
, SANITIZE_INPUT : process.env.SANITIZE_INPUT || "false"
, GH_API_TOKEN : process.env.GH_API_TOKEN
, CLIENT_ID : process.env.CLIENT_ID || ""
, CLIENT_SECRET : process.env.CLIENT_SECRET || ""
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

const sanitize = (slideshow_content) => {
  if(config.get('SANITIZE_INPUT') == 'true'){
  return sanitizeHtml(slideshow_content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','section','h1','h2','aside','span','hr','br','div','blockquote','strong','small','audio','video','code','h3','h4','h5','h6']),
    allowedAttributes: {
      'h1': ['class','style','data_id','data-auto-animate-delay'],
      'h2': ['class','style','data_id','data-auto-animate-delay'],
      'h3': ['class','style','data_id','data-auto-animate-delay'],
      'h4': ['class','style','data_id','data-auto-animate-delay'],
      'h5': ['class','style','data_id','data-auto-animate-delay'],
      'h6': ['class','style','data_id','data-auto-animate-delay'],
      'p': ['class','style','data_id','data-auto-animate-delay'],
      'div': ['class','style','data_id','data-auto-animate-delay'],
      'ol': ['class','style','data_id'],
      'ul': ['class','style','data_id'],
      'li': ['class','style','data_id'],
      'blockquote': ['class','style','data_id','data-auto-animate-delay'],
      'pre': ['class','style','data-id','data-auto-animate-delay'],
      'dl': ['class','style','data_id'],
      'dt': ['class','style','data_id'],
      'dd': ['class','style','data_id'],
      'table': ['class','style','data_id'],
      'tr': ['class','style','data_id'],
      'td': ['class','style','data_id'],
      'span': ['class','style','data_id'],
      'small': ['data_id'],
      'strong': ['data_id'],
      'audio': ['class','style','data-autoplay','data-src'],
      'video': ['class','style','data-autoplay','data-src'],
      'aside': ['class'],
      'code': ['class','style','contenteditable','data-trim','data-ln-start-from','data-line-numbers','data-noescape'],
      'a': ['href', 'name', 'target', 'style','class','data_id'],
      'img': ['src','class','style','width','height','alt','data-src','data_id'],
      'section': ['style','data-visibility', 'data-auto-animate', 'data-auto-animate-easing', 'data-markdown', 'id', 'data-state', 'data-transition', 'data-background-transition', 'data-background', 'data-background-color', 'data-autoslide','data-background-image','data-background-size','data-background-position','data-background-repeat', 'data-background-video-loop', 'data-background-video-muted', 'data-background-video', 'data-transition-speed']
    }
  });
  }else{
    return slideshow_content;
  }
}

const createHash = (secret) => {
	let cipher = crypto.createHash('md5').update(secret);
	return(cipher.digest('hex'));
};
const presented_by = fs.readFileSync(__dirname + '/img/presented_by.svg');
const ga_tracker_html = (tracker_id) => {
  if(typeof(tracker_id) !== 'undefined'){
    return "<!-- Google tag (gtag.js) -->\n"+
    "<script async src='https://www.googletagmanager.com/gtag/js?id="+tracker_id+"'></script>\n"+
    "<script>\n"+
    "  window.dataLayer = window.dataLayer || [];\n"+
    "  function gtag(){dataLayer.push(arguments);}\n"+
    "  gtag('js', new Date());\n"+
    "  gtag('config', '"+tracker_id+"');\n"+
    "</script>";
  }else{
    return "";
  }
};

const render_slideshow = (gist, theme, cb) => {
  for(let i in gist.files){
    if( gist.files[i].type == "text/html" || gist.files[i].type.indexOf('image' < 0 ) ){
      var title = sanitize(i);
      var slides = sanitize(gist.files[i].content);
      var description = sanitize(gist.description);
      var user = gist.owner.login;
      gist_owners[gist.id] = gist.owner.login;
      break;
    }
  }
  get_theme(theme, (themename) => {
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

const install_theme = (gist) => {
  let data, theme_folder;
  if(process.env.NODE_ENV == "production"){
    theme_folder = path.resolve('/','tmp','gists',gist.id);
  }else{
    theme_folder = path.resolve('css','theme','gists',gist.id);
  }
  let filenm = '';
  let filename = '';
  console.log("installing gist: "+gist.id);
  try{
    fs.mkdir(theme_folder, {recursive: true}, function(errs){
      if(errs){
        console.error(errs);
      };
      for(let i in gist.files){
        filenm = gist.files[i].filename;
        data = gist.files[i].content;
        if( gist.files[i].type == "text/css"){
          if(process.env.NODE_ENV == "production"){
            filename = path.resolve('/','tmp','gists',gist.id,gist.id+".css")
          }else{
            filename = path.resolve('css','theme','gists',gist.id,gist.id+".css")
          }
          fs.writeFile(filename, data, (err) => {
            if(err){
              console.error(err);
            }else{
              console.log('theme installed: '+gist.id);
              //console.log('theme installed: '+filename);
            }
          });
        }else{
          if(process.env.NODE_ENV == "production"){
            filename = path.resolve('/','tmp','gists',gist.id,filenm)
          }else{
            filename = path.resolve('css','theme','gists',gist.id,filenm)
          }
          ye_olde_request({url: gist.files[i].raw_url}).pipe(fs.createWriteStream(filename)).on('error', (err) => {
            console.error(err)
          })
        }
      }
    });
  } catch (err){
    console.log("fail to install: "+gist.id);
    console.error(err);
  }
}

const get_theme = (gist_id, cb) => {
  let theme_folder;
  if( !config.get('GIST_THEMES') ){
    // if theme installation is disabled, return immediately
    cb(gist_id)
  }
  if(process.env.NODE_ENV == "production"){
    theme_folder = path.resolve( '/','tmp', 'gists', gist_id );
  }else{
    theme_folder = path.resolve( 'css','theme', 'gists', gist_id );
  }
  let gist = {};
  //if theme is found locally, return gist_id;
  fs.stat( theme_folder, (err, stats) => {
    if(!err){
      //console.log("cached theme: " + gist_id);
      cb('gists/'+gist_id+'/'+gist_id);
    }else{
      //console.log("new theme: " + gist_id);
      get_gist(gist_id, (error, response, api_response) => {
        //cache the content
        if (!error && response.statusCode == 200) {
          gist = JSON.parse(api_response);
          install_theme(gist);
          console.log("gist retrieved : " + gist_id);
          cb('gists/'+gist_id+'/'+gist_id)
        }else{
          if(config.get('DEBUG') >= 2){
            console.log("theme not found by id: " + gist_id);
          }
          cb(gist_id)
        }
      })
    }
  })
}

const svgtemplate = (req, res, next) => {
  const presenter_name = req.params.username || 'gist-reveal';
  //var presented_by = fs.readFileSync(__dirname + '/img/presented_by.svg');
  //console.log('button: {text: "'+presenter_name+'"}')
  //console.log("request url:" + req.url)
  res.status(200);
  res.header('Content-Type', 'image/svg+xml');
  res.end(presented_by.toString().replace(/gist-reveal/, "@"+presenter_name));
};

let concurrency = 0;
let gist_owners = [];
let gist_tokens = [];

const get_bitlink = (req, res, next) => {
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
    ye_olde_request({url: "http://bit.ly/"+short_name },
      (error, response, payload) => {
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

const get_local_slides = (cb) => {
  var path = config.get('GIST_PATH');
  var filename = config.get('GIST_FILENAME');
  var escaped=filename.replace(/\//g, "//").replace(/'/g, "\'").replace(/"/g, '\"'); 
  var filejson = {};
  filejson[escaped]={'type': "text/html"};
  local_slide_resp.files=filejson;
  
  //look up local file, inject it into the template
  fs.readFile(path+'/'+filename, ( error, local_content ) => {
    if(error){
      local_slide_resp.files[escaped].content="<section>"+error+"</section>"
    }else{
      local_slide_resp.files[escaped].content=local_content
    }
    cb(local_slide_resp)
  })
}

const get_slides = (req, res, next) => {
  var theme = req.query['theme'] || config.get('REVEAL_THEME');
  var gist_id = req.params.gist_id || req.query.gist_id || config.get('DEFAULT_GIST');
  var gist = {};
  if( !!bitly_gist_ids[gist_id] && req.path.indexOf('bit') == -1 ){
    //console.log("redirecting to: /bit.ly/" + bitly_gist_ids[gist_id]);
    if( req.query['theme'] ){
      res.redirect('/bit.ly/'+bitly_gist_ids[gist_id]+'?theme='+theme);
    }else{
      res.redirect("/bit.ly/"+bitly_gist_ids[gist_id]);
    }
  }else if( config.get('GIST_FILENAME')){
    get_local_slides( (gist) => {
      render_slideshow(gist, theme, (slides) => {
        res.send(slides);
        //return next();
      });
    });
  }else{
    get_gist(gist_id, (error, response, api_response) => {
      if (!error && response.statusCode == 200) {
        gist = JSON.parse(api_response);
      }else if (response.statusCode == 403){
        gist = rate_limit_slides;
      }else{
        gist = error_slides;
      }
      render_slideshow(gist, theme, (slides) => {
        res.send(slides);
        //return next();
      });
    });
  }
}

const get_gist = (gist_id, cb) => {
  var gist_api_url = "https://api.github.com/gists/";
  // hits rate limits quickly when auth is omitted
  var headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': "gist-reveal.it",
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if( typeof config.get('GH_API_TOKEN') !== "undefined" && config.get('GH_API_TOKEN') !== "" ){
    headers.Authorization = 'Bearer '+config.get('GH_API_TOKEN');
  }

  ye_olde_request({
    url: gist_api_url + gist_id,
    headers: headers
  }, cb);
}
const getUser = (token, cb) => {
  ye_olde_request({
    url: "https://api.github.com/user",
    headers: {
      "Authorization": "Bearer "+token,
      "User-Agent": "gist-reveal.it",
      "Accept": "application/json",
      "Content-Type": "application/json"
    }
  }, cb);
};
app.get("/github/callback", (req,res) => {
  let params = {
    "client_id": config.get('CLIENT_ID'),
    "client_secret": config.get('CLIENT_SECRET'),
    "code": req.params.code || req.query.code
  }
  ye_olde_request({
    url: 'https://github.com/login/oauth/access_token',
    method: "POST",
    json: true,
    headers: {
      'User-Agent': 'gist-reveal',
      'Accept': "application/json"
    },
    body: params
  },
  (error, response, body) => {
    if (error){
      console.error(error);
    }
    if (!error && response.statusCode == 200) {
      if(body.access_token){
        res.redirect('/?setToken='+body.access_token);
      }else{
        res.redirect('/');
      }
    }else{
      res.redirect('/');
    }
  });
});
app.get("/logout", (req,res) => {
  res.redirect('/?clearToken');
});
app.get("/login", (req,res) => {
  res.redirect('https://github.com/login/oauth/authorize?client_id='+config.get('CLIENT_ID'));
});

if(config.get('WEBSOCKET_ENABLED') !== "false" &&
   config.get('CLIENT_ID') !== "" &&
   config.get('CLIENT_SECRET') !== ""){

  io.on('connection', (socket) => {
    concurrency = concurrency+1;
    if(config.get('DEBUG') >= 2){
      console.log("Concurrency: " + concurrency)
    }
    var checkAndReflect = (data) => {
      if (typeof data.secret == 'undefined' || data.secret == null || data.secret === '') {console.log('Discarding mismatched socket data');return;} 
      if ( gist_tokens[data.gistId] === data.secret ) {
        data.secret = null; 
        socket.to(data.gistId).emit(data.socketId, data);
        //console.dir(data);
      }else{
        console.log('Discarding mismatched socket data:');
        //console.dir(data);
      };      
    };
    socket.on('listen', (data) => {
      socket.join(data.gistId);
    });
    socket.on('presentation_auth', (data) => {
      if(data.secret){
        socket.join(data.gistId);
        getUser(data.secret, (errr, resp, bdy) => {
          if (errr) {
            console.error(errr);
          }
          if (!errr && resp.statusCode == 200) {
            var b = JSON.parse(bdy);
            if(b && b.login){
              if(gist_owners[data.gistId] === b.login){
                console.log("@"+b.login + " is broadcasting: "+ data.gistId);
                gist_tokens[data.gistId] = data.secret;
              }else{
                console.log("@"+b.login + " does not own: " +data.gistId);
                // else listen
                //socket.emit('listen');
              }
            }
          }
        });
      }else{
        // logout?
      }
    });
    socket.on('slidechanged', checkAndReflect);
    socket.on('navigation', checkAndReflect);
    socket.on('disconnect', () => {
      concurrency = concurrency -1;
      if(config.get('DEBUG') >= 2){
        console.log("Concurrency: " + concurrency)
      }
    })
  });
}

const getTokens = () => {
  const secret = config.get('SOCKET_SECRET');
  const socket = createHash(secret);
  response = {"socket_secret": secret, "socket_id": socket};
  return response;
};

const getClientConfig = () => {
  const tokens = getTokens();
  if(config.get('WEBSOCKET_ENABLED') == "false"){
    return "hosted: false";
  }
  return "hosted:{ id: '"+tokens.socket_id+"' }";
};
app.get("/", get_slides);
app.get("/status", (req,res,next) => {
  return res.send('ok');
});

// Static files:
if(process.env.NODE_ENV == 'production'){
  app.use('/css/theme/gists', express.static('/tmp/gists'));
}else{
  app.use('/css/theme/gists', express.static(path.resolve(__dirname,'css','theme','gists')));
}
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
server.listen(config.get('PORT'), config.get('IP'), () => {
  console.log( "reveal.js: Multiplex running on "+config.get('IP')+":" + config.get('PORT') );
});
