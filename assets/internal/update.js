/*
	This file is part of Troff.

	Troff is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License,
	or (at your option) any later version.

	Troff is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with Troff. If not, see <http://www.gnu.org/licenses/>.
*/


$( document ).ready( () => {

console.log( "update.js ->" );

function addToCache(cache, url) {
	console.log( "adding " + url + " to ", cache);
	cache.add(url).catch(e => {
		console.info(`Info: cache.add( ${ url } ) fails:`, e);
	});
	console.log( "done" );
}




caches.keys().then( async function(names) {
	console.log( "names", names);
	for (let name of names) {

		if( name.includes( "songCache" ) ) {
			console.log( "skipping name", name );
			continue;
		}

		const urls = ( await (await caches.open( name ) ).keys() ).map( i => i.url );
		console.log( "urls from this cache", urls );
		console.log( "deleting name", name );
		caches.delete( name );

		let cache = await caches.open( name );
		console.log( name + " is open as ", cache );

		urls.forEach( url => addToCache( cache, url ) );

	}
	console.log( "done!" );

	if( "serviceWorker" in navigator) {
  	const serviceWorkerPath = "/service-worker.js";
  	console.log( "serviceWorker is in navigator!");
  	window.addEventListener( "load", () => {
  		console.log( "window is load ->");

  		navigator.serviceWorker.getRegistrations().then(function(registrations) {
  			console.log( "registrations", registrations);
  			for(let registration of registrations) {
  				registration.unregister();
  			}
  		});
  	});
  }

	setTimeout( () => {
		window.location.replace( "/" );
	}, 9000 );
});


/*
This don't seem to fire, the service-worker does not send a message :(
(() => {
	if( typeof BroadcastChannel === 'undefined' ) {
		return;
	}

	const channel = new BroadcastChannel('service-worker-broadcastChanel');
	channel.addEventListener('message', event => {
		console.log( "service-worker-broadcastChanel event", event);
		console.log( "service-worker-broadcastChanel event.data", event.data);

		window.location.replace( "/" );
	});
})();
*/



});
