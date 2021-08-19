$( document ).ready( function() {

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
		setActive = !$target.hasClass( "active" );

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




} ); // end document ready
