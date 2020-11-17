
if( "serviceWorker" in navigator) {
	window.addEventListener( "load", () => {
		navigator.serviceWorker.register( "/service-worker.js" )
		.then( reg => {
			console.log( "service-worker.js registered! :)" );
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

PWA.showPrompt = function( e ) {
	e.prompt(); // Throws if called more than once or default not prevented

	e.userChoice.then(function(choiceResult) { 
		if( choiceResult.outcome === "accepted" ){
			$("#pwaAddToHomeScreen").addClass( "hidden" );
			$.notify( "Thank you for installing Troff.\nHave fun!", "success" );
		}
	}, function(err){
		console.log("err", err)
	}); 
}



PWA.listenForInstallPrompt(); // should it be in document ready? i cant se why it should be there...
$( document ).ready(function() {

});




console.log("BroadcastChannel ->");
const channel = new BroadcastChannel('service-worker-brodcastChanel');
channel.addEventListener('message', event => {
	console.log("message A ->");
	console.log( event.data.notify.message );
	console.log( event.data.notify.status  );
	if( event.data.notify !== undefined ) {
		console.log("message in if");
		$.notify( event.data.notify.message, event.data.notify.status );
	}

});