import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream';
import {promisify} from 'node:util'
import { dirname } from 'path';
import { Server } from "socket.io";
import express from 'express';
import * as fs from 'fs';
import * as crypto from 'crypto';
import cc from 'config-multipaas';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import sanitizeHtml from "sanitize-html";
const streamPipeline = promisify(pipeline);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rate_limit_slides = JSON.parse(fs.readFileSync('./responses/rate_limit_response.json'));
const default_slides = JSON.parse(fs.readFileSync('./responses/default_response.json'));
const error_slides = JSON.parse(fs.readFileSync('./responses/error_response.json'));
const local_slide_resp = JSON.parse(fs.readFileSync('./responses/local_slides.json'));

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
  console.log("protocol: https+wss")
} catch (err){
  //console.error(err);
  // certificates unavailable
  console.log('TLS unavailable');
  // fallback to http/ws connections
  console.log("protocol: http+ws")
}
const protocol = ( Object.keys(tls).length != 0 ) ? https : http;
const server = protocol.createServer(tls, app);
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
, FILTER_REQUESTS : process.env.FILTER_REQUESTS || "true"
, GH_API_TOKEN : process.env.GH_API_TOKEN
, CLIENT_ID : process.env.CLIENT_ID || ""
, CLIENT_SECRET : process.env.CLIENT_SECRET || ""
, GA_TRACKER : process.env.GA_TRACKER
, GIST_PATH : process.env.GIST_PATH || __dirname || '.'
, GIST_FILENAME : process.env.GIST_FILENAME
, TEMPLATE_GIST_TEXT : process.env.TEMPLATE_GIST_TEXT || "Presented by: @"
, TEMPLATE_GIST_IMG : process.env.TEMPLATE_GIST_IMG || "/img/presented_by/"
, TEMPLATE_GIST_URL : process.env.TEMPLATE_GIST_URL || "https://gist.github.com/"
});

const sanitize = (slideshow_content) => {
  if(config.get('SANITIZE_INPUT') == 'true'){
  return sanitizeHtml(slideshow_content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img','section','h1','h2','aside','span','hr','br','div','blockquote','strong','small','audio','video','code','h3','h4','h5','h6','b','i','q']),
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
      'q': ['cite','style','data_id','style'],
      'blockquote': ['class','style','data_id','data-auto-animate-delay','cite'],
      'pre': ['class','style','data-id','data-auto-animate-delay'],
      'dl': ['class','style','data_id'],
      'dt': ['class','style','data_id'],
      'dd': ['class','style','data_id'],
      'aside': ['class','style','data_id'],
      'table': ['class','style','data_id'],
      'tr': ['class','style','data_id'],
      'td': ['class','style','data_id'],
      'span': ['class','style','data_id'],
      'small': ['data_id'],
      'strong': ['data_id'],
      'audio': ['class','style','data-autoplay','data-src'],
      'video': ['class','style','data-autoplay','data-src'],
      'code': ['class','style','contenteditable','data-trim','data-ln-start-from','data-line-numbers','data-noescape','data_id'],
      'a': ['href', 'name', 'target', 'style','class','data_id'],
      'img': ['src','class','style','width','height','alt','data-src','data_id'],
      'section': ['style','data-visibility', 'data-auto-animate', 'data-auto-animate-easing', 'data-markdown', 'id', 'data-state', 'data-transition', 'data-background-transition', 'data-background', 'data-background-color', 'data-autoslide','data-background-image','data-background-size','data-background-position','data-background-repeat', 'data-background-video-loop', 'data-background-video-muted', 'data-background-video', 'data-transition-speed']
    }
  });
  }else{
    return slideshow_content;
  }
}

const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const encrypt = (data) => {
  let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString('hex');
}
const decrypt = (data) => {
  let miv = Buffer.from(data.iv, 'hex');
  let encryptedText = Buffer.from(data.encryptedData, 'hex');
  let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), miv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const createHash = (secret) => {
  let cipher = crypto.createHash('md5').update(secret);
  return(cipher.digest('hex'));
};
const favicon = fs.readFileSync(__dirname + '/img/k8s-favicon.ico');
const presented_by = fs.readFileSync(__dirname + '/img/presented_by.svg');
const presented_by_small = fs.readFileSync(__dirname + '/img/presented_by_small.svg');
const presented_by_med = fs.readFileSync(__dirname + '/img/presented_by_med.svg');
const presented_by_medium = fs.readFileSync(__dirname + '/img/presented_by_medium.svg');
const presented_by_wide = fs.readFileSync(__dirname + '/img/presented_by_wide.svg');
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

const render_slideshow = (gist, theme, gist_id, cb) => {
  if(config.get('DEBUG') >= 1){
    if(bitly_gist_ids[gist.id]){
      console.log("200: https://bit.ly/" + bitly_gist_ids[gist.id] + " -> https://gist.github.com/" +gist.owner.login +"/"+ gist.id);
    }else if (gist.id === "gist-reveal-rate-limit-error"){
      console.log("403: ERROR API Rate Limit Reached!");
    }else if (gist.id === "gist-reveal-render-error"){
      console.log("404: "+ gist_id );
    }else{
      console.log("200: https://gist.github.com/" +gist.owner.login +"/"+ gist.id);
    }
  }
  var print_pdf_href = "/"+gist_id;
  if( theme && theme != config.get('REVEAL_THEME') ){
    print_pdf_href=print_pdf_href+"?theme="+theme+"&print-pdf";
  }else{
    print_pdf_href=print_pdf_href+"?print-pdf";
  }
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
                           .replace(/\{\{template_gist_url}}/, config.get('TEMPLATE_GIST_URL')+gist_id)
                           .replace(/\{\{template_gist_text}}/, config.get('TEMPLATE_GIST_TEXT')+user)
                           .replace(/\{\{template_gist_img}}/, config.get('TEMPLATE_GIST_IMG')+user+'.svg')
                           .replace(/\{\{gist_id}}/, gist.id)
                           .replace(/\{\{print-pdf-href}}/, print_pdf_href)
                           .replace(/\{\{user}}/, user)
                           .replace(/\{\{description}}/, description)
    )
    return index;
  });
};

