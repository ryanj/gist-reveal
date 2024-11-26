(function() {
if(Reveal.getConfig().hosted){
    if ( window.location.search.search( /\?clearToken/i ) >= 0){
      localStorage.clear();
      window.location = document.location.protocol+'//'+document.location.host+document.location.pathname;
    }
    var hosted = Reveal.getConfig().hosted;
    var socket = io.connect(document.location.protocol+'//'+document.location.host);
    var socketId = hosted.id;
    const gist_id = document.head.getElementsByTagName('meta')[4].content;
    let broadcasting = false;

    //Persist presenter token when supplied via hash:
    if ( window.location.search.search( /\?setToken=[^ ]/i ) == 0){ 
        console.log('Persisting presenter token');
        localStorage.secret = window.location.search.slice(10);
        window.location = document.location.protocol+'//'+document.location.host+document.location.pathname;
    }

    socket.on(hosted.id, (data) => {
      if (data.logout && localStorage.secret){
        //Token failure, needs refresh?
        localStorage.clear();
        console.log("LOGOUT");
        window.location = document.location.protocol+'//'+document.location.host+document.location.pathname;
      }
      if (data.auth && localStorage.secret && data.alert && data.gistId == gist_id){
        console.log("Auth Success! Broadcasting slide transitions...");
        broadcasting = true;
        console.log(data.alert);
        Reveal.addEventListener( 'fragmentshown', ( event ) => {
          if(broadcasting === true){
            //console.dir(event);
        	var data = {
        		secret: localStorage.secret,
            gistId: gist_id,
            socketId : hosted.id,
            direction: 'next'
        	};
        	if( typeof event.origin === 'undefined' && event.origin !== 'remote' ) socket.emit('navigation', data);
          }
        } );

        Reveal.addEventListener( 'fragmenthidden', ( event ) => {
          if(broadcasting === true){
          //console.dir(event);
        	var data = {
        		secret: localStorage.secret,
			gistId: gist_id,
			socketId : hosted.id,
            direction: 'prev'
        	};
        	if( typeof event.origin === 'undefined' && event.origin !== 'remote' ) socket.emit('navigation', data);
          }
        } );

        Reveal.addEventListener( 'slidechanged', ( event ) => {
          if(broadcasting === true){
          //console.dir(event);
        	var nextindexh;
        	var nextindexv;
        	var slideElement = event.currentSlide;

        	if (slideElement.nextElementSibling && slideElement.parentNode.nodeName == 'SECTION') {
        		nextindexh = event.indexh;
        		nextindexv = event.indexv + 1;
        	} else {
        		nextindexh = event.indexh + 1;
        		nextindexv = 0;
        	}

        	var slideData = {
        		indexh : event.indexh,
        		indexv : event.indexv,
        		nextindexh : nextindexh,
        		nextindexv : nextindexv,
        		secret: localStorage.secret,
			socketId : hosted.id,
			gistId: gist_id
        	};

        	if( typeof event.origin === 'undefined' && event.origin !== 'remote' ) socket.emit('slidechanged', slideData);
          }
        } );
        return;
      }
      if (data.alert){
        //Client listen:
        console.log(data.alert);
        if(broadcasting === true){
          console.log("WARNING: Duplicate browser socket detected! You can only broadcast from one device at a time.");
          console.log("Switching to Listener mode... Reload the page to return to Presenter mode");
          broadcasting = false;
        }
        return;
      }
      // ignore data from sockets that aren't ours
      if (data.socketId !== socketId) { return; }
      // ignore data from slides that aren't ours
      if (data.gistId !== gist_id) { return; }
      if( data.indexh !== undefined && data.indexv !== undefined){
        Reveal.slide(data.indexh, data.indexv, null, 'remote');
      }else{
        if(data.direction == 'next'){
          Reveal.nextFragment();
        }else{
          Reveal.prevFragment();
        }
      }
    });

    if ( typeof(localStorage.secret) == "undefined" || localStorage.secret == null) {
      console.log('Tuning in for gist: ' + gist_id);
      socket.emit('listen', {
        gistId: gist_id,
        socketId : hosted.id
      });
    }else{
      console.log('WARNING: Broadcasting is restricted to gist owners. Not the owner? Fork the gist and load your new gist id to share your slide transitions!');
      console.log('Visit /logout when you are finished presenting');
      socket.emit('presentation_auth', {
        secret: localStorage.secret,
        gistId: gist_id,
        socketId : hosted.id
      });
    }
}
}());
