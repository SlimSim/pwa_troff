
if( "serviceWorker" in navigator) {
	console.log( "serviceWorker in navigator" );
	const serviceWorkerPath = "/service-worker.js";
	window.addEventListener( "load", () => {
		console.log( "window.addEventListener load ->" );
		navigator.serviceWorker.register( serviceWorkerPath )
		.then( reg => {
			console.log( "service-worker.js registered 2" );

			reg.update();
			console.log( "service-worker.js updated" );

			//console.info("service-worker.js registered!");
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
		console.warn( "No BroadcastChannel, returning" );
		return;
	}
	const channel = new BroadcastChannel('service-worker-brodcastChanel');
	channel.addEventListener('message', event => {
		if( event.data.notify !== undefined ) {
			$.notify( event.data.notify.message, event.data.notify.status );
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
