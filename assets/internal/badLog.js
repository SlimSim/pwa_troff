(function () {
	if( !window.console ) {
		return;
	}
	//let cl,ce,cw;

	let badLogJsParent = $("<section>" ).addClass("bg-Burlywood normalSize");
	let badLogJs = $("<div>" ).addClass("vScroll h-100 overflow-y-auto-on-mobile mw-fit-content-on-mobile");
	let badLogClear = $("<button>Clear</button>").on( "click", function(){
		let ok = $( "<button>Sure?</button>").on("click", function(){
			badLogJs.empty();
			ok.remove();
			cancel.remove();
		});
		let cancel =  $( "<button>Cancel</button>").on("click", function(){
			ok.remove();
			cancel.remove();
		});
		badLogClear
			.after( ok )
			.after( cancel );
	} );
	let badLogCopy = $("<button>Copy Log</button>").on( "click", function() {
		let text = "";
		badLogJs.children().children().each( function( i, v ) {
			text += $( v ).text() + "\n";
		} );
		navigator.clipboard.writeText( text );
	} );
	badLogJsParent.append( badLogClear );
	badLogJsParent.append( badLogCopy );
	badLogJsParent.append( badLogJs );

	$("body").append( badLogJsParent );

	let print = function( args, color, char ) {
		let length = args.length;
		let $log = $( "<div>").addClass("pt-3").css( "color", color );

		for( let i = 0; i < args.length; i++ ) {
			let content = typeof args[i] == "object" ? JSON.stringify( args[i] ) : args[i];
			let arg =  $( "<div>" + char + content + "</div>" );
			char = "";
			if( i != 0 ) {
				arg.addClass("small");
			}
			$log.append( arg );
		}

		badLogJs.append( $log );
	}


	if( console.log ) {
		//let cl = console.log;
		let kk = console.warn;
		console.log = function(){
			print(arguments, "#000000", "L: ");
			//cl.apply(this, arguments)
			kk.apply(this, arguments)
		}
	}

	if( console.info ) {
		let ci = console.info;
		console.info = function(){
			print(arguments, "#0000ff", "I: ");
			ci.apply(this, arguments)
		}
	}

	if( console.warn ) {
		let cw = console.warn;
		console.warn = function(){
			print(arguments, "#ffff44", "W: ");
			cw.apply(this, arguments)
		}
	}

	if( console.error ) {
		let ce = console.error;
		console.error = function(){
			print(arguments, "#cc1111", "E: ");
			ce.apply(this, arguments)
		}
	}


$( "body" ).on( "touchstart", (e) => {
	e.preventDefault();
} );

}());
