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

var RateClass = function () {
  this.RATED_STATUS_NOT_ASKED = 1;
  this.RATED_STATUS_NO_THANKS = 2;
  this.RATED_STATUS_ASK_LATER = 3;
  this.RATED_STATUS_ALREADY_RATED = 4;

  this.MILLIS_IN_ONE_MONTH = 2678400000; // nr of millisecunds in a month!

  this.startFunc = function () {
    var oData = {
      millisFirstTimeStartingApp: nDB.get("millisFirstTimeStartingApp"),
      iRatedStatus: nDB.get("iRatedStatus"),
      straLastMonthUsage: nDB.get("straLastMonthUsage"),
    };
    // Check if it is the first time user starts the App

    if (!oData.millisFirstTimeStartingApp) {
      Troff.firstTimeUser();
      Rate.firstTimeStartingAppFunc();
      return;
    }

    var aLastMonthUsage = JSON.parse(oData.straLastMonthUsage);

    var d = new Date();
    var millis = d.getTime();
    aLastMonthUsage.push(millis);

    // update the user statistics
    aLastMonthUsage = aLastMonthUsage.filter(function (element) {
      return element > millis - Rate.MILLIS_IN_ONE_MONTH;
    });

    while (aLastMonthUsage.length > 100) {
      aLastMonthUsage.shift();
    }

    nDB.set("straLastMonthUsage", JSON.stringify(aLastMonthUsage));

    // return if no conection
    if (!navigator.onLine) return;

    Rate.checkToShowUserSurvey(aLastMonthUsage);
    Rate.checkToShowRateDialog(
      oData.iRatedStatus,
      aLastMonthUsage,
      millis,
      oData.millisFirstTimeStartingApp
    );
  };

  /*Rate*/ this.checkToShowUserSurvey = function (aLastMonthUsage) {
    // return if user has used Troff less than 5 times durring the last month
    if (aLastMonthUsage.length < 5) return;

    $("#linkToUserSurvey").removeClass("hidden");
  };

  /*Rate*/ this.checkToShowRateDialog = function (
    iRatedStatus,
    aLastMonthUsage,
    millis,
    millisFirstTimeStartingApp
  ) {
    // return if user has used the app for less than 3 months
    if (millis - millisFirstTimeStartingApp < 3 * Rate.MILLIS_IN_ONE_MONTH)
      return;

    // return if user has used Troff less than 4 times durring the last month
    if (aLastMonthUsage.length < 4) return;

    if (iRatedStatus == Rate.RATED_STATUS_ALREADY_RATED) return;

    if (iRatedStatus == Rate.RATED_STATUS_NOT_ASKED) {
      Rate.showRateDialog();
    } else if (iRatedStatus == Rate.RATED_STATUS_ASK_LATER) {
      if (Math.random() < 0.3) Rate.showRateDialog();
    } else if (iRatedStatus == Rate.RATED_STATUS_NO_THANKS) {
      if (aLastMonthUsage.length < 20) return;
      if (Math.random() < 0.05) {
        Rate.showRateDialog();
      }
    }
  };

  this.firstTimeStartingAppFunc = function () {
    var d = new Date();
    var millis = d.getTime();
    var aLastMonthUsage = [millis];
    var straLastMonthUsage = JSON.stringify(aLastMonthUsage);
    nDB.set("millisFirstTimeStartingApp", millis);
    nDB.set("iRatedStatus", Rate.RATED_STATUS_NOT_ASKED);
    nDB.set("straLastMonthUsage", straLastMonthUsage);
  };

  this.showRateDialog = function () {
    IO.setEnterFunction(function () {
      Rate.rateDialogRateNow();
    });
    if (navigator.onLine) {
      $("#rateDialog").removeClass("hidden");
    }
  };

  this.rateDialogNoThanks = function () {
    IO.blurHack();
    IO.clearEnterFunction();
    $("#rateDialog").addClass("hidden");
    nDB.set("iRatedStatus", Rate.RATED_STATUS_NO_THANKS);
  };
  this.rateDialogAskLater = function () {
    IO.blurHack();
    IO.clearEnterFunction();
    $("#rateDialog").addClass("hidden");
    nDB.set("iRatedStatus", Rate.RATED_STATUS_ASK_LATER);
  };
  this.rateDialogRateNow = function () {
    IO.blurHack();
    IO.clearEnterFunction();
    $("#rateDialog").addClass("hidden");
    nDB.set("iRatedStatus", Rate.RATED_STATUS_ALREADY_RATED);

    window.open("https://www.facebook.com/troffmusic/");
  };
}; //End RateClass

const nDBc = { //new data base callback

	get : function( key, callback ) {
		callback( nDB.get( key ) );
	},
	getAllKeys : function( callback ) {
		callback( nDB.getAllKeys() );
	},
	getAllKeyValuePairs : function( callback ) {
		callback( nDB.getAllKeyValuePairs() );
	},

}