const install_theme = (gist) => {
  let data, theme_folder;
  if(gist.id === "gist-reveal-render-error" || gist.id === "gist-reveal-rate-limit-error"){
    return;
  }
  if(process.env.NODE_ENV == "production"){
    theme_folder = path.resolve('/','tmp','gists',gist.id);
  }else{
    theme_folder = path.resolve('css','theme','gists',gist.id);
  }
  let filenm = '';
  let filename = '';
  if(config.get('DEBUG') >= 1){
    console.log("installing gist: https://gist.github.com/"+gist.id);
  }
  try{
    fs.mkdir(theme_folder, {recursive: true}, async function(errs){
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
              if(config.get('DEBUG') >= 1){
                console.log('theme installed: https://gist.github.com/' +gist.owner.login +"/"+gist.id);
              }
            }
          });
        }else{
          if(process.env.NODE_ENV == "production"){
            filename = path.resolve('/','tmp','gists',gist.id,filenm)
          }else{
            filename = path.resolve('css','theme','gists',gist.id,filenm)
          }

          const response = await fetch(gist.files[i].raw_url);
          if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);
          await streamPipeline(response.body, createWriteStream(filename));
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
      if(config.get('DEBUG') >= 1 && gist_id !== config.get('REVEAL_THEME')){
        console.log("theme: " + gist_id);
      }
      cb('gists/'+gist_id+'/'+gist_id);
    }else{
      //console.log("new theme: " + gist_id);
      get_gist(gist_id, (response, gist) => {
        //cache the content
        if (response.ok && !response.error_404 ) {
          install_theme(gist);
          if(config.get('DEBUG') >= 3){
            console.log("gist retrieved : " + gist_id);
          }
          cb('gists/'+gist_id+'/'+gist_id)
        }else if (gist.id == 'gist-reveal-render-error'){
          if(config.get('DEBUG') >= 1){
            console.log("theme: " + gist_id);
          }
          cb(gist_id);
        }else{
          if(config.get('DEBUG') >= 1){
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
  res.status(200);
  res.header('Content-Type', 'image/svg+xml');
  //TODO: GUESS THE TEXT WIDTH?:
  if( presenter_name.length >= 17 ){
    res.end(presented_by_wide.toString().replace(/gist-reveal/, "@"+presenter_name));
  }else if( presenter_name.length >= 14){
    res.end(presented_by_medium.toString().replace(/gist-reveal/, "@"+presenter_name));
  }else if( presenter_name.length >= 12){
    res.end(presented_by_med.toString().replace(/gist-reveal/, "@"+presenter_name));
  }else if( presenter_name.length >= 9){
    res.end(presented_by_small.toString().replace(/gist-reveal/, "@"+presenter_name));
  }else{
    res.end(presented_by.toString().replace(/gist-reveal/, "@"+presenter_name));
  }
};

let concurrency = 0;
let gist_owners = [];
let gist_tokens = [];

const cache_bitlink = (shortname, gist_id) => {
  if(shortname && gist_id && gist_id !== config.get('DEFAULT_GIST')){
    if( bitly_gist_ids[gist_id] ){
      console.log("bitlink cache conflict: limit one bitlink per gist id!")
    }else{
      bitly_short_names[shortname] = gist_id;
      bitly_gist_ids[gist_id] = shortname;
      console.log("cached: https://bit.ly/"+shortname+" -> https://gist.github.com/" + gist_id);
    }
  }
}
const get_bitlink = async (req, res, next) => {
  const short_name = req.params.short_name || req.query.short_name;
  const theme = req.params.theme || req.query.theme;
  const payload_identifier="<meta name=\"gist_id\" content=\"";
  let payload_id,payload_offset,id_start,payload_end;

  //if the bitly_short_name is in the cache, call get_slides on the cached id
  if( !!bitly_short_names[short_name] ){
    //console.log("gist_id found in bitlink cache");
    req.params.gist_id = bitly_short_names[short_name];
    get_slides(req, res, next);
  
  //else return a redirect to bit.ly, let them service the request
  } else {
    console.log('looking up bitlink: http://bit.ly/' + short_name );
    const response = await fetch("http://bit.ly/"+short_name);
    if(response.ok){
      const payload = await response.text();
      payload_offset = payload.indexOf(payload_identifier)
      id_start = payload_offset+payload_identifier.length;
      payload_end = payload.indexOf('"', id_start)
      payload_id = payload.substring(id_start, payload_end);
      //console.log("bitlink id: " + payload_id);
      if(payload_offset !== -1 && payload_id){
        if(!bitly_short_names[short_name] && !bitly_gist_ids[payload_id]){
          cache_bitlink(short_name,payload_id);
          if( theme ){
            res.redirect('/bit.ly/'+bitly_gist_ids[payload_id]+'?theme='+theme);
          }else{
            res.redirect("/bit.ly/"+bitly_gist_ids[payload_id]);
          }
        }
      }else{
        console.log("bitlink not found: bit.ly/"+short_name);
        res.redirect('http://bit.ly/' + short_name);
      }
    }else{
      console.log("bitlink not found: bit.ly/"+short_name);
      res.redirect('http://bit.ly/' + short_name);
    }
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
  if( !!bitly_gist_ids[gist_id] && req.path.indexOf('bit') !== 1 ){
    //console.log("redirecting to: /bit.ly/" + bitly_gist_ids[gist_id]);
    if( req.query['theme'] ){
      res.redirect('/bit.ly/'+bitly_gist_ids[gist_id]+'?theme='+theme);
    }else{
      res.redirect("/bit.ly/"+bitly_gist_ids[gist_id]);
    }
  }else if( config.get('GIST_FILENAME')){
    get_local_slides( (gist) => {
      render_slideshow(gist, theme, gist_id, (slides) => {
        res.send(slides);
        //return next();
      });
    });
  }else{
    get_gist(gist_id, (response, thegist) => {
      if (response.ok) {
        if (response.error_404) {
          res.status(404);
        }
        gist = thegist;
      }else if (response.status == 403){
        gist = rate_limit_slides;
        res.status(403);
      }else if (response.status == 401){
        gist = rate_limit_slides;
        res.status(401);
        console.log("ERROR: GH_API_TOKEN expired or invalid");
      }else{
        gist = error_slides;
        res.status(404);
      }
      render_slideshow(gist, theme, gist_id, (slides) => {
        res.send(slides);
        //return next();
      });
    });
  }
}

const get_gist = async (gist_id, cb) => {
  const min_gist_id_length = 20;
  if( gist_id.length && gist_id.length >= min_gist_id_length && gist_id.indexOf(".") == -1 && gist_id.indexOf("-") == -1 && gist_id.indexOf("_") == -1 ){
    const gist_api_url = "https://api.github.com/gists/";
    let headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': "gist-reveal.it",
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if( typeof config.get('GH_API_TOKEN') !== "undefined" && config.get('GH_API_TOKEN') !== "" ){
      headers['Authorization'] = 'Bearer '+config.get('GH_API_TOKEN');
    }
    if(config.get('DEBUG') >= 4){
      console.log("fetch: "+gist_api_url + gist_id);
    }
    const response = await fetch( gist_api_url + gist_id, { headers: headers });
    const body = await response.json();
    cb(response, body);
  }else{
    cb({ok: true, 'error_404': true}, error_slides);
  }
}

app.get("/github/callback", async(req,res) => {
  const params = {
    "client_id": config.get('CLIENT_ID'),
    "client_secret": config.get('CLIENT_SECRET'),
    "code": req.params.code || req.query.code
  }
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: "post",
    headers: {
      'User-Agent': 'gist-reveal',
      'Content-Type': 'application/json',
      'Accept': "application/json"
    },
    body: JSON.stringify(params)
  });
  const body = await response.json();
  if(body.access_token){
    const encoded = encrypt(body.access_token);
    if(config.get('DEBUG') >= 1){
      console.log("201: /login SUCCESS")
    }
    res.redirect('/?setToken='+encoded);
  }else{
    res.redirect('/');
  }
});

app.get("/logout", (req,res) => {
  if(config.get('DEBUG') >= 1){ console.log("302: /logout") }
  res.redirect('/?clearToken');
});
app.get("/login", (req,res) => {
  if(config.get('DEBUG') >= 2){ console.log("302: /login REQUEST") }
  res.redirect('https://github.com/login/oauth/authorize?client_id='+config.get('CLIENT_ID'));
});

let io = new Server(server);
if(config.get('WEBSOCKET_ENABLED') !== "false" &&
   config.get('CLIENT_ID') !== "" &&
   config.get('CLIENT_SECRET') !== "" &&
   !config.get('GIST_FILENAME')){

  console.log('Websockets: Enabled');
  io.on('connection', (socket) => {
    concurrency = concurrency+1;
    if(config.get('DEBUG') >= 3){
      console.log("Concurrency: " + concurrency)
    }
    var checkAndReflect = (data) => {
      if (typeof data.secret == 'undefined' || data.secret == null || data.secret === '') {
        if(config.get('DEBUG') >= 2){
          console.log('Discarding mismatched socket data');
        }
        return;
      }
      if ( gist_tokens[data.gistId] === data.secret ) {
        data.secret = null; 
        socket.to(data.gistId).emit(data.socketId, data);
      }else{
        if(config.get('DEBUG') >= 2){
          console.log('Discarding mismatched presenter actions on: '+data.gistId);
        }
      };      
    };
    socket.on('listen', (data) => {
      socket.join(data.gistId);
    });
    socket.on('presentation_auth', async(data) => {
      if(data.secret && data.gistId){
        socket.join(data.gistId);
        try{
          const data_secret = decrypt({iv: iv, encryptedData: data.secret });
          const response = await fetch(
            "https://api.github.com/user", {
            headers: {
              "Authorization": "Bearer "+data_secret,
              "User-Agent": "gist-reveal.it",
              "Accept": "application/json",
              "Content-Type": "application/json"
            }
          });
          const b = await response.json();
          if(b && b.login){
            if(gist_owners[data.gistId] === b.login){
              gist_tokens[data.gistId] = data.secret;
              const ids = await io.allSockets();
              // update concurrency counter
              concurrency = ids.size ? ids.size : 1;
              const roomClients = await io.in(data.gistId).allSockets();
              //const roomClients = io.sockets.adapter.rooms.get(data.gistId);
              const numClients = roomClients ? roomClients.size : 0;
              const counterMsg = "@"+b.login + " is broadcasting "+ data.gistId +" to "+ numClients+" of "+concurrency + " viewers";
              console.log(counterMsg);
              socket.to(data.gistId).emit( data.socketId, {alert: counterMsg });
              socket.emit( data.socketId, {alert: counterMsg, auth: true, gistId: data.gistId });
            }else{
              console.log("@"+b.login + " does not own: " +data.gistId);
              socket.emit( data.socketId, {alert: "Auth Error: Only the gist owner is allowed to broadcast "+data.gistId });
            }
          }else{
            console.log("User token failed. Sending Logout signal..." );
            socket.emit( data.socketId, { logout: true });
          }
        } catch (err){
            console.log("User token failed. Sending Logout signal..." );
            socket.emit( data.socketId, { logout: true });
        }
      }else{
        // logout?
      }
    });
    socket.on('slidechanged', checkAndReflect);
    socket.on('navigation', checkAndReflect);
    socket.on('disconnect', () => {
      concurrency = concurrency -1;
      if(config.get('DEBUG') >= 3){
        console.log("Concurrency: " + concurrency)
      }
    })
  });
}else{
  console.log('Websockets: Unavailable');
  io.on('connection', (socket) => {return;});
}
// Install Default Gist theme
if(config.get('GIST_THEMES') && config.get('REVEAL_THEME')){
  get_theme(config.get('REVEAL_THEME'), ()=>{})
}
// Install Additional Gist themes (CSV)
if(config.get('GIST_THEMES') && process.env.INIT_THEMES){
  for(let theme of process.env.INIT_THEMES.split(",")){
    get_theme(theme, ()=>{})
  }
}
//Import bitlink cache from CSV:
if(process.env.BITLINK_CSV){
  try{
    fs.readFile(process.env.BITLINK_CSV, "utf8", (error, textContent) => {
      if(error){
        console.error("Failed to import csv: "+ process.env.BITLINK_CSV );
      }else{
        console.log("Importing bitlink csv: "+ process.env.BITLINK_CSV );
        for(let row of textContent.split("\n")){
          const rowItems = row.split(",");
          if(rowItems[0] && rowItems[1]){
            cache_bitlink(rowItems[0],rowItems[1]);
          }
        }
      }
    });
  } catch (error){
    console.error("Failed to import csv: "+ process.env.BITLINK_CSV );
  }
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
app.get("/robots.txt", (req,res,next) => {
  const robot_resp = `User-agent: *
Disallow: /`;
  return res.send(robot_resp);
});
if(config.get("FILTER_REQUESTS") == "true"){
  //reject requests for .env*
  app.get(/^\/\.env.*/, (req,res,next) => {
    if(config.get('DEBUG') >= 2){console.log("404: "+req.url);}
    return res.status(404).send("Not Found: "+req.url);
  });
  //reject requests for *.zip, *.sql
  app.get(/.*\.(sql|zip)$/, (req,res,next) => {
    if(config.get('DEBUG') >= 2){console.log("404: "+req.url);}
    return res.status(404).send("Not Found: "+req.url);
  });
  //reject requests for *.php.*
  app.get(/.*\.(php|PhP).*/, (req,res,next) => {
    if(config.get('DEBUG') >= 2){console.log("404: "+req.url);}
    return res.status(404).send("Not Found: "+req.url);
  });
}
app.get("/favicon.ico", (req,res,next) => {
  return res.send(favicon);
});
app.get("/status", (req,res,next) => {
  return res.send('ok');
});

// Static files:
if(process.env.NODE_ENV == 'production'){
  app.use('/css/theme/gists', express.static('/tmp/gists'));
}else{
  app.use('/css/theme/gists', express.static(path.resolve(__dirname,'css','theme','gists')));
}
app.use('/css/', express.static(path.resolve(__dirname,'css')));
app.use('/js/', express.static(path.resolve(__dirname,'js')));
app.use('/img/', express.static(path.resolve(__dirname,'img')));
app.use('/node_modules/', express.static(path.resolve(__dirname,'node_modules')));
app.get("/", get_slides);

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
  console.log( "gist-reveal PORT: " + config.get('PORT') );
});
