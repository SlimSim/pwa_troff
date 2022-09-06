
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

	function updateVersionNumberInHtml( versionNumber ) {
		$( ".app-core-version-number-parent" ).removeClass( "hidden" );
		$( ".app-core-version-number" ).text( versionNumber );
	};

	updateVersionNumberInHtml( JSON.parse( window.localStorage.getItem( "TROFF_VERSION_NUMBER" ) ) );
	const channel = new BroadcastChannel('service-worker-broadcastChanel');
	channel.addEventListener('message', event => {

		if( event.data.versionNumber !== undefined ) {

			const oldVersionNumber = nDB.get( "TROFF_VERSION_NUMBER" );
			window.localStorage.setItem( "TROFF_VERSION_NUMBER", JSON.stringify( event.data.versionNumber ) );
			if( oldVersionNumber == null ) {
				$.notify(
					"Troff is now cached and will work offline.\nHave fun!",
        	"success"
        );

        updateVersionNumberInHtml( event.data.versionNumber );
				return;
			}

			$.notify(
				{
					title: $("<span class=\"d-flex flex-column\">")
						.append( $("<h2>").text( "New version" ))
						.append( $("<p>").attr( "class", "small text-left" ).text( "A new version of Troff is available please reload to start using version " + event.data.versionNumber ))
						.append(
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