var DBClass = function(){

	/*DB*/this.popSongWithLocalChanges = function(
		groupDocId,
		songDocId,
		songKey) {

		function rightSong( o ) {
			return o.groupDocId == groupDocId &&
				o.songDocId == songDocId &&
				o.songKey == songKey;
		}

		let changedSongList = nDB.get( "TROFF_SONGS_WITH_LOCAL_CHANGES" ) || [];

		const songInGroupAlreadyExists = changedSongList.find( rightSong );

		changedSongList = changedSongList.filter( o => !rightSong(o));

		nDB.set( "TROFF_SONGS_WITH_LOCAL_CHANGES", changedSongList );
		return songInGroupAlreadyExists;
	};

	/*DB*/this.pushSongWithLocalChanges = function(
		groupDocId,
		songDocId,
		songKey) {

		const changedSongList = nDB.get( "TROFF_SONGS_WITH_LOCAL_CHANGES" ) || [];

		const songInGroupAlreadyExists = changedSongList.find( o =>
			o.groupDocId == groupDocId &&
			o.songDocId == songDocId &&
			o.songKey == songKey
		);

		if( songInGroupAlreadyExists ) {
			return;
		}

		changedSongList.push( {
			groupDocId : groupDocId,
			songDocId : songDocId,
			songKey : songKey
		} );

		nDB.set( "TROFF_SONGS_WITH_LOCAL_CHANGES", changedSongList );
	}

	// deprecated: use nDB.set( key, value )
	this.saveVal = function( key, value) {
		nDB.set( key, value );
	};

	// deprecated: use nDB.get_callback( key, callback )
	this.getVal = function( key, returnFunction ) {
		nDBc.get( key, returnFunction );
	};

	this.cleanSong = function(songId, songObject){
		if ( typeof songObject !== "object" || songId.indexOf( "TROFF_" ) === 0 ){
			return; // this object should not be a song, and should not be cleaned
		}

		songObject = DB.fixSongObject( songObject );

		nDB.set( songId, songObject );
	}; // end cleanSong

	this.fixSongObject = function( songObject ){
		let setMaxSongLength = false;

		if( songObject === undefined ) {
			songObject = {};
			setMaxSongLength = true;
		}

		if( songObject.fileData === undefined ) {
			songObject.fileData = {};
		}

		var songLength;
		try{
			songLength = Number(document.getElementById('timeBar').max);
		} catch (e) {
			log.e("getElementById('timeBar') does not exist." +
			" Tried to call fixSongObject without it....");
			songLength = "max";
		}
		if( setMaxSongLength ) {
			songLength = "max";
		}

		var oMarkerStart = {};
		oMarkerStart.name = "Start";
		oMarkerStart.time = 0;
		oMarkerStart.info = Troff.getStandardMarkerInfo();
		oMarkerStart.color = "None";
		oMarkerStart.id = "markerNr0";
		var oMarkerEnd = {};
		oMarkerEnd.name  = "End";
		oMarkerEnd.time  = songLength;
		oMarkerEnd.info  = "";
		oMarkerEnd.color = "None";
		oMarkerEnd.id = "markerNr1";


		function updateAttr( oldName, newName0, newName1 ) {
			if( !songObject.hasOwnProperty( oldName ) ) {
				return;
			}
			if( newName1 ) {
				songObject[ "TROFF_CLASS_TO_TOGGLE_" + newName0 ] = songObject[ oldName ][0];
				songObject[ "TROFF_VALUE_" + newName1 ] = songObject[ oldName ][1];
			} else {
				songObject[ "TROFF_VALUE_" + newName0 ] = songObject[ oldName ];
			}
			delete songObject[ oldName ];
		}

		updateAttr( "speed", "speedBar" );
		updateAttr( "volume", "volumeBar" );
		updateAttr( "startBefore", "buttStartBefore", "startBefore" );
		updateAttr( "pauseBefStart", "buttStartBefore", "pauseBeforeStart" );
		updateAttr( "stopAfter", "buttStopAfter", "stopAfter" );
		updateAttr( "iWaitBetweenLoops", "buttWaitBetweenLoops", "waitBetweenLoops" );
		updateAttr( "wait", "buttWaitBetweenLoops", "waitBetweenLoops" );
		updateAttr( "tempo", "tapTempo" );

		if(!songObject.info ) songObject.info = "";
		if(songObject.aStates === undefined) songObject.aStates = [];
		if(!songObject.zoomStartTime) songObject.zoomStartTime = 0;
		if(!songObject.markers) songObject.markers = [oMarkerStart, oMarkerEnd];
		if(!songObject.abAreas)
			songObject.abAreas = [false, true, true, true];
		if(!songObject.currentStartMarker)
			songObject.currentStartMarker = oMarkerStart.id;
		if(!songObject.currentStopMarker)
			songObject.currentStopMarker = (oMarkerEnd.id + 'S');

		return songObject;
	};

	/*DB*/this.fixDefaultValue = function( allKeys, key, valIsTrue ) {
		if(allKeys.indexOf( key ) === -1 ) {
			nDB.set( key, valIsTrue );

			if( valIsTrue ) {
				$("#" + key ).addClass("active");
			} else {
				$("#" + key ).removeClass("active");
			}
		}
	}

	/*DB*/this.cleanDB = function(){
		nDBc.getAllKeys( function( allKeys ) {
			if(allKeys.length === 0){ // This is the first time Troff is started:
				DB.saveSonglists_new();
			}

			// These is for the first time Troff is started:
			if(allKeys.indexOf("straoSongLists")   === -1 ) DB.saveSonglists_new();
			if(allKeys.indexOf("zoomDontShowAgain")=== -1 ) {
				nDB.set( "zoomDontShowAgain", false );
			}

			DB.fixDefaultValue( allKeys, TROFF_SETTING_SHOW_SONG_DIALOG, true );

			const columnToggleList = {};
			DATA_TABLE_COLUMNS.list.forEach( ( v, i ) => {
				columnToggleList[ v.id ] = (v.default == "true") || (v.default == true);
			} );

			/*
				This following if is ONLY to ease the transition from TROFF_SETTING_SONG_COLUMN_TOGGLE as an array to an object.
				Can be removed after user have opened the app with this code once...
			*/
			if( nDB.get( TROFF_SETTING_SONG_COLUMN_TOGGLE ) != null ) {
				if( nDB.get( TROFF_SETTING_SONG_COLUMN_TOGGLE ).constructor.name == "Array" ) {
					const previousColumnToggleList = nDB.get( TROFF_SETTING_SONG_COLUMN_TOGGLE );

					const newColumnToggle = {}
					newColumnToggle.CHECKBOX = previousColumnToggleList[0];
					newColumnToggle.TYPE = previousColumnToggleList[1];
					newColumnToggle.DURATION = previousColumnToggleList[2];
					newColumnToggle.DISPLAY_NAME = previousColumnToggleList[3];
					newColumnToggle.TITLE = previousColumnToggleList[4];
					newColumnToggle.ARTIST = previousColumnToggleList[5];
					newColumnToggle.ALBUM = previousColumnToggleList[6];
					newColumnToggle.TEMPO = previousColumnToggleList[7];
					newColumnToggle.GENRE = previousColumnToggleList[8];
					newColumnToggle.LAST_MODIFIED = previousColumnToggleList[10];
					newColumnToggle.FILE_SIZE = previousColumnToggleList[11];
					newColumnToggle.INFO = previousColumnToggleList[12];
					newColumnToggle.EXTENSION = previousColumnToggleList[13];

					nDB.set( TROFF_SETTING_SONG_COLUMN_TOGGLE, newColumnToggle );
				}
			}

			DB.fixDefaultValue( allKeys, TROFF_SETTING_SONG_COLUMN_TOGGLE, columnToggleList );

			if( allKeys.indexOf( TROFF_CURRENT_STATE_OF_SONG_LISTS ) == -1 ) {
				Troff.saveCurrentStateOfSonglists();
			}

			function ifExistsPrepAndThenRemove( key, prepFunc ) {
				var keyIndex = allKeys.indexOf( key );
				if( keyIndex !== -1 ) {
					if( prepFunc != null ) {
						prepFunc( key, nDB.get( key ) );
					}
					nDB.delete( key );
					allKeys.splice( keyIndex, 1 );
				}
			}

			ifExistsPrepAndThenRemove( "iCurrentSonglist", function( key, val ) {
				var o = {};
				o.songListList = val == 0 ? [] : [ val.toString() ];
				o.galleryList = [];
				o.directoryList = [];
				DB.saveVal( TROFF_CURRENT_STATE_OF_SONG_LISTS, o );
			} );


			ifExistsPrepAndThenRemove( "abGeneralAreas", function( key, val ) {

				var abGeneralAreas = JSON.parse( val );
				var showSongListArea = abGeneralAreas[0];
				var showSongArea = abGeneralAreas[1];

				if( showSongListArea ) {
					clickAttachedSongListToggle();
				}
				if( showSongArea ) {
					openSongDialog();
				} else {
					closeSongDialog();
				}
			} )

			ifExistsPrepAndThenRemove( "TROFF_CORE_VERSION_NUMBER" );
			ifExistsPrepAndThenRemove( "TROFF_STYLE_ASSETS_VERSION_NUMBER" );
			ifExistsPrepAndThenRemove( "TROFF_INCLUDE_ASSETS_VERSION_NUMBER" );
			ifExistsPrepAndThenRemove( "TROFF_APP_ASSETS_VERSION_NUMBER" );
			ifExistsPrepAndThenRemove( "TROFF_INTERNAL_ASSETS_VERSION_NUMBER" );
			ifExistsPrepAndThenRemove( "TROFF_EXTERNAL_ASSETS_VERSION_NUMBER" );

			allKeys.forEach( (key, i) => {
				DB.cleanSong(key, nDB.get( key ) );
			} );
		});//end get all keys
	};

	/*DB*/this.setSonglistAsNotGroup = function( firebaseGroupDocId ) {
		const allSonglists = JSON.parse( nDB.get( "straoSongLists" ) );
		const currentSonglist = allSonglists
			.find( g => g.firebaseGroupDocId == firebaseGroupDocId);
		delete currentSonglist.firebaseGroupDocId;
		delete currentSonglist.owners;
		currentSonglist.songs.forEach( song => {
			delete song.firebaseSongDocId;
		});

		nDB.set( "straoSongLists", JSON.stringify( allSonglists ) );
	}

	/*DB*/this.saveSonglists_new = function() {
		var i,
			aoSonglists = [],
			aDOMSonglist = $('#songListList').find('button[data-songlist-id]');

		for( i=0; i<aDOMSonglist.length; i++ ){
			aoSonglists.push(aDOMSonglist.eq(i).data('songList'));
		}

		var straoSonglists = JSON.stringify(aoSonglists);
		nDB.set( 'straoSongLists', straoSonglists );
	}

	/*DB*/this.setCurrentAreas = function(songId){
		nDBc.get(songId, function( song ) {
			if(!song){
				log.e('Error "setCurrentAreas, noSong" occurred, songId=' +
					songId);
				return;
			}
			song.abAreas = [
				$('#statesTab').hasClass("active"),
				$('#settingsTab').hasClass("active"),
				$('#infoTab').hasClass("active"),
				$('#countTab').hasClass("active")
			];

			nDB.set( songId, song );
		});
	};

	/*DB*/this.setCurrentSong = function(path, galleryId){
		var stroSong = JSON.stringify({"strPath":path, "iGalleryId": galleryId});
		nDB.set( 'stroCurrentSongPathAndGalleryId', stroSong );
	};

	/*DB*/this.setZoomDontShowAgain = function(){
		nDB.set( "zoomDontShowAgain", true );
	};

	/*DB*/this.getZoomDontShowAgain = function(){
		nDBc.get("zoomDontShowAgain", function(value){
			var bZoomDontShowAgain = value || false;
			Troff.dontShowZoomInstructions = bZoomDontShowAgain;
		});
	};

	/*DB*/this.getAllSonglists = function(){
		nDBc.get( 'straoSongLists' , function( straoSongLists ) {
			if( straoSongLists == undefined ) {
				straoSongLists = [];
			}

			Troff.setSonglists_NEW(JSON.parse(straoSongLists));
		});
	};

	/*DB*/this.getShowSongDialog = function() {
		DB.getVal( TROFF_SETTING_SHOW_SONG_DIALOG, function( val ) {
			if( val === undefined ) {
				setTimeout(function(){
					DB.getShowSongDialog();
				}, 42);
			}

			if( val ) {
				setTimeout(function(){
					openSongDialog();
				}, 42);
			}
		} );
	}

	/*DB*/this.getCurrentSong = function() {
		nDBc.get('stroCurrentSongPathAndGalleryId', function( stroSong ) {
			if(!stroSong){
				Troff.setAreas([false, false, false, false]);
				IO.removeLoadScreen();
				return;
			}
			var oSong = JSON.parse(stroSong);
			Troff.setCurrentSongStrings( oSong.strPath, oSong.iGalleryId );

			createSongAudio( oSong.strPath );

		});
	};

	/*DB*/this.updateMarker = function(markerId, newName, newInfo, newColor, newTime, songId){
	nDBc.get(songId, function( song ) {
		if(!song)
			log.e('Error "updateMarker, noSong" occurred, songId=' + songId);
		for(var i=0; i<song.markers.length; i++){
			if(song.markers[i].id == markerId){
				song.markers[i].name = newName;
				song.markers[i].time = newTime;
				song.markers[i].info = newInfo;
				song.markers[i].color = newColor;
				break;
			}
		}

		song.serverId = undefined;
		Troff.setUrlToSong( undefined, null );

		nDB.set( songId, song );
		updateVersionLink( songId );


		ifGroupSongUpdateFirestore( songId );

	});
	};// end updateMarker

	/*DB*/this.saveStates = function(songId, callback) {
	nDBc.get(songId, function( song ){
		var aAllStates = Troff.getCurrentStates();
		var aStates = [];
		for(var i=0; i<aAllStates.length; i++){
			aStates[i] = aAllStates.eq(i).attr('strState');
		}
		if(!song){
			log.e('Error "saveState, noSong" occurred, songId=' + songId);
			song = {};
			song.markers = [];
		}

		song.aStates = aStates;
		song.serverId = undefined;
		Troff.setUrlToSong( undefined, null );

		nDB.set( songId, song );

		ifGroupSongUpdateFirestore( songId );
		if( callback ) {
			callback();
		}
	});
	};

	/*DB*/this.saveZoomTimes = function(songId, startTime, endTime) {
	nDBc.get(songId, function( song ){
		if(!song){
			log.e('Error "saveZoomTimes, noSong" occurred, songId=' + songId);
			song = DB.getStandardSong();
		}

		song.zoomStartTime = startTime;
		song.zoomEndTime = endTime;

		nDB.set( songId, song );
	});
	};

	/*DB*/this.saveMarkers = function(songId, callback) {
	nDBc.get( songId, function( song ) {
		var aAllMarkers = Troff.getCurrentMarkers();

		var aMarkers = [];
		for(var i=0; i<aAllMarkers.length; i++){
			var oMarker = {};
			oMarker.name  = aAllMarkers[i].value;
			oMarker.time  = Number(aAllMarkers[i].timeValue);
			oMarker.info  = aAllMarkers[i].info;
			oMarker.color = aAllMarkers[i].color;
			oMarker.id    = aAllMarkers[i].id;
			aMarkers[i] = oMarker;
		}
		if(!song){
			log.e('Error "saveMarker, noSong" occurred, songId=' + songId);
			song = {};
			song.markers = [];
		}


		song.currentStartMarker = $('.currentMarker')[0].id;
		song.currentStopMarker = $('.currentStopMarker')[0].id;
		song.markers = aMarkers;
		song.serverId = undefined;
		Troff.setUrlToSong( undefined, null );

		nDB.set( songId, song );

		ifGroupSongUpdateFirestore( songId );
		if( callback ) {
			callback();
		}
	});
	};// end saveMarkers

	/*DB*/this.setCurrentStartAndStopMarker = function(startMarkerId, stopMarkerId,
			songId) {
	nDBc.get(songId, function( song ){
		if(!song){
				log.e('Error "setStartAndStopMarker, noSong" occurred,'+
												' songId=' +songId);
				return;
		}
		song.currentStartMarker = startMarkerId;
		song.currentStopMarker = stopMarkerId;
		nDB.set( songId, song );
	});
	};//end setCurrentStartAndStopMarker



	/*DB*/this.setCurrentStartMarker = function(name, songId){
			DB.setCurrent(songId, 'currentStartMarker', name);
	};
	this.setCurrentStopMarker = function(name, songId){
			DB.setCurrent(songId, 'currentStopMarker', name);
	};
	this.setCurrentSongInfo = function(info, songId){
		DB.setCurrent(songId, 'info', info, function() {
			nDB.setOnSong( songId, "serverId", undefined );
			Troff.setUrlToSong( undefined, null );

			ifGroupSongUpdateFirestore( songId );
			updateVersionLink( songId );
		});
	};

	this.setCurrentTempo = function(tempo, songId){
		DB.setCurrent(songId, 'tempo', tempo);
	};

	/*DB*/this.setCurrent = function( songId, key, value, callback ) {
		nDBc.get(songId, function( song ){
			if(!song){
					log.e('Error, "noSong" occurred;\n'+
					'songId=' + songId + ', key=' + key + ', value=' + value);
					return;
			}
			song[key] = value;
			nDB.set( songId, song );

			if( callback ) {
				callback();
			}
		});
	};//end setCurrent

	/*DB*/this.getMarkers = function(songId, funk) {
	nDBc.get(songId, function( song ){
		if(!song || !song.markers ){ // new song or no markers
			return;
		}
		funk(song.markers);
	});
	};

	/*DB*/this.getSongMetaDataOf = function(songId) {
		var loadSongMetadata = function(song, songId) {

			$( "[data-save-on-song-toggle-class]" ).each( function( i, element ){
				var $target = $( element ),
					classToToggleAndSave = $target.data( "save-on-song-toggle-class" ),
					key = "TROFF_CLASS_TO_TOGGLE_" + $target.attr( "id" ),
					defaultElementId,
					value = song[key];

				if( value === undefined ) {
					defaultElementId = $target.data( "troff-css-selector-to-get-default" );
					value = $( defaultElementId ).hasClass( classToToggleAndSave );
				}

				if( value ) {
					$target.addClass( classToToggleAndSave );
				} else {
					$target.removeClass( classToToggleAndSave );
				}
			});

			$( "[data-save-on-song-value]" ).each( function( i, element ){
				var $target = $( element ),
					key = "TROFF_VALUE_" + $target.attr( "id" ),
					value = song[key];

				if( value === undefined ) {
					defaultElementId = $target.data( "troff-css-selector-to-get-default" );
					value = $( defaultElementId ).val();
				}

				$target.val( value );
				if( $target.attr( "type" ) == "range" ) {
					$target[0].dispatchEvent(new Event('input'));
				}
			});

			Troff.setUrlToSong( song.serverId, songId );

			Troff.addMarkers(song.markers);
			Troff.selectMarker(song.currentStartMarker);
			Troff.selectStopMarker(song.currentStopMarker);
			Troff.setMood('pause');
			Troff.setLoopTo(song.loopTimes);
			if(song.bPlayInFullscreen !== undefined)
				Troff.setPlayInFullscreen(song.bPlayInFullscreen);
			if(song.bMirrorImage !== undefined)
				Troff.setMirrorImage(song.bMirrorImage);

			Troff.setInfo(song.info);
			Troff.addButtonsOfStates(song.aStates);
			Troff.setAreas(song.abAreas);
			Troff.setCurrentSongInDB();
			Troff.zoom(song.zoomStartTime, song.zoomEndTime);
		};// end loadSongMetadata

		nDBc.get(songId, function( song ){

			if(!song){ // new song:
				song = DB.fixSongObject();
				nDB.set( songId, song );

				loadSongMetadata(song, songId);
			} else {
				loadSongMetadata(song, songId);
			}
		});

	}; // end getSongMetadata

	/*DB*/this.getImageMetaDataOf = function(songId) {
		var loadImageMetadata = function(song, songId){
			Troff.setMood('pause');
			Troff.setInfo(song.info);
			Troff.addButtonsOfStates(song.aStates);
			Troff.setAreas(song.abAreas);
			Troff.setCurrentSongInDB();
		};// end loadImageMetadata

		nDBc.get(songId, function( song ){

			if(!song){ // new song:
				song = DB.fixSongObject();
				nDB.set( songId, song );

				loadImageMetadata(song, songId);
			} else {
				loadImageMetadata(song, songId);
			}
		});
	}; // end getSongMetadata
};// end DBClass



