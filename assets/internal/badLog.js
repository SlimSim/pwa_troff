(function () {
	if( !window.console ) {
		return;
	}
	//let cl,ce,cw;

	let badLogJsParent = $("<section>" ).addClass("bg-Burlywood normalSize");
	let badLogJs = $("<div>" ).addClass("vScroll h-100 overflow-y-auto-on-mobile mw-fit-content-on-mobile");
	let badLogClear = $("<button>Clear</button>").on( "click", function(){
		badLogJs.empty();
	} );
	badLogJsParent.append( badLogClear );
	badLogJsParent.append( badLogJs );

	$("body").append( badLogJsParent );

	let print = function( args, color ) {
		let length = args.length;
		let $log = $( "<div>").addClass("pt-3").css( "color", color );

		for( let i = 0; i < args.length; i++ ) {
			let arg =  $( "<div>" + args[i] + "</div>" );
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
			print(arguments, "#000000");
			//cl.apply(this, arguments)
			kk.apply(this, arguments)
		}
	}

	if( console.warn ) {
		let cw = console.warn;
		console.warn = function(){
			print(arguments, "#ffff44");
			cw.apply(this, arguments)
		}
	}

	if( console.error ) {
		let ce = console.error;
		console.error = function(){
			print(arguments, "#cc1111");
			ce.apply(this, arguments)
		}
	}


}());
