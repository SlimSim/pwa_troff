// ES6 module version of FileApiImplementation.js for testing
// Export key objects and functions for testability

// Export cacheImplementation object
export const cacheImplementation = {
	nameOfCache : "songCache-v1.0",

	saveSong : async function( songKey, songData ) {
		var blob = new Blob([ JSON.stringify(songData) ], { type : 'application/json' }),
			init = { "status" : 200 , "statusText" : "SuperSmashingGreat!" },
			myResponseObject = new Response( blob, init );

		return caches.open( this.nameOfCache ).then(  cache => {
			return cache.put( songKey, myResponseObject );
		} );
	},

	isSongV2: async function( songKey ) {
		return caches.match(songKey).then(cachedResponse => {
			if (cachedResponse === undefined) {
				throw new Error(`songKey \"${songKey}\" does not exist in caches!`);
			}
			// Note, with the version 2,
			// every song was cached with the status text "SuperSmashingGreat!"
			return cachedResponse.statusText == "SuperSmashingGreat!";
		});
	},

	getSong : async function( songKey ) {
		return caches.match(songKey).then(cachedResponse => {
			if (cachedResponse === undefined) {
				throw new Error(`songKey \"${songKey}\" does not exist in caches!`);
			}
			return cachedResponse.json();
		});
	},

	removeSong : async function( songKey ) {
		return caches.open( this.nameOfCache ).then(  cache => {
			return cache.delete( songKey );
		} );
	},

	getAllKeys : async function() {
		return caches.open( this.nameOfCache ).then( cache => {
			return cache.keys().then( keys =>
				keys.map( key => decodeURIComponent( key.url.split("/").pop() ) )
			);
		});
	}
};
