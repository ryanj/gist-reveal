(function() {
if(Reveal.getConfig().hosted){
    var hosted = Reveal.getConfig().hosted;
    var socket = io.connect(document.location.protocol+'//'+document.location.host);
    var socketId = hosted.id;
    var gist_id = document.head.getElementsByTagName('meta')[4].content;

    //Persist presenter token when supplied via hash:
    if ( window.location.search.search( /\?setToken=[^ ]/i ) == 0){ 
        console.log('Persisting presenter token');
        localStorage.secret = window.location.search.slice(10);
        window.location.search = '';
    }

    if ( typeof(localStorage.secret) == "undefined" || localStorage.secret == null) {
        console.log('Tuning in for gist: ' + gist_id);

        socket.on(hosted.id, function(data) {
          console.dir(data);
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
    }else{
        if ( window.location.search.search( /\?clearToken/i ) >= 0){
          localStorage.clear();
          window.location.search = '';
        }
        console.log('Broadcasting slide: ' + gist_id);

        Reveal.addEventListener( 'fragmentshown', function( event ) {
          console.dir(event);
        	var data = {
        		secret: localStorage.secret,
            gistId: gist_id,
            socketId : hosted.id,
            direction: 'next'
        	};
        	if( typeof event.origin === 'undefined' && event.origin !== 'remote' ) socket.emit('navigation', data);
        } );

        Reveal.addEventListener( 'fragmenthidden', function( event ) {
          console.dir(event);
        	var data = {
        		secret: localStorage.secret,
			gistId: gist_id,
			socketId : hosted.id,
            direction: 'prev'
        	};
        	if( typeof event.origin === 'undefined' && event.origin !== 'remote' ) socket.emit('navigation', data);
        } );

        Reveal.addEventListener( 'slidechanged', function( event ) {
          console.dir(event);
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
        } );
    }
}
}());