var IOClass = function(){

	/* this is used to know if button-presses should be in "pop-up"-mode
		or in regular mode */
	var IOEnterFunction = false;
	var IOArrowFunction = false;

	/*IO*/this.toggleFullScreen = function() {
		var doc = window.document;
		var docEl = doc.documentElement;

		var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
		var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

		if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
			requestFullScreen.call(docEl);
		}
		else {
			cancelFullScreen.call(doc);
		}
	}

	/*IO*/this.updateCellInDataTable = ( column, value, key ) => {
		if( key == undefined ) {
			$("#dataSongTable").DataTable().cell( ".selected", DATA_TABLE_COLUMNS.getPos( column ) ).data( value );
			return;
		}
		$("#dataSongTable").DataTable().cell( '[data-song-key="' + key + '"]', DATA_TABLE_COLUMNS.getPos( column ) )
			.data( value );
	};

	/*IO*/this.fullScreenChange = function(event) {
		if( document.fullscreenElement ) {
			$( ".toggleFullScreenExpandIcon" ).addClass( "hidden" );
			$( ".toggleFullScreenCompressIcon" ).removeClass( "hidden" );
		} else {
			$( ".toggleFullScreenExpandIcon" ).removeClass( "hidden" );
			$( ".toggleFullScreenCompressIcon" ).addClass( "hidden" );
		}
	}

	/*IO*/this.openWindow = function( event ) {
		let $button = $( event.target ).closest( "[data-href]" );
		window.open( $button.data( "href" ), $button.data( "target" ) );
	};

	/*IO*/this.removeLoadScreen = function() {
		$( "#loadScreen, #loadScreenStyle" ).remove();
	};

	/*IO*/this.addCacheVersionToAdvancedSetting = async function() {
		( await caches.keys() )
			.sort( (c1, c2) => c1.split( "-v" )[0].length - c2.split( "-v" )[0].length )
			.forEach( ( cacheName ) => {

			let [name, versionNumber] = cacheName.split( "-v");

			if( name.includes( "songCache" ) ) {
				return;
			}

			if( name.includes( "core" ) ) {
				$(".app-core-version-number" ).text( versionNumber );
			}

			name = name.replace( "-", " " );
			name = name[0].toUpperCase() + name.substring(1);

			const $newVersion = $( "<div>" ).addClass( "py-2" )
			.append( $( "<h4>" ).addClass( "buttWidthLarge inlineBlock").text( name ) )
			.append( $( "<span>" ).addClass( "small" ).text( versionNumber ) )

			$( "#advancedSettings" ).append( $newVersion )

		} );
	}

	/*IO*/this.startFunc = function() {

		if( nDB.get( "TROFF_FIREBASE_PREVIOUS_SIGNED_IN" ) ) {
			$(".hide-on-sign-out").removeClass("hidden");
			$(".hide-on-sign-in").addClass("hidden");
		}

		document.addEventListener('keydown', IO.keyboardKeydown);
		document.addEventListener('fullscreenchange', IO.fullScreenChange );

		$( ".outerDialog" ).click( function( event ) {
			if( $(event.target ).hasClass( "outerDialog" ) && !$(event.target ).hasClass( "noCloseOnClick" ) ) {
				$( event.target ).addClass( "hidden" );
			}
		} );

		IO.addCacheVersionToAdvancedSetting();

		// this is to not change volume or speed when scrolling horizontally on mobile (require https://j11y.io/javascript/special-scroll-events-for-jquery/)
		$( document ).on( "scrollStart", function (e) {
			$( ".sliderRange, #timeBar" ).prop( "disabled", true );
		} );
		$( document ).on( "scrollStop", function (e) {
			$( ".sliderRange, #timeBar" ).prop( "disabled", false );
			$( "#volumeBar" ).val( Number( $( "#volume" ).text() ) );
			$( "#speedBar" ).val( Number( $( "#speed" ).text() ) );
		} );


		$( "[data-st-css-selector-to-toggle]" ).on( "click", function( event ) {
			IO.blurHack();
			var $target = $( event.target ),
				$value = $( $target.data( "st-css-selector-to-toggle" ) );

			if( $target.hasClass( "stOnOffButton" ) ) {
				if( $value.hasClass( "hidden" ) ) {
					$target.removeClass( "active" );
				} else {
					$target.addClass( "active" );
				}
			}

		} );

		$( "[data-st-css-selector-to-fade-in]" ).on( "click", function( event ) {
			IO.blurHack();
			var $target = $( event.target ),
				$value = $( $target.data( "st-css-selector-to-fade-in" ) );

			if( $target.hasClass( "stOnOffButton" ) ) {
				if( $value.hasClass( "fadeIn" ) ) {
					$target.addClass( "active" );
				} else {
					$target.removeClass( "active" );
				}
			}

		} );

		$( ".regularButton" ).on( "click", IO.blurHack );

		//TODO: fix so that all cancelButtons use this class, and remove there id, and event-listener :)
		$( ".dialogCancelButton" ).click( function( event ) {
			event.preventDefault();
			$( event.target ).closest(".outerDialog").addClass("hidden")
		} );

		$( "[data-href]" ).on( "click", IO.openWindow );
		$( ".onClickToggleFullScreen" ).on( "click", IO.toggleFullScreen );
		$( ".blurOnClick" ).on( "click", IO.blurHack );
		$( ".showUploadSongToServerDialog" ).on( "click", Troff.showUploadSongToServerDialog )
		$( "#buttCopyUrlToClipboard" ).on( "click", Troff.buttCopyUrlToClipboard );
		$( ".onClickCopyTextToClipboard" ).on( "click", IO.onClickCopyTextToClipboard );

		$( "#groupDialogSave" ).on( "click", groupDialogSave );

		$( "#buttNewSongList" ).on( "click", clickButtNewSongList );
		$( "#songListAll" ).click( clickSongList_NEW );
		$( "#clickSongListAll" ).click( () => $( "#songListAll" ).click() );
		$( "#songListSelector" ).change( onChangeSongListSelector );

		$( ".buttSettingsDialog" ).click ( Troff.openSettingsDialog );
		$( "#buttCloseSettingPopUpSquare" ).click ( Troff.closeSettingsDialog );

		$( ".buttCloseSongsDialog" ).click( closeSongDialog );
		$( "#buttAttachedSongListToggle" ).click( clickAttachedSongListToggle );
		$( ".emptyAddAddedSongsToSongList_songs" ).on( "click", Troff.emptyAddAddedSongsToSongList_songs )

		$( "#buttSongsDialog" ).click( clickSongsDialog );
		$( ".buttSetSongsDialogToAttachedState" ).click( minimizeSongPicker );
		$( ".buttSetSongsDialogToFloatingState" ).click( maximizeSongPicker );
		$( "#outerSongListPopUpSquare" ).click( reloadSongsButtonActive );

		$( "#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG" ).click( clickToggleFloatingSonglists );

		$( "#toggleExtendedMarkerColor" ).click ( Troff.toggleExtendedMarkerColor );
		$( "#toggleExtraExtendedMarkerColor" ).click ( Troff.toggleExtraExtendedMarkerColor );

		$( "#themePickerParent" ).find("input").click ( Troff.setTheme );


		$('#buttPlayUiButtonParent').click( Troff.playUiButton );

		$('#timeBar')[0].addEventListener('input', Troff.timeUpdate );
		$('#volumeBar')[0].addEventListener('input', Troff.volumeUpdate );
		$('#speedBar')[0].addEventListener('input', Troff.speedUpdate );
		$('#speedBar').on("change", ( e ) => {gtag('event', 'Set Speed', { 'event_category' : 'Perform change', 'event_label': $(e.target).val() } );} );

		$('#buttRememberState').click(Troff.rememberCurrentState);
		$('#buttMarker').click(Troff.createMarker);
		$('#okCopyMarkersDialog').click( Troff.copyMarkers );
		$('#buttOpenCopyMarkersDialog').click( Troff.openCopyMarkersDialog );
		$('#okMoveAllMarkersDialogUp').click(Troff.moveAllMarkersUp);
		$('#okMoveAllMarkersDialogDown').click(Troff.moveAllMarkersDown);
		$('#okMoveSomeMarkersDialogUp').click(Troff.moveSomeMarkersUp);
		$('#okMoveSomeMarkersDialogDown').click(Troff.moveSomeMarkersDown);
		$( "#okDeleteSelectedMarkersDialog" ).click( Troff.deleteSelectedMarkers );
		$( "#okDeleteAllMarkersDialog" ).click( Troff.deleteAllMarkers );
		$( "#okStretchSelectedMarkersDialog" ).click( Troff.stretchSelectedMarkers );
		$( "#okStretchAllMarkersDialog" ).click( Troff.stretchAllMarkers );

		$( "#openExportGlobalSettingsDialog" ).on( "click", Troff.openExportGlobalSettingsDialog );
		$( "#openExportAllDataDialog" ).on( "click", Troff.openExportAllDataDialog );
		$( "#okImportAllDataDialog" ).on( "click", Troff.okImportAllDataDialog );
		$( "#okClearAndImportAllDataDialog" ).on( "click", Troff.okClearAndImportAllDataDialog );
		$( "#okImportGlobalSettingsDialog" ).on( "click", Troff.okImportGlobalSettingsDialog );

		$( ".writableField" ).on( "click", Troff.enterWritableField );
		$( ".writableField" ).on( "blur", Troff.exitWritableField );

		$( "#editSongDialogSave" ).on( "click", Troff.editSongDialogSave );
		$( ".onEditUpdateName" ).on( "change", Troff.onEditUpdateName );

		$('#buttCancelMoveMarkersDialog').click(Troff.hideMoveMarkers);
		$('#buttPromptMoveMarkers').click(Troff.showMoveMarkers);
		$('#buttPromptMoveMarkersMoreInfo').click(Troff.toggleMoveMarkersMoreInfo);
		$('#buttImportExportMarker').click(Troff.toggleImportExport);
		$('#buttCancelImportExportPopUpSquare').click(Troff.toggleImportExport);
		$('#buttExportMarker').click(Troff.exportStuff);
		$('#buttImportMarker').click(Troff.importStuff);

		$("[data-save-on-song-toggle-class]").click( IO.saveOnSongToggleClass );

		$( "#songlistColorPicker" ).find( "input" ).on(
			"click",
			Troff.setSonglistColor);
		$( "#songlistIconPicker" ).find( "button" ).on(
			"click",
			Troff.setSonglistIcon);

		// The jQuery version doesn't update as the user is typing:
		$( "[data-save-on-song-value]" ).each( function( i, element ){
			$( element )[0].addEventListener( "input", IO.saveOnSongValue );
		} );
		$("#pauseBeforeStart")[0].addEventListener('input', Troff.updateSecondsLeft);
		$('#buttPauseBefStart').click(() => { setTimeout(() => Troff.updateSecondsLeft(), 0 ) });
		$('#stopAfter')[0].addEventListener( 'input', Troff.setAppropriateActivePlayRegion );
		$('#buttStopAfter').click(() => { setTimeout(() => Troff.setAppropriateActivePlayRegion(), 0 ) } );
		$('#startBefore')[0].addEventListener('input', Troff.updateStartBefore);
		$('#buttStartBefore').click(() => { setTimeout(() => Troff.updateStartBefore(), 0 ) } );

		$('#buttZoom').click(Troff.zoomToMarker);
		$('#buttZoomOut').click(Troff.zoomOut);

		$('#areaSelector >').click(Troff.toggleArea);
		$(".onClickReload").click( () => window.location.reload());

		$('#markerInfoArea').change(Troff.updateMarkerInfo);
		$('#markerInfoArea').blur(Troff.exitMarkerInfo);
		$('#markerInfoArea').click(Troff.enterMarkerInfo);

		$('#songInfoArea').change(Troff.updateSongInfo);
		$('#songInfoArea').blur(Troff.exitSongInfo);
		$('#songInfoArea').click(Troff.enterSongInfo);
		$('#newSongListName').click(Troff.enterSongListName);
		$('#newSongListName').blur(Troff.exitSongListName);
		$('#saveNewSongList').click(Troff.saveNewSongList);
		$('#removeSongList').click(Troff.onClickremoveSonglist);
		$('#leaveGroup').click(Troff.onClickLeaveGroup);
		$('#shareSonglist').click(Troff.onClickShareSonglist)

		$('#cancelSongList').click(Troff.cancelSongList);

		$('#buttUnselectMarkers').click(Troff.unselectMarkers);
		$('#buttResetVolume').click(() => Troff.setVolume( $( "#TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE" ).val() ) );
		$('#volumeMinus').click(() => { Troff.incrementInput( "#volumeBar", - 5 ) } );
		$('#volumePlus').click(() => { Troff.incrementInput( "#volumeBar", + 5 ) } );
		$('#buttResetSpeed, #buttResetSpeedDemo').click(() => Troff.setSpeed( $( "#TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE" ).val() ) );
		$('#speedMinus, #speedMinusDemo').click(() => { Troff.incrementInput( "#speedBar", - 5 ); gtag('event', 'Increment Speed', { 'event_category' : 'Perform change', 'event_label': $("#speedBar").val() } ); } );
		$('#speedPlus, #speedPlusDemo').click(() => { Troff.incrementInput( "#speedBar", + 5 ); gtag('event', 'Increment Speed', { 'event_category' : 'Perform change', 'event_label': $("#speedBar").val() } ); } );

		$('#buttTapTempo').click( Troff.tapTime );
		$( '#tapTempo' ).on( "savedToDbEvent", Troff.onTapTempoSavedToDb );

		$('#rateDialogNoThanks').click(Rate.rateDialogNoThanks);
		$('#rateDialogAskLater').click(Rate.rateDialogAskLater);
		$('#rateDialogRateNow').click(Rate.rateDialogRateNow);

		$('#zoomInstructionDialogDontShowAgain').click(Troff.zoomDontShowAgain);
		$('#zoomInstructionDialogOK').click(Troff.zoomDialogOK);

		$('#importTroffDataToExistingSong_importNew').click(Troff.importTroffDataToExistingSong_importNew);
		$('#importTroffDataToExistingSong_merge').click(Troff.importTroffDataToExistingSong_merge);
		$('#importTroffDataToExistingSong_keepExisting').click(Troff.importTroffDataToExistingSong_keepExisting);

		$( ".click-to-select-text" ).click(function () {
				this.select();
		});

		$('.loopButt').click( Troff.setLoop );

		$(".jsUploadSongButt").on("click", Troff.uploadSongToServer );

		$( "#signOut" ).on( "click", signOut );
		$( ".googleSignIn" ).on( "click", googleSignIn );

		$( "#groupAddOwnerButt" ).on( "click", () => {addGroupOwnerRow();} );
		window.addEventListener('resize', function() {
			Troff.setAppropriateMarkerDistance();
		});

		Troff.recallGlobalSettings();

		window.addEventListener('online', onOnline );

		if( navigator.onLine ) {
			onOnline();
		}

	};//end startFunc

	/*IO*/ this.blurHack = function() {
		document.getElementById( "blur-hack" ).focus({ preventScroll: true });
	};

	/*IO*/ this.onClickCopyTextToClipboard = function( event ) {
		IO.copyTextToClipboard( $( event.target ).val() );
	};

	/*IO*/ this.copyTextToClipboard = async function( text ) {
		if( !navigator.clipboard ) {
			IO.fallbackCopyTextToClipboard( text );
			return;
		}

		navigator.clipboard.writeText( text ).then(
			() => { IO.copyToClipboardSuccessful( text ) },
			() => { IO.copyToClipboardFailed( text ) }
		);
	};

	/*IO*/ this.fallbackCopyTextToClipboard = function( text ) {
		var textArea = document.createElement("textarea");
		textArea.value = text;

		// Avoid scrolling to bottom
		textArea.style.top = "0";
		textArea.style.left = "0";
		textArea.style.position = "fixed";

		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		try {
			var successful = document.execCommand('copy');
			var msg = successful ? 'successful' : 'unsuccessful';

			if( successful ) {
			IO.copyToClipboardSuccessful( text );
			} else {
			IO.copyToClipboardFailed( text )
			}
		} catch (err) {
				IO.copyToClipboardFailed( text );
		}

		document.body.removeChild( textArea );
	};

	/*IO*/ this.copyToClipboardSuccessful = function( text ) {
		$.notify(
			`Copied "${text}" to clipboard!`,
			{
				className: 'success',
				autoHide: true,
				clickToHide: true
			}
		);
	};

	/*IO*/ this.copyToClipboardFailed = function( text ) {
		$.notify(
			`Could not copy "${text}" to clipboard, please copy the text manually`,
			{
				className: 'error',
				autoHide: false,
				clickToHide: true
			}
		);
	};


	/*IO*/this.keyboardKeydown  = function(event) {
		if( event.altKey ) {
			event.preventDefault();
		}

		if(IOEnterFunction){
			if( event.keyCode == 9 && $( event.target).hasClass( "allow-tab" ) ) {
				$( event.target).addClass( "tab-activated" );
			}

			if(event.keyCode == 13){
				IOEnterFunction(event);
			}
			if( IOArrowFunction ) {
				if( [37, 38, 39, 40].indexOf(event.keyCode) != -1 ) {
					IOArrowFunction(event);
				}
			}
			return;
		}

		if(event.keyCode == 229) { // weird thing but ok...
			return;
		}

		//if 0 to 9 or bakspace, del, alt, arrows in a input-field, return,
		//---- site add "numpad"
		if( $(':input[type="number"]' ).is(":focus") ) {
			if (
				(event.keyCode>=48 && event.keyCode<=57) || //numbers
				(event.keyCode>=96 && event.keyCode<=105)|| //numpad
				event.keyCode==8  || //backspace
				event.keyCode==18 || //alt
				event.keyCode==37 || //left arrow
				event.keyCode==39 || //right arrow
				event.keyCode==46    //del
			) {
				return;
			} else if (
				event.keyCode == 13 // Enter
			) {
				$(':input[type="number"]' ).blur();
				IO.blurHack();
				return;
			}
		}
		IO.blurHack();


		if(event.keyCode>=48 && event.keyCode<=57) {
				// pressed a number
				var number = event.keyCode - 48;
				Troff.setLoopTo(number);
				gtag('event', "Change loop", { 'event_category': "Perform change", 'event_label': number || '∞' });
		}

		var altTime = 0.08333333333; // one frame
		var regularTime = 0.8333333333; // 10 freames
		var shiftTime = 8.333333333; // 100 frames

		let forceReturn = false;

		$( "[data-hot-key]" ).each( function( i, element ) {
			const $target = $( element ),
				incrementsSelector = $target.data( "hot-key-increments"),
				incrementAmount = $target.data( "hot-key-increment-amount") || 1;
			if( String.fromCodePoint( event.keyCode ) != $target.data( "hot-key" ).toUpperCase() ) {
				return;
			}
			if( event.ctrlKey ) {
				return;
			}

			if( event.shiftKey==1 || event.altKey==1 ) {
				if( incrementsSelector == undefined ) {
					return;
				}
				if( event.shiftKey )
					Troff.incrementInput( incrementsSelector, incrementAmount );
				if( event.altKey )
					Troff.incrementInput( incrementsSelector, -incrementAmount );
				forceReturn = true;
				return;
			}

			const isTextInput =  $target.is( "input" ) && $target.attr( "type" ) == "text";
			const isTextArea = $target.is( "textarea" );
			if( isTextInput || isTextArea ) {
				forceReturn = true;
				if( $target.is(":hidden") ) {
					return;
				}
				setTimeout( () => {
					$target.trigger( "click" );
					$target.focus();
				}, 42);
			} else {
				forceReturn = true;
				$target.trigger( "click" );
			}
		} );
		if( forceReturn ) {
			return;
		}

		switch(event.keyCode){
		case 32: //space bar
			Troff.space();
			break;
		case 13: // return
			Troff.enterKnappen();
			break;
		case 27: // esc
			Troff.pauseSong();
			Troff.forceNoFullscreen();
			break;
		case 78: // N
			if(event.shiftKey==1){
				Troff.selectNext(/*reverse = */true);
			} else {
				Troff.selectNext(/*reverse = */ false);
			}
			break;
		case 40: // downArrow
			if(event.shiftKey==1 && event.altKey==1)
				Troff.moveOneMarkerDown(shiftTime);
			else if(event.shiftKey==1)
				Troff.moveOneMarkerDown(regularTime);
			else if(event.altKey)
				Troff.moveOneMarkerDown(altTime);
			break;
		case 38: // uppArrow ?
			if(event.shiftKey==1 && event.altKey==1)
				Troff.moveOneMarkerDown(-shiftTime);
			else if(event.shiftKey==1)
				Troff.moveOneMarkerDown(-regularTime);
			else if(event.altKey)
				Troff.moveOneMarkerDown(-altTime);
			break;
		case 39: // rightArrow
			if(event.shiftKey==1)
			$('audio, video')[0].currentTime += shiftTime;
			else if(event.altKey==1)
			$('audio, video')[0].currentTime += altTime;
			else
				$('audio, video')[0].currentTime += regularTime;
			break;
		case 37: // leftArrow
			if(event.shiftKey==1)
			$('audio, video')[0].currentTime -= shiftTime;
			else if(event.altKey==1)
			$('audio, video')[0].currentTime -= altTime;
			else
				$('audio, video')[0].currentTime -= regularTime;
			break;
		case 70: // F
			if(event.ctrlKey==1){
				event.preventDefault();
				Troff.showSearchAndActivate();
			} else
				Troff.forceFullscreenChange();
			break;
		case 71: // G
			Troff.goToStartMarker();
			break;
		case 85: // U
			if(event.shiftKey==1)
				Troff.unselectStartMarker();
			else if(event.altKey==1)
				Troff.unselectStopMarker();
			else
				Troff.unselectMarkers();
			break;
		case 90: // Z
			if(event.shiftKey==1)
				Troff.zoomOut();
			else
				Troff.zoomToMarker();
			break;
		//default:
			//console.info("key " + event.keyCode);
		}// end switch

	}; // end keyboardKeydown *****************/

	/*IO*/this.setEnterFunction = function(func, arrowFunc){
		IOEnterFunction = func;
		if( arrowFunc !== undefined ) IOArrowFunction = arrowFunc;
		else IOArrowFunction = false;
	};

	/*IO*/this.clearEnterFunction = function(){
		if( $(".tab-activated" ).length != 0 ) {
			$(".tab-activated" ).removeClass( "tab-activated" );
			return;
		}

		IOEnterFunction = false;
		IOArrowFunction = false;
	};

	/*IO*/this.promptEditMarker = function(markerId, func, funcCancle){
		"use strict";

		var markerName;
		var markerInfo;
		var markerColor;
		var markerTime;
		var strHeader;

		if(markerId){
			markerName = $('#'+markerId).val();
			markerInfo = $('#'+markerId)[0].info;
			markerColor = $('#'+markerId)[0].color;
			markerTime = Number($('#'+markerId)[0].timeValue);
			strHeader = "Edit marker";
		} else {
			markerName = "marker nr " + ($('#markerList li').length + 1);
			markerInfo = "";
			markerColor = "None";
			markerTime = $('audio, video')[0].currentTime;
			strHeader = "Create new marker";
		}


		var buttOK = $("<input>", {
			"type":"button",
			"class":"regularButton",
			"value": "OK"
		});

		var buttCancel = $("<input>", {
			"type":"button",
			"class": "regularButton",
			"value": "Cancel"
		});

		var buttRemove = $("<input>", {
			"type":"button",
			"class":"regularButton",
			"value": "Remove"
		});

		function setColor(){
			$('.colorPickerSelected').removeClass('colorPickerSelected');
			this.classList.add('colorPickerSelected');
			$colorText.find( "span" ).html(this.getAttribute('color'));
			IO.blurHack();
		}

		function generateColorBut(col){
			var clas = "colorPicker backgroundColor" + col;
			if(col === markerColor){
				clas += " colorPickerSelected";
			}
			return $("<input>", {
								"type":"button",
								"value":"",
								"color":col,
								"class":clas,
							}).click(setColor);
		}
		var butColor0 = generateColorBut("None");
		var butColor1 = generateColorBut("Bisque");
		var butColor2 = generateColorBut("Aqua");
		var butColor3 = generateColorBut("Chartreuse");
		var butColor4 = generateColorBut("Coral");
		var butColor5 = generateColorBut("Pink");
		var butColor6 = generateColorBut("Burlywood");
		var butColor7 = generateColorBut("Darkcyan");
		var butColor8 = generateColorBut("Yellowgreen");
		var butColor9 = generateColorBut("Peru");
		var butColor10 = generateColorBut("Violet");


		var row0 = $("<span>", {"class": "oneRow"})
							 .append( $( "<h2>" ).append( strHeader ) );

		let $markerName = $( "<input>", {
				"type":"text",
				"value": markerName,
				"class":"ml-2"
			});

		var row1 = $("<span>", {"class": "oneRow"})
							 .append( $( "<p>" ).append( "Name:" ))
							 .append( $markerName );


		let $markerTime = $("<input>", {
			"type":"number",
			"value":markerTime,
			"class": "w-auto p-2 ml-3 text-left"
		});

		var row2 = $("<span>", {"class": "oneRow"})
									.append($("<p>").append("Time:"))
									.append( $markerTime )
									.append($("<p>").append("seconds"));

		let $markerInfo = $("<textarea>", {
			"placeholder": "Put extra marker info here",
			"text": markerInfo,
			"rows": 6,
			"class":"ml-4 p-2"
		});

		var row3 = $("<span>", {"class": "oneRow"})
										.append($("<p>").append("Info:"))
										.append( $markerInfo );

		let $colorText = $("<div>", {"class": "flexCol flex"})
			.append($("<p>").append("Color:"))
			.append($("<span>").append(""))

		var row4 = $("<span>", {"class": "oneRow"})
									.append(
										$colorText
									)
									.append(
										$("<div>", {"class":"flexRowWrap"})
										.append(butColor0)
									)
									.append(
										$("<div>", {"class":"flexRowWrap colorPickerWidth"})
										.append(butColor1)
										.append(butColor2)
										.append(butColor3)
										.append(butColor4)
										.append(butColor5)
										.append(butColor6)
										.append(butColor7)
										.append(butColor8)
										.append(butColor9)
										.append(butColor10)
									);

		var row5 = "";
		if(markerId){
			row5 = $("<span>", {"class": "oneRow"})
											.append($("<p>").append("Remove this marker:"))
											.append(buttRemove);
		}
		var row6 = $("<span>", {"class": "oneRow"})
										.append(buttOK)
										.append(buttCancel);

		let $outerDialog =
				$("<div>", {"class": "outerDialog"})
					.append(
						$("<div>", {"class": "innerDialog secondaryColor w-auto mw-100 vScroll mh-100"} )
							.append(row0)
							.append(
								$( "<div>" )
									.append(row1)
									.append(row2)
									.append(row3)
									.append(row4)
									.append(row5)
								)
							.append(row6)
					);

		$('body').append( $outerDialog );


		IOEnterFunction = function() {
			if(func) func(
				$markerName.val(),
				$markerInfo.val(),
				$(".colorPickerSelected").attr("color"),
				$markerTime.val()
			);
			$outerDialog.remove();
			IOEnterFunction = false;
		};

		buttOK.click(IOEnterFunction)
		buttCancel.on( "click", function(){
			if(funcCancle) funcCancle();
			$outerDialog.remove();
			IOEnterFunction = false;
		});


		buttRemove.click(function(){

			var confirmDelete = $( "#" + TROFF_SETTING_CONFIRM_DELETE_MARKER ).hasClass( "active" );
			$outerDialog.remove();
			IOEnterFunction = false;

			if( $('#markerList li').length <= 2 ) {
				IO.alert(
					"Minimum number of markers",
					"You can not remove this marker at the moment, "+
					"you can not have fewer than 2 markers"
				);
				return;
			}

			if( markerId ) {
				if( confirmDelete ) {
					IO.confirm( "Remove marker", "Are you sure?", function() {
						Troff.removeMarker( markerId );
					} );
				} else {
					Troff.removeMarker( markerId );
				}
			}
		});

		var quickTimeOut = setTimeout(function(){
			$markerName.select();
			$colorText.find( "span" ).html(markerColor);
			clearInterval(quickTimeOut);
		}, 0);

	}; // end promptEditMarker   *******************/

	this.promptDouble = function(oInput, func, funcCancle){
		var textHead = oInput.strHead;
		var textBox  = oInput.strInput;
		var bDouble  = oInput.bDouble;
		var strTextarea = oInput.strTextarea || "";
		var strTextareaPlaceholder = oInput.strTextareaPlaceholder || "";

		var time = Date.now();
		var buttEnterId = "buttOkId" + time;


		var textId = "textId" + time;
		var textareaId = "textareaId" + time;
		var buttCancelId = "buttCancelId" + time;
		var innerId = "innerId" + time;
		var outerId = "outerId" + time;
		var outerDivStyle = ""+
				"position: fixed; "+
				"top: 0px;left: 0px; "+
				"width: 100vw; "+
				"height: 100%; "+
				"background-color: rgba(0, 0, 0, 0.5);"+
				"z-index: 99;"+
				"display: flex;align-items: center;justify-content: center;";
		var innerDivStyle = ""+
				"width: 200px;"+
				"padding: 10px 15px;";
		var pStyle = "" +
				"font-size: 18px;";

		var strTextareaHTML ="";
		if(bDouble){
			strTextareaHTML = "<textarea placeholder='"+strTextareaPlaceholder+"'"+
										"id='"+textareaId+"'>"+strTextarea+"</textarea>";
		}

		$("body").append($("<div id='"+outerId+"' style='"+outerDivStyle+
							 "'><div id='"+innerId+"' style='"+innerDivStyle+
							 "' class='secondaryColor'><p style='"+pStyle+"'>" + textHead +
							 "</p><input type='text' class=\"full-width\" id='"+textId+
							 "'/> "+strTextareaHTML+
							 "<input type='button' class='regularButton' id='"+ buttEnterId +
							 "' value='OK'/><input type='button' class='regularButton' id='" +
							 buttCancelId + "' value='Cancel'/></div></div>"));

		$("#"+textId).val(textBox);
		var quickTimeOut = setTimeout(function(){
				$("#"+textId).select();
				clearInterval(quickTimeOut);
		}, 0);

		IOEnterFunction = function(){
				if(func) func( $("#"+textId).val(), $("#"+textareaId).val() );
				$('#'+outerId).remove();
				IOEnterFunction = false;
		};
		$("#"+buttEnterId).click( IOEnterFunction );
		$("#"+buttCancelId).click( function(){
				if(funcCancle) funcCancle();
				$('#'+outerId).remove();
				IOEnterFunction = false;
		});
	}; // end promptDouble

	this.prompt = function(textHead, textBox, func, funcCancle){
		var oFI = {};
		oFI.strHead = textHead;
		oFI.strInput = textBox;
		oFI.bDouble = false;
		oFI.strTextarea = "";
		oFI.strTextareaPlaceholder = "";
		IO.promptDouble(oFI, func, funcCancle);
	}; // end prompt

	/*IO*/this.confirm = function(textHead, textBox, func, funcCancel, confirmButtonText, declineButtonText ) {
		confirmButtonText = st.defaultFor(confirmButtonText, "OK");
		declineButtonText = st.defaultFor(declineButtonText, "Cancel");

		let outerDiv = $( "<div>" ).addClass("outerDialog onTop");
		let innerDiv = $( "<div>" ).addClass("innerDialog m-4");

		let clickCancel = function(){
			if(funcCancel) funcCancel();
			outerDiv.remove();
			IOEnterFunction = false;
		};

		IOEnterFunction = function(){
			if(func) func();
			outerDiv.remove();
			IOEnterFunction = false;
		};

		let buttRow = $( "<div>" )
			.append(
				$("<input>" )
					.addClass( "regularButton" )
					.attr( "type", "button" ).attr( "value", confirmButtonText )
					.on( "click", IOEnterFunction )
			)
			.append(
				$("<input>" )
					.addClass( "regularButton" )
					.attr( "type", "button" ).attr( "value", declineButtonText )
					.on( "click", clickCancel )
			);

		innerDiv
			.append( $( "<h2>" ).html( textHead ) )
			.append( $( "<p>" ).addClass( "py-2 text-break w-auto" ).html( textBox ) )
			.append( buttRow );

		$( "body" ).append( outerDiv.append( innerDiv ) );
	}; // end confirm


	this.alert = function(textHead, textBox, func){
			var time = Date.now();
			var buttEnterId = "buttOkId" + time;

			var textId = "textId" + time;
			var innerId = "innerId" + time;
			var outerId = "outerId" + time;

			if(textBox){
					$("body").append($("<div id='"+outerId+"' class='outerDialog'>"+
						"<div id='"+innerId+"' "+
										 " class='secondaryColor p-4 w-exact-200'><h2 class=\"Big\">" + textHead +
										 "</h2><p class=\"full-width my-3 normalSize\" type='text' id='"+textId+
										 "'>"+textBox+"</p> <input type='button' id='"+buttEnterId+
										 "'class='regularButton' value='OK'/></div></div>"));
					$("#"+textId).val(textBox).select();
			} else {
					$("body").append($("<div id='"+outerId+"' class='outerDialog'>"+
						"<div id='"+innerId+"' "+
									" class='secondaryColor p-4 w-exact-200'><p class=\"normalSize\" >" + textHead +
									"</p><input type='button' id='"+buttEnterId+
									"' class='regularButton' value='OK'/></div></div>"));
			}
			IOEnterFunction = function(){
					if(func) func( $("#"+textId).val() );
					$('#'+outerId).remove();
					IOEnterFunction = false;
			};
			$("#"+buttEnterId).click( IOEnterFunction );
	}; // end alert

	this.loopTimesLeft = function(input){
		if(!input)
				return $('.loopTimesLeft').eq(0).text();
		if(input == -1)
				$('.loopTimesLeft').html( $('.loopTimesLeft').eq(0).text() -1 );
		else
				$('.loopTimesLeft').html( input );
	};

	/*IO*/this.saveOnSongValue = function( event ) {
		var $target = $( event.target ),
			id = $target.attr( "id" ),
			value = $target.val();

		if( id == undefined ) {
			log.e( 'this element is missing "id", can not save!', $target );
			return;
		}

		key = "TROFF_VALUE_" + id;
		DB.setCurrent(Troff.getCurrentSong(), key, value );
		event.target.dispatchEvent( new Event("savedToDbEvent") );
	}

	/*IO*/this.saveOnSongToggleClass = function( event ) {
		IO.blurHack();

		var $target = $( event.target ),
			targetHasClass,
			id = $target.attr( "id" ),
			classToToggleAndSave = $target.data( "save-on-song-toggle-class" );

		if( id == undefined ) {
			log.e( 'this element is missing "id", can not save!', $target );
			return;
		}

		if( classToToggleAndSave == undefined ) {
			log.e( 'this element is missing "classToToggleAndSave", can not toggle!', $target );
			return;
		}

		$target.toggleClass( classToToggleAndSave );

		key = "TROFF_CLASS_TO_TOGGLE_" + id;
		value = $target.hasClass( classToToggleAndSave );

		DB.setCurrent(Troff.getCurrentSong(), key, value );

	}

}; // end IOClass




const errorHandler = {};

// Create an object type UserException
function ShowUserException(message) {
	this.message = message;
	this.stack = (new Error()).stack;
}
ShowUserException.prototype = new Error;
ShowUserException.prototype.name = 'ShowUserException';

$(function () {
	"use strict";

	errorHandler.backendService_getTroffData = function( error, serverId, fileName ) {
		IO.removeLoadScreen();
		$( "#downloadSongFromServerInProgressDialog" ).addClass( "hidden" );
		$( "#downloadMarkersFromServerInProgressDialog" ).addClass( "hidden" );
		if( error.status == 0 ) {
			$.notify(
				`Could not connect to server. Please check your internet connection.
					If your internet is working, please try again later.
					If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com.`,
				{
					className: 'error',
					autoHide: false,
					clickToHide: true
				}
			);
			return;
		}
		if( error.status == "NOT_FOUND" ) {
			$.notify(
				`Could not find song "${fileName}", with id "${serverId}", on the server,
				perhaps the URL is wrong or the song has been removed`,
				{
					className: 'error',
					autoHide: false,
					clickToHide: true
				}
			);
			return;
		}

		if( error instanceof ShowUserException ) {
			$.notify( error.message,
				{
					className: 'error',
					autoHide: false,
					clickToHide: true
				}
			);
			return;
		}
		$.notify(
			`An unknown error occurred when trying to download the song "${fileName}", with id "${serverId}", from the server,
			please try again later.
			If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com
			explaining what happened`,
			{
				className: 'error',
				autoHide: false,
				clickToHide: true
			}
		);
		log.e( `errorHandler.backendService_getTroffData: Full Error:\n`, error );
		return;
	};

	errorHandler.fileHandler_fetchAndSaveResponse = function( error, fileName ) {
		IO.removeLoadScreen();
		$( "#downloadSongFromServerInProgressDialog" ).addClass( "hidden" );
		$( "#downloadMarkersFromServerInProgressDialog" ).addClass( "hidden" );
		if( error.status == 404 ) {
			$.notify(
				`The song "${fileName}", could not be found on the server, it has probably been removed
				but the markers have been loaded, if you have the file named "${fileName}", you can
				simply import it again and the markers will be connected with the file!`,
				{
					className: 'error',
					autoHide: false,
					clickToHide: true
				}
			);
			return;
		}

		if( error instanceof ShowUserException ) {
			$.notify( error.message,
				{
					className: 'error',
					autoHide: false,
					clickToHide: true
				}
			);
			return;
		}

		$.notify(
			`An unknown error occurred with the song "${fileName}",
			please try again later.
			If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com
			explaining what happened`,
			{
				className: 'error',
				autoHide: false,
				clickToHide: true
			}
		);
		log.e( `errorHandler.fileHandler_fetchAndSaveResponse: Full Error:\n`, error );
		return;
	};

	errorHandler.fileHandler_sendFile = function( error, fileName ) {
		IO.removeLoadScreen();
		$( "#uploadSongToServerInProgressDialog" ).addClass( "hidden" );
		if( error.status == 0 ) {
			$.notify(
				`Could not upload the song "${fileName}": could not connect to server. Please check your internet connection.
					If your internet is working, please try again later.
					If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com`,
				{
					className: 'error',
					autoHide: false,
					clickToHide: true
				}
			);
			return;
		}

		if( error instanceof ShowUserException ) {
			$.notify( error.message,
				{
					className: 'error',
					autoHide: false,
					clickToHide: true
				}
			);
			return;
		}

		$.notify(
			`An unknown error occurred, please try again later.
			If you still get till message after 24 hours, please submit a error message to slimsimapps@gmail.com
			explaining what happened`,
			{
				className: 'error',
				autoHide: false,
				clickToHide: true
			}
		);
		log.e( `errorHandler.fileHandler_sendFile: Full Error:\n`, error );
	}

});
