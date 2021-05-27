const environment = {};

(function main() {
	"use strict";

	environment.banner = {};

	switch( window.location.host ) {
		case "localhost:8000":
			environment.backend = "http://localhost:8080/ternsjo_Troff";
			environment.banner.show = true;
			environment.banner.text = "Welcome to development";
			environment.showHiddenInProd = true;
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
