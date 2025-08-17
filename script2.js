/*
	This file is part of Troff.

	Troff is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License,
	or (at your option) any later version.

	Troff is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with Troff. If not, see <http://www.gnu.org/licenses/>.
*/

/* eslint eqeqeq: "off" */

import log from "./utils/log.js";

import { IO } from "./script.js";

const errorHandler = {};

// Create an object type UserException
function ShowUserException(message) {
  this.message = message;
  this.stack = new Error().stack;
}
ShowUserException.prototype = new Error();
ShowUserException.prototype.name = "ShowUserException";

$(() => {
  "use strict";

  errorHandler.backendService_getTroffData = function (
    error,
    serverId,
    fileName
  ) {
    IO.removeLoadScreen();
    $("#downloadSongFromServerInProgressDialog").addClass("hidden");
    $("#downloadMarkersFromServerInProgressDialog").addClass("hidden");
    if (error.status == 0) {
      $.notify(
        `Could not connect to server. Please check your internet connection.
					If your internet is working, please try again later.
					If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com.`,
        {
          className: "error",
          autoHide: false,
          clickToHide: true,
        }
      );
      return;
    }
    if (error.status == "NOT_FOUND") {
      $.notify(
        `Could not find song "${fileName}", with id "${serverId}", on the server,
				perhaps the URL is wrong or the song has been removed`,
        {
          className: "error",
          autoHide: false,
          clickToHide: true,
        }
      );
      return;
    }

    if (error instanceof ShowUserException) {
      $.notify(error.message, {
        className: "error",
        autoHide: false,
        clickToHide: true,
      });
      return;
    }
    $.notify(
      `An unknown error occurred when trying to download the song "${fileName}", with id "${serverId}", from the server,
			please try again later.
			If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com
			explaining what happened`,
      {
        className: "error",
        autoHide: false,
        clickToHide: true,
      }
    );
    log.e(`errorHandler.backendService_getTroffData: Full Error:\n`, error);
    return;
  };

  errorHandler.fileHandler_fetchAndSaveResponse = function (error, fileName) {
    IO.removeLoadScreen();
    $("#downloadSongFromServerInProgressDialog").addClass("hidden");
    $("#downloadMarkersFromServerInProgressDialog").addClass("hidden");
    if (error.status == 404) {
      $.notify(
        `The song "${fileName}", could not be found on the server, it has probably been removed
				but the markers have been loaded, if you have the file named "${fileName}", you can
				simply import it again and the markers will be connected with the file!`,
        {
          className: "error",
          autoHide: false,
          clickToHide: true,
        }
      );
      return;
    }

    if (error instanceof ShowUserException) {
      $.notify(error.message, {
        className: "error",
        autoHide: false,
        clickToHide: true,
      });
      return;
    }

    $.notify(
      `An unknown error occurred with the song "${fileName}",
			please try again later.
			If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com
			explaining what happened`,
      {
        className: "error",
        autoHide: false,
        clickToHide: true,
      }
    );
    log.e(
      `errorHandler.fileHandler_fetchAndSaveResponse: Full Error:\n`,
      error
    );
    return;
  };

  errorHandler.fileHandler_sendFile = function (error, fileName) {
    IO.removeLoadScreen();
    $("#uploadSongToServerInProgressDialog").addClass("hidden");
    if (error.status == 0) {
      $.notify(
        `Could not upload the song "${fileName}": could not connect to server. Please check your internet connection.
					If your internet is working, please try again later.
					If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com`,
        {
          className: "error",
          autoHide: false,
          clickToHide: true,
        }
      );
      return;
    }

    if (error instanceof ShowUserException) {
      $.notify(error.message, {
        className: "error",
        autoHide: false,
        clickToHide: true,
      });
      return;
    }

    $.notify(
      `An unknown error occurred, please try again later.
			If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com
			explaining what happened`,
      {
        className: "error",
        autoHide: false,
        clickToHide: true,
      }
    );
    log.e(`errorHandler.fileHandler_sendFile: Full Error:\n`, error);
  };
});

export { errorHandler, ShowUserException };
