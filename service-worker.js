/*
 * when updating a file
 * (or adding files / changing file-names in these lists)
 * make sure to update the version-number of the appropriate cache!
 *  - this will make sure that the service-worker is updated at the client.
 *
 * You can also select the "Application"-tab in the inspector and
 * in the Cache area, under "Cache Storage", delete the appropriate cache.
 *  - but this obviously only works for development!
 *
 * When the client shuts down it's browser, and goes to the page again
 * then the new service-worker will be active
 * (unless return this.skipWaiting() is active in the install-listener)
 *
 * NOTE: if a single url that this script tries to cache fails
 * (it might not exist, or times out or something)
 * then it will console.info that url
 * and continue with the rest of the urls in that cache-block.
 */

/*
 * tip: Root-relative Hyperlinks start with a '/'
 * for instance /pwa.js
 */
var newAppCaches = [
	{
		name: 'core',
		version: "1.5.20",
		urls: [
			"/",
			"/index.html",
			"/script.js",
			"/pwa.js",
			"/file.js",
			"/help.html",
			"/FileApiImplementation.js"
		]
	},
	{
		name: 'style-assets',
		version: "1.3.12",
		urls: [
			"/stylesheets/style.css",
			"/stylesheets/style-max-width-576.css",
			"/stylesheets/col1.css",
			"/stylesheets/col2.css",
			"/stylesheets/col3.css",
			"/stylesheets/col4.css",
			"/stylesheets/help-style.css",
			"/stylesheets/style-standard.css",
			"/stylesheets/style-standard-min-width-576.css",
		]
	},
	{
		name: 'include-assets',
		version: "1.0.5",
		urls: [
			"/includes/quick-help.html",
		]
	},
	{
		name: 'app-assets',
		version: "1.3.7",
		urls: [
			"/assets/logos/favicon.ico",
			"/assets/logos/logo.svg",
			"/assets/logos/logo-016.png",
			"/assets/logos/logo-036.png",
			"/assets/logos/logo-048.png",
			"/assets/logos/logo-078.png",
			"/assets/logos/logo-096.png",
			"/assets/logos/logo-128.png",
			"/assets/logos/logo-192-non-transparent.png",
			"/assets/logos/logo-demo-192-maskable.png",
			"/assets/logos/question-mark-192-maskable.png",
			"/assets/logos/shield-192-maskable.png",
			"/assets/logos/gavel-192-maskable.png",
			"/assets/logos/logo-256.png",
			"/assets/logos/logo-512.png",
			"/assets/logos/logo-512-maskable.png",
			"/manifest.json",
			"/privacy_policy.html",
			"/LICENSE.html",
			"/terms.html", //<-- should not be cached, but loaded every time to get the latest version.
			"/README.md",
		]
	},
	{
		name: 'internal-assets',
		version: "1.2.5",
		urls: [
			"/assets/internal/common.js",
			"/assets/internal/cookie_consent.js",
			"/assets/internal/st-script.js",
			"/assets/internal/environment.js",
			"/assets/internal/extend-jquery.js",
			"/assets/internal/fontello-extra.css",
			"/assets/internal/notify-js/notify.css",
			"/assets/internal/notify-js/notify.config.js"
		]
	},
	{
		name: 'external-assets',
		version: "1.2.4",
		urls: [
			"/assets/external/checkbox.css",
			"/assets/external/jquery-3.6.0.min.js",
			"/assets/external/reset.css",
			"/assets/external/notify-js/notify.min.js",
			"/assets/external/Fontello-2021-08-12/css/troff-icon-pack.css",
			"/assets/external/Fontello-2021-08-12/font/troff-icon-pack.eot?2742147",
			"/assets/external/Fontello-2021-08-12/font/troff-icon-pack.svg?2742147",
			"/assets/external/Fontello-2021-08-12/font/troff-icon-pack.ttf?2742147",
			"/assets/external/Fontello-2021-08-12/font/troff-icon-pack.woff?2742147",
			"/assets/external/Fontello-2021-08-12/font/troff-icon-pack.woff2?2742147",
			"/assets/external/DataTables/css/dataTables.needed.min.css",
			"/assets/external/DataTables/images/sort_asc.png",
			"/assets/external/DataTables/images/sort_asc_disabled.png",
			"/assets/external/DataTables/images/sort_both.png",
			"/assets/external/DataTables/images/sort_desc.png",
			"/assets/external/DataTables/images/sort_desc_disabled.png",
			"/assets/external/DataTables/js/jquery.dataTables.min.js"
		]
}];

function createCacheKey(name, version) {
	return name + "-v" + version;
}

self.addEventListener( "install", function ( event ) {

	function addToCache(cache, url) {
		cache.add(url).catch(e => {
			console.info(`Info: cache.add( ${ url } ) fails:`, e);
		});
	}

	event.waitUntil(caches.keys().then(function(existingKeys) {
		return Promise.all(newAppCaches.map(function(appCache) {
			let appCacheKey = createCacheKey(appCache.name, appCache.version);
			if (existingKeys.indexOf(appCacheKey) === -1) {
				return caches.open(appCacheKey).then(function(cache) {
					appCache.urls.forEach(url => addToCache(cache, url));
					return Promise.resolve(true);
				});
			} else {
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

			//return this.skipWaiting();
		})
		.catch(function(e) {
			console.info("Promise.all catch:", e);
		});
	}));
});

self.addEventListener( "activate", function( event ) {
	event.waitUntil(
		caches.keys().then(function(existingKeys) {

			return Promise.all(newAppCaches.map(newCache => {

				return existingKeys.map(existingKey => {
					if (existingKey.indexOf(newCache.name) !== -1 &&
						existingKey !== createCacheKey(newCache.name, newCache.version)) {
						return caches.delete(existingKey);
					}
				});
			}));
		})
	);
});

console.log( "service-worker.js -> ");
self.console.log( "service-worker.js -> ");


self.addEventListener( "fetch", event => {
	console.log( "fetch: " + event.request.method + " " + event.request.url );
	event.respondWith(
		caches.match( event.request )
		.then( cachedResponse => {
			//return cachedResponse || fetch( event.request );

			if( cachedResponse ) {
				return cachedResponse;
			//} else if( event.request.url.indexOf( "google" ) =! -1 ) {
      //	console.info( "fetching googletagmanager" );
      //	return fetch( event.request );
      } else {
      	console.log( "fetch.request was not cached:", event.request );
      	return fetch( event.request )
      	.then( response => {
      		console.log( "fetch.then  -> " );
      		console.log( response );
      		return response;
      	})
      	.catch( error => {
      		console.log( "fetch.catch -> " );
      		console.log( error );
      		console.log( "Response.error():" );
      		console.log( Response.error() );
      		return Response.error();
      	});
      }

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
