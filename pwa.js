
if( "serviceWorker" in navigator) {
	const serviceWorkerPath = "/service-worker.js";
	window.addEventListener( "load", () => {
		navigator.serviceWorker.register( serviceWorkerPath )
		.then( reg => {
			reg.update();
		}).catch( error => {
			console.error( "service-worker.js failed to register:", error );
		});
	});
} else {
	console.error( 'No "serviceWorker" in navigator' );
}

var PWA = {};

PWA.listenForInstallPrompt = function() {
	window.addEventListener("beforeinstallprompt", function(e) {
		e.preventDefault(); // Prevents prompt display

		if( $("#pwaAddToHomeScreen").length === 0 ) {
			console.error( "No #pwaAddToHomeScreen detected, can not show add-prompt!" );
			if( confirm( "Do you want to install this app?" ) ) {
				PWA.showPrompt( e );
			}
		}

		$("#pwaAddToHomeScreen").removeClass("hidden");
		$("#pwaAddToHomeScreen").on( "click", function(){
			PWA.showPrompt( e );
		});
		// The event was re-dispatched in response to our request
		// ...
	});

};

PWA.listenForBroadcastChannel = function() {
	if( typeof BroadcastChannel === 'undefined' ) {
		return;
	}

	function updateVersionNumberInHtml( type, versionNumber ) {
		$( ".app-" + type + "-version-number-parent" ).removeClass( "hidden" );
		$( ".app-" + type + "-version-number" ).text( versionNumber );
	};

	updateVersionNumberInHtml( "core", JSON.parse( window.localStorage.getItem( "TROFF_CORE_VERSION_NUMBER" ) ) );
	updateVersionNumberInHtml( "style-assets", JSON.parse( window.localStorage.getItem( "TROFF_STYLE_ASSETS_VERSION_NUMBER" ) ) );
	updateVersionNumberInHtml( "include-assets", JSON.parse( window.localStorage.getItem( "TROFF_INCLUDE_ASSETS_VERSION_NUMBER" ) ) );
	updateVersionNumberInHtml( "app-assets", JSON.parse( window.localStorage.getItem( "TROFF_APP_ASSETS_VERSION_NUMBER" ) ) );
	updateVersionNumberInHtml( "internal-assets", JSON.parse( window.localStorage.getItem( "TROFF_INTERNAL_ASSETS_VERSION_NUMBER" ) ) );
	updateVersionNumberInHtml( "external-assets", JSON.parse( window.localStorage.getItem( "TROFF_EXTERNAL_ASSETS_VERSION_NUMBER" ) ) );

	const channel = new BroadcastChannel('service-worker-broadcastChanel');
	channel.addEventListener('message', event => {

		if( event.data.coreVersionNumber !== undefined ) {

			updateVersionNumberInHtml( "core", event.data.coreVersionNumber );
			updateVersionNumberInHtml( "style-assets", event.data.styleAssetsVersionNumber );
			updateVersionNumberInHtml( "include-assets", event.data.includeAssetsVersionNumber );
			updateVersionNumberInHtml( "app-assets", event.data.appAssetsVersionNumber );
			updateVersionNumberInHtml( "internal-assets", event.data.internalAssetsVersionNumber );
			updateVersionNumberInHtml( "external-assets", event.data.externalAssetsVersionNumber );

			const oldVersionNumber = nDB.get( "TROFF_CORE_VERSION_NUMBER" );
			window.localStorage.setItem( "TROFF_CORE_VERSION_NUMBER", JSON.stringify( event.data.coreVersionNumber ) );
			window.localStorage.setItem( "TROFF_STYLE_ASSETS_VERSION_NUMBER", JSON.stringify( event.data.styleAssetsVersionNumber ) );
			window.localStorage.setItem( "TROFF_INCLUDE_ASSETS_VERSION_NUMBER", JSON.stringify( event.data.includeAssetsVersionNumber ) );
			window.localStorage.setItem( "TROFF_APP_ASSETS_VERSION_NUMBER", JSON.stringify( event.data.appAssetsVersionNumber ) );
			window.localStorage.setItem( "TROFF_INTERNAL_ASSETS_VERSION_NUMBER", JSON.stringify( event.data.internalAssetsVersionNumber ) );
			window.localStorage.setItem( "TROFF_EXTERNAL_ASSETS_VERSION_NUMBER", JSON.stringify( event.data.externalAssetsVersionNumber ) );
			if( oldVersionNumber == null ) {
				$.notify(
					"Troff is now cached and will work offline.\nHave fun!",
        	"success"
        );
				return;
			}

			$.notify(
				{
					title: $("<span class=\"d-flex flex-column\">")
						.append( $("<h2>").text( "New version" ))
						.append( $("<p>")
									.attr( "class", "small text-left" )
									.text( "A new version of Troff is available! Please reload to start using the new version!" )
						).append(
							$("<span class=\"d-flex flex-row justify-content-between align-items-center\">")
							.append( $( "<button>" ).text( "RELOAD" ).on( "click", function() {
								$( this ).trigger( 'notify-hide' );
								window.location.reload();
								return false;
							} ) )
						)
				},
				{
					style: 'html-info',
					autoHide: false,
					clickToHide: false
				}
			);
		}

	});
};

PWA.showPrompt = function( e ) {
	e.prompt(); // Throws if called more than once or default not prevented

	e.userChoice.then(function(choiceResult) {
		if( choiceResult.outcome === "accepted" ){
			$("#pwaAddToHomeScreen").addClass( "hidden" );
			$.notify( "Thank you for installing Troff.\nHave fun!", "success" );
		}
	}, function(err){
		console.error("err", err)
	});
}



PWA.listenForInstallPrompt(); // should it be in document ready? i cant se why it should be there...
PWA.listenForBroadcastChannel();
