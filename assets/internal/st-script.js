
const st = {};

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


$( document ).ready( function() {

	st.confirm = function(textHead, textBox, funcOk, funcCancel) {
		let outerDiv = $( "<div>" ).addClass("outerDialog onTop");
		let innerDiv = $( "<div>" ).addClass("innerDialog m-4");

		let clickOk = function() {
			if( funcOk ) funcOk();
			document.removeEventListener('keydown', onKeyDown );
			outerDiv.remove();
		};

		let clickCancel = function() {
			if( funcCancel ) funcCancel();
			document.removeEventListener('keydown', onKeyDown );
			outerDiv.remove();
		};

		let buttRow = $( "<div>" )
			.append(
				$("<input>" )
					.addClass( "regularButton" )
					.attr( "type", "button" ).attr( "value", "OK" )
					.on( "click", clickOk )
			)
			.append(
				$("<input>" )
					.addClass( "regularButton" )
					.attr( "type", "button" ).attr( "value", "Cancel" )
					.on( "click", clickCancel )
			);

		innerDiv
			.append( $( "<h2>" ).html( textHead ) )
			.append( $( "<p>" ).addClass( "py-2 text-break w-auto" ).html( textBox ) )
			.append( buttRow );

		document.addEventListener('keydown', onKeyDown );

		function onKeyDown( event ) {
			event.preventDefault();
			if(event.keyCode == 13){
				clickOk();
			}
			if(event.keyCode == 27){
				clickCancel();
			}
		}

		$( "body" ).append( outerDiv.append( innerDiv ) );
	}; // end confirm

	st.secToDisp = function( seconds ) {
		var sec = (seconds | 0) % 60;
		if (sec < 10)
			sec = "0" + sec;
		var min = (seconds / 60) | 0;
		return min + ':' + sec;
	};

	st.millisToDisp = function( millis ) {
		if( !millis || millis < 162431283500 ) {
			return "";
		}

		const date = new Date( millis );

		const d = date.getDate();
		const m = date.getMonth() + 1;

		const dd = d < 10 ? "0" + d : d;
		const mm = m < 10 ? "0" + m : m;
		const year = "" + date.getFullYear();

		return year + "-" +  mm + "-" + dd;
	}

	st.byteToDisp = function( byte ) {
		if( byte == undefined ) {
			return "";
		}
		var nrTimes = 0;
			units = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

		while( byte >= 1000 ) {
			nrTimes++;
			byte = byte / 1000;
			if(nrTimes > units.length)
				return byte;
		}

		return Math.round( byte * 10 ) / 10 + units[nrTimes];
	}

	st.defaultFor = function(arg, val) {
		return typeof arg !== 'undefined' ? arg : val;
	}

	var ST_DB = { // new data base
		set : function( key, value ) {
			window.localStorage.setItem( key, JSON.stringify( value ) );
		},
		get : function( key ) {
			return JSON.parse( window.localStorage.getItem( key ) );
		},
	},

	ST_DBc = { //new data base callback
		get : function( key, callback ) {
			callback( ST_DB.get( key ) );
		}

	},

	dataSaveValue = function() {
		IO.blurHack();
		var $target = $( event.target ),
			id = $target.attr( "id" ),
			value = $target.val();

		if( id == undefined ) {
			console.error( 'This element is missing "id", can not save!', $target );
			return;
		}

		key = "TROFF_SAVE_VALUE_" + id;

		ST_DB.set( key, value );
	};


/**
 * Hide and Save
 * functionality for letting a button hide another div or such
 * also functionality for saving that value in the DB :)
*/

$( "[data-st-css-selector-to-toggle]" ).on( "click", function( event ) {
	let $target = $( event.target ).closest( "[data-st-css-selector-to-toggle]" );
	$( $target.data( "st-css-selector-to-toggle" ) ).toggleClass( "hidden" );
} );

$( "[data-st-css-selector-to-fade-in]" ).on( "click", function( event ) {
	let $target = $( event.target )
		.closest( "[data-st-css-selector-to-fade-in]" );

		$( $target.data( "st-css-selector-to-fade-in" ) ).toggleClass( "fadeIn" );
} );

$("[data-st-save-current-value]").change( dataSaveValue );

$( "[data-st-save-current-value]" ).each( function( i, element ){
	var $target = $( element ),
		key = "TROFF_SAVE_VALUE_" + $target.attr( "id" );

		ST_DBc.get( key, function( value ) {
			//var value = ret[key];

			if( value === undefined || value === null ) {
				value = $target.data( "st-save-current-value" );
			}

			$target.val( value );
		});

});

$( ".st-simple-on-off-button" ).each( function( i, v ) {
	var $v = $(v),
		cssSelectorToHide = $v.data( "st-css-selector-to-hide" );
	if( $v.data( "st-save-value-key" ) ) {
		var key = $v.data( "st-save-value-key" );
		ST_DBc.get( key, function( savedValue ) {
			//var savedValue = item[ key ];

			if( savedValue === undefined || savedValue === null ) {
				if( $v.hasClass( "active" ) ) {
					$( cssSelectorToHide ).removeClass( "hidden" );
				} else {
					$( cssSelectorToHide ).addClass( "hidden" );
				}
			} else if( savedValue ) {
				$v.addClass( "active" );
				$( cssSelectorToHide ).removeClass( "hidden" );
			} else {
				$v.removeClass( "active" );
				$( cssSelectorToHide ).addClass( "hidden" );
			}
		} );
	} else {
		if( $v.hasClass( "active" ) ) {
			$( cssSelectorToHide ).removeClass( "hidden" );
		} else {
			$( cssSelectorToHide ).addClass( "hidden" );
		}
	}

} );

$( ".st-simple-on-off-button" ).click( function( event ) {
	var $target = $( event.target ).closest( ".st-simple-on-off-button" ),
		cssSelectorToHide = $target.data( "st-css-selector-to-hide" ),
		selectKey = $target.data( "st-select-key" ),
		setActive = !$target.hasClass( "active" );

	if( selectKey ) {
		$( "[data-st-select-key=" + selectKey + "]" ).each( (i, v) => {
				$(v).removeClass( "active" );
        ST_DB.set( $(v).data( "st-save-value-key" ), false );
    });
	}

	if( setActive ) {
		$target.addClass( "active" );
	} else {
		$target.removeClass( "active" );
	}

	if( cssSelectorToHide ) {
		if( setActive ) {
			$( cssSelectorToHide ).removeClass( "hidden" );
		} else {
			$( cssSelectorToHide ).addClass( "hidden" );
		}
	}
	if( $target.data( "st-save-value-key" ) ) {
//		var o = {};
//		o[ $target.data( "st-save-value-key" ) ] = setActive;
		ST_DB.set( $target.data( "st-save-value-key" ), setActive );
	}
} );

/* Hide and Save end */

$( ".toggleNext" ).on( "click", ( e ) => { $( e.target ).closest( ".toggleNext" ).toggleClass( "showNext" ) } );



} ); // end document ready
