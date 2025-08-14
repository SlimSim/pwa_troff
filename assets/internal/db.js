
const nDB = { // new data base
    setOnSong : function( songId, keys, value ) {
      if( typeof keys != "object" ) {
        keys = [ keys ];
      }
  
      let valObject = [];
      valObject[ 0 ] = nDB.get( songId );
      if( valObject[ 0 ] == undefined ) {
        console.error(
          "setOnSong: songId does no exist in database. You are trying to set " + value +
          " on the property " + keys[0] +
          " on the song " + songId +
          ", but that song does not exist in the DB, RETURNING" );
          return
      }
  
      for( let i = 0; i < keys.length - 1; i++) {
  
        if( typeof valObject[ i ] != "object" ) {
          if( i == 1 ) {
            console.warn(
              "setOnSong: Adding key to songObject, the object does not have the key \"" + keys[ i -1 ] +
              "\", on the song \"" + songId + "\"; it will be added"
            );
          } else {
            console.warn(
              "setOnSong: Adding key to songObject, the object \"" + keys[ i - 2 ] +
              "\"; does not have the key \"" + keys[ i - 1 ] +
              "\"; it will be added" );
          }
          valObject[ i ] = {};
        }
        valObject[ i + 1 ] = valObject[ i ][ keys[ i ] ];
      }
  
      if( typeof valObject[ keys.length - 1] != "object" ) {
        valObject[ keys.length - 1] = {};
      }
      if( typeof valObject[ keys.length - 1] != "object" || valObject[ keys.length - 1][ keys[ keys.length - 1 ] ] === undefined ) {
        console.warn(
          "setOnSong: Adding key to songObject, the object does not have the key \"" + keys[ keys.length - 1 ] +
          "\" " + keys.length + " levels deep, on the song \"" + songId + "\"; it will be added"
        );
      }
      valObject[ keys.length - 1][ keys[ keys.length - 1 ] ] = value;
  
      for( let i = keys.length - 1; i > 0; i-- ){
        valObject[ i-1 ][ keys[ i - 1 ] ] = valObject[ i ];
      }
      nDB.set( songId, valObject[0] );
    },
    set : function( key, value ) {
      window.localStorage.setItem( key, JSON.stringify( value ) );
    },
    get : function( key ) {
      return JSON.parse( window.localStorage.getItem( key ) );
    },
    delete : function( key ) {
      window.localStorage.removeItem( key );
      // todo, add print if "key" do not exist
    },
    getAllKeys : function() {
      return Object.keys(localStorage)
    },
    clearAllStorage : function() {
      localStorage.clear();
    },
  };

  
const nDBc = { //new data base callback

	get : function( key, callback ) {
		callback( nDB.get( key ) );
	},
	getAllKeys : function( callback ) {
		callback( nDB.getAllKeys() );
	},
	getAllKeyValuePairs : function( callback ) {
		callback( nDB.getAllKeyValuePairs() );
	},

}

  
  export { nDB, nDBc };