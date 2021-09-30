const environment = {};

(function main() {
	"use strict";

	environment.banner = {};

	switch( window.location.host ) {
		case "localhost:8000":
		case "localhost:5000":
			environment.backend = "http://localhost:8080/ternsjo_Troff";
			environment.banner.show = true;
			environment.banner.text = "Welcome to development";
			environment.showHiddenInProd = true;

			environment.firebaseConfig = {
				apiKey: "AIzaSyCo1r8aMFCPHdfNu_V-hqF1GMa4A9rU7ww",
				authDomain: "pwa-troff-dev.firebaseapp.com",
				projectId: "pwa-troff-dev",
				storageBucket: "pwa-troff-dev.appspot.com",
				messagingSenderId: "245960461240",
				appId: "1:245960461240:web:7969954a2707709f13dd4d"
			};
			break;
		case "slimsim.github.io":
			environment.backend = "https://ternsjo-it.heliohost.us/ternsjo_Troff";
			environment.banner.show = true;
			environment.banner.text = "Welcome to test";
			environment.showHiddenInProd = true;

			environment.firebaseConfig = {
				apiKey: "AIzaSyCEO1gRovzs8OX7iVrLcOhjyosnYjeKRtM",
				authDomain: "troff-test.firebaseapp.com",
				projectId: "troff-test",
				storageBucket: "troff-test.appspot.com",
				messagingSenderId: "512336951689",
				appId: "1:512336951689:web:8b47596c7f3edd26878958"
			};
			break;
		case "troff.app":
		case "troff.slimsim.heliohost.org":
		case "troff.ternsjo-it.heliohost.us":
			environment.backend = "https://ternsjo-it.heliohost.us/ternsjo_Troff";
			environment.banner.show = false;
			environment.banner.text = "Production";
			environment.showHiddenInProd = false;
			break;
	}

	environment.getUploadFileEndpoint = function() {
		return `${environment.backend}/uploadFile`;
	}
	environment.getTroffDataEndpoint = function( troffDataId, fileName ) {
		return `${environment.backend}/getTroffData/${troffDataId}/${fileName}`;
	};
	environment.getDownloadFileEndpoint = function( fileId ) {
		return `${environment.backend}/getFile/${fileId}`;
	}
	environment.getCurlEndpoint = function() {
		return `${environment.backend}/curl`;
	};

})();
