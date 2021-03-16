const environment = {};

(function main() {
	"use strict";

	environment.banner = {};

	switch( window.location.host ) {
		case "localhost:8000":
			environment.backend = "http://localhost:8080/ternsjo_Troff";
			environment.banner.show = true;
			environment.banner.text = "Welcome to development";
			break;
		case "troff.app":
		case "troff.slimsim.heliohost.org":
		case "troff.ternsjo-it.heliohost.us":
			environment.backend = "https://ternsjo-it.heliohost.us/ternsjo_Troff";
			environment.banner.show = false;
			environment.banner.text = "Production";
			break;
	}

	environment.uploadFileEndpoint = environment.backend + "/uploadFile";

})();