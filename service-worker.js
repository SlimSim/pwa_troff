var appCaches = [

	{
		name: 'core-v1.3.0',
		urls: [
			"/",
			"index.html",
			"script.js",
			"pwa.js",
			"help.html",
			"FileApiImplementation.js"
		]
	},
	{
		name: 'style-assets-v1.0',
		urls: [
			"stylesheets/style.css",
			"stylesheets/col1.css",
			"stylesheets/col2.css",
			"stylesheets/col3.css",
			"stylesheets/col4.css",
			"stylesheets/help-style.css",
			"stylesheets/style-standard.css"
		]
	},
	{
		name: 'app-assets-v1.0',
		urls: [
			"",
			"assets/logos/favicon.ico",
			"assets/logos/logo.svg",
			"assets/logos/logo-016.png",
			"assets/logos/logo-036.png",
			"assets/logos/logo-048.png",
			"assets/logos/logo-078.png",
			"assets/logos/logo-096.png",
			"assets/logos/logo-128.png",
			"assets/logos/logo-192-non-transparent.png",
			"assets/logos/logo-256.png",
			"assets/logos/logo-512.png",
			"manifest.json",
			"LICENSE.html",
			"README.md"
		]
	},
	{
		name: 'internal-assets-v1.0.1',
		urls: [
			"assets/internal/common.js",
			"assets/internal/cookie_consent.js",
			"assets/internal/st-script.js",
			"assets/internal/notify-js/notify.css",
			"assets/internal/notify-js/notify.config.js"
		]
	},
	{
		name: 'external-assets-v1.1.2',
		urls: [
			"assets/external/checkbox.css",
			"assets/external/jquery-3.4.1.min.js",
			"assets/external/reset.css",
			"assets/external/notify-js/notify.min.js",
			"assets/external/bootstrap-4.3.1-dist/css/bootstrap.min.css",
			"assets/external/bootstrap-4.3.1-dist/js/bootstrap.bundle.min.js",
			"assets/external/svg-with-js/css/fa-svg-with-js.css",
			"assets/external/svg-with-js/js/fontawesome-all.min.js",
			/*
			"assets/external/svg-with-js/webfonts/fa-brands-400.svg",
			"assets/external/svg-with-js/webfonts/fa-regular-400.svg",
			"assets/external/svg-with-js/webfonts/fa-solid-900.svg",
			"assets/external/svg-with-js/webfonts/fa-brands-400.ttf",
			"assets/external/svg-with-js/webfonts/fa-regular-400.ttf",
			"assets/external/svg-with-js/webfonts/fa-solid-900.ttf",
			"assets/external/svg-with-js/webfonts/fa-brands-400.eot",
			"assets/external/svg-with-js/webfonts/fa-regular-400.eot",
			"assets/external/svg-with-js/webfonts/fa-solid-900.eot",
			"assets/external/svg-with-js/webfonts/fa-brands-400.woff2",
			"assets/external/svg-with-js/webfonts/fa-regular-400.woff2",
			"assets/external/svg-with-js/webfonts/fa-solid-900.woff2",
			"assets/external/svg-with-js/webfonts/fa-brands-400.woff",
			"assets/external/svg-with-js/webfonts/fa-regular-400.woff",
			"assets/external/svg-with-js/webfonts/fa-solid-900.woff",
			*/
			"assets/external/DataTables/css/jquery.dataTables.min.css",
			"assets/external/DataTables/css/dataTables.jqueryui.min.css",
			"assets/external/DataTables/images/sort_asc.png",
			"assets/external/DataTables/images/sort_asc_disabled.png",
			"assets/external/DataTables/images/sort_both.png",
			"assets/external/DataTables/images/sort_desc.png",
			"assets/external/DataTables/images/sort_desc_disabled.png",
			"assets/external/DataTables/js/jquery.dataTables.min.js"
		]
	}
	
];

console.log( "service-worker-js -> ");

let cacheNames = appCaches.map((cache) => cache.name);

self.addEventListener( "install", function ( event ) {
	console.log( "install -> " );
	event.waitUntil(caches.keys().then(function( keys ) {
		return Promise.all( appCaches.map( function( appCache ) {
			if( keys.indexOf( appCache.name ) === -1 ) {
				return caches.open( appCache.name ).then( function( cache ) {
					return appCache.urls.map( function(v, i) {
						fetch( v ).then(function(response) {
                          if (!response.ok) {
                            throw new TypeError( response.status + ", " + response.statusText + "; " + response.url );
                          }
                          return cache.put(v, response);
                        });
					});

					//return cache.addAll( appCache.urls );
				})
			} else {
				console.log(`found ${appCache.name}`);
				return Promise.resolve(true);
			}
		}))
		.then(function () {

			// From service-worker.js:
			const channel = new BroadcastChannel('service-worker-brodcastChanel');

			channel.postMessage({
				notify : {
					message : "New version are now cached and Troff will work offline.\nHave fun!",
					status : "success"
				}
			});
			return this.skipWaiting();

		});
	}));
});

self.addEventListener( "activate", function( event ) {
	console.log( "activate ->" );
	event.waitUntil(
		caches.keys().then( function( keys ) {
			return Promise.all( keys.map( function( key ) {
				if( cacheNames.indexOf( key ) === -1) {
					return caches.delete( key );
				}
			}));
		})
	);
});

self.addEventListener( "fetch", event => {
	console.log("fetch ->");
	event.respondWith(
		caches.match( event.request )
		.then( cachedResponse => {
			return cachedResponse || fetch( event.request );
			
			// tror att felet med denna är att den INTE returnerar något i sista elsen?
			// if( cachedResponse ) {
			// 	return cachedResponse;
			// } else if( event.request.url.indexOf( "google" ) =! -1 ) {
			// 	console.info( "fetching googletagmanager" );
			// 	return fetch( event.request );
			// } else {
			// 	console.error( "fetch.request was not cached:", event.request );
			// }
			
		})
	);
});
