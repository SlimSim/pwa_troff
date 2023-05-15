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
		version: "1.12.94",
		urls: [
			"/",
			"/index.html",
			"/script.js",
			"/pwa.js",
			"/file.js",
			"/help.html",
			"/find.js",
			"/find.html",
			"/FileApiImplementation.js"
		]
	},
	{
		name: 'style-assets',
		version: "1.8",
		urls: [
			"/stylesheets/style.css",
			"/stylesheets/col1.css",
			"/stylesheets/col2.css",
			"/stylesheets/col3.css",
			"/stylesheets/col4.css",
			"/stylesheets/help-style.css",
			"/stylesheets/style-standard.css",
		]
	},
	{
		name: 'include-assets',
		version: "1.2",
		urls: [
			"/includes/quick-help.html",
		]
	},
	{
		name: 'app-assets',
		version: "1.8",
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
		version: "1.5",
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
		version: "1.4",
		urls: [
			"/assets/external/checkbox.css",
			"/assets/external/jquery-3.6.0.min.js",
			"/assets/external/reset.css",
			"/assets/external/notify-js/notify.min.js",
			"/assets/external/Fontello-2023-05-08/css/troff-icon-pack.css",
			"/assets/external/Fontello-2023-05-08/font/troff-icon-pack.eot?2742147",
			"/assets/external/Fontello-2023-05-08/font/troff-icon-pack.svg?2742147",
			"/assets/external/Fontello-2023-05-08/font/troff-icon-pack.ttf?2742147",
			"/assets/external/Fontello-2023-05-08/font/troff-icon-pack.woff?2742147",
			"/assets/external/Fontello-2023-05-08/font/troff-icon-pack.woff2?2742147",
			"/assets/external/signInLogos/google-logo.svg",
			"/assets/external/signInLogos/facebook-logo.svg",
			"/assets/external/browserLogos/chrome-logo.svg",
			"/assets/external/browserLogos/chromium-logo.svg",
			"/assets/external/browserLogos/edge-logo.svg",
			"/assets/external/browserLogos/firefox-logo.svg",
			"/assets/external/browserLogos/ios-logo.svg",
			"/assets/external/browserLogos/safari-logo.svg",
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
			if( typeof BroadcastChannel === 'undefined' ) {
				return;
			}
			const channel = new BroadcastChannel('service-worker-broadcastChanel');

			channel.postMessage( "install" );

			return this.skipWaiting();
		})
		.catch(function(e) {
			console.error("Promise.all catch:", e);
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

self.addEventListener( "fetch", event => {
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
      	return fetch( event.request )
      	.then( response => {
      		return response;
      	})
      	.catch( error => {
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
