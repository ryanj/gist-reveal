import { fileURLToPath } from 'url';
import { dirname } from 'path';
import express from 'express';
import * as fs from 'fs';
import * as crypto from 'crypto';
import cc from 'config-multipaas';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import ye_olde_request from 'request';
import socketIo from "socket.io";
import sanitizeHtml from "sanitize-html";
import rate_limit_slides from "./rate_limit_response.json" with { type: "json" };
import default_slides from "./default_response.json" with { type: "json" };
import error_slides from "./error_response.json" with { type: "json" };
import local_slide_resp from "./local_slides.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
let io = new socketIo(server);
const sanitize = (slideshow_content) => {
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
let bitly_short_names = [];
let bitly_gist_ids = [];

let config = cc({
  REVEAL_SOCKET_SECRET : process.env.REVEAL_SOCKET_SECRET || (Math.floor(Math.random()*1000).toString() + new Date().getTime().toString())
, WEBSOCKET_ENABLED : process.env.WEBSOCKET_ENABLED || "true"
, DEFAULT_GIST : process.env.DEFAULT_GIST || 'af84d40e58c5c2a908dd'
, REVEAL_THEME : process.env.REVEAL_THEME || '450836bbaebcf4c4ae08b331343a7886'
, DEBUG : Number(process.env.DEBUG) || 0
, GIST_THEMES : process.env.GIST_THEMES || "true"
, GH_CLIENT_TOKEN : process.env.GH_CLIENT_TOKEN
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
  var title, data;
  var theme_folder = path.resolve('css','theme','gists',gist.id);
  console.log("installing gist: "+gist.id);
  mkdirp(theme_folder);
  for(var i in gist.files){
    filenm = gist.files[i].filename;
    data = gist.files[i].content;
    if( gist.files[i].type == "text/css"){
      filename = path.resolve('css','theme','gists',gist.id,gist.id+".css")
      fs.writeFile(filename, data, (err) => {
        console.log('theme installed: '+gist.id);
      });
    }else{
      filename = path.resolve('css','theme','gists',gist.id,filenm)
      ye_olde_request({url: gist.files[i].raw_url}).pipe(fs.createWriteStream(filename)).on('error', (err) => {
          console.log(err)
      })
    }
  }
}

const get_theme = (gist_id, cb) => {
  if( !config.get('GIST_THEMES') ){
    // if theme installation is disabled, return immediately
    cb(gist_id)
  }
  var theme_folder = path.resolve( 'css','theme', 'gists', gist_id );
  //if theme is found locally, return gist_id;
  fs.stat( theme_folder, (err, stats) => {
    if(!err){
      //console.log("not installing locally available theme: " + gist_id);
      cb('gists/'+gist_id+'/'+gist_id);
    }else{
      //console.log("installing css theme: " + gist_id);
      get_gist(gist_id, (error, response, api_response) => {
        //cache the content
        if (!error && response.statusCode == 200) {
          gist = JSON.parse(api_response);
          install_theme(gist);
          console.log("gist retrieved : " + gist_id);
          cb('gists/'+gist_id+'/'+gist_id)
        }else{
          //not found
          console.log("gist not found: " + gist_id);
          cb(gist_id)
        }
      })
    }
  })
}

const svgtemplate = (req, res, next) => {
  var presenter_name = req.params.username || 'gist-reveal';
  //var presented_by = fs.readFileSync(__dirname + '/img/presented_by.svg');
  //console.log('button: {text: "'+presenter_name+'"}')
  //console.log("request url:" + req.url)
  res.status(200);
  res.header('Content-Type', 'image/svg+xml');
  res.end(presented_by.toString().replace(/gist-reveal/, "@"+presenter_name));
};

let concurrency = 0;

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
    'User-Agent': "ryanj",
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if( typeof config.get('GH_CLIENT_TOKEN') !== "undefined" && config.get('GH_CLIENT_TOKEN') !== "" ){
    headers.Authorization = 'Bearer '+config.get('GH_CLIENT_TOKEN');
  }

  ye_olde_request({
    url: gist_api_url + gist_id,
    headers: headers
  }, cb);
}

app.get("/token", (req,res) => {
  res.send('Information about setting up your presentation environment is available in the server logs');
});

if(config.get('WEBSOCKET_ENABLED') !== "false"){ 
  io.on('connection', (socket) => {
    concurrency = concurrency+1;
    if(config.get('DEBUG') >= 2){
      console.log("Concurrency: " + concurrency)
    }
    var checkAndReflect = (data) => {
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
    socket.on('disconnect', () => {
      concurrency = concurrency -1;
      if(config.get('DEBUG') >= 2){
        console.log("Concurrency: " + concurrency)
      }
    })
  });
}

const getTokens = () => {
  var secret = config.get('REVEAL_SOCKET_SECRET');
  var socket = createHash(secret);
  response = {"socket_secret": secret, "socket_id": socket};
  return response;
};

const getClientConfig = () => {
  var tokens = getTokens();
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
