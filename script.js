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

// todo: try to use the strict mode! :)
// - what could possibly go wrong?
// "use strict";
window.alert = function( alert){
	console.warn("Alert:", alert);
}

var imgFormats = ['png', 'bmp', 'jpeg', 'jpg', 'gif', 'png', 'svg', 'xbm', 'webp'];
var audFormats = ['wav', 'mp3', 'm4a'];
var vidFormats = ['avi', '3gp', '3gpp', 'flv', 'mov', 'mpeg', 'mpeg4', 'mp4', 'webm', 'wmv', 'ogg'];

var TROFF_SETTING_SET_THEME = "TROFF_SETTING_SET_THEME";
var TROFF_SETTING_EXTENDED_MARKER_COLOR = "TROFF_SETTING_EXTENDED_MARKER_COLOR";
var TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR = "TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR";
var TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR = "TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR";
var TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR = "TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR";
var TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR = "TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR";
var TROFF_SETTING_ENTER_RESET_COUNTER = "TROFF_SETTING_ENTER_RESET_COUNTER";
var TROFF_SETTING_SPACE_RESET_COUNTER = "TROFF_SETTING_SPACE_RESET_COUNTER";
var TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER = "TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER";
var TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR = "TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR";
var TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR = "TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR";
var TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR = "TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR";
var TROFF_SETTING_PLAY_UI_BUTTON_SHOW_BUTTON = "TROFF_SETTING_PLAY_UI_BUTTON_SHOW_BUTTON";
var TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER = "TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER";
var TROFF_SETTING_CONFIRM_DELETE_MARKER = "TROFF_SETTING_CONFIRM_DELETE_MARKER";
var TROFF_SETTING_UI_ARTIST_SHOW = "TROFF_SETTING_UI_ARTIST_SHOW";
var TROFF_SETTING_UI_TITLE_SHOW = "TROFF_SETTING_UI_TITLE_SHOW";
var TROFF_SETTING_UI_ALBUM_SHOW = "TROFF_SETTING_UI_ALBUM_SHOW";
var TROFF_SETTING_UI_PATH_SHOW = "TROFF_SETTING_UI_PATH_SHOW";
var TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW = "TROFF_SETTING_UI_PLAY_FULL_SONG_BUTTONS_SHOW";
var TROFF_SETTING_UI_ZOOM_SHOW = "TROFF_SETTING_UI_ZOOM_SHOW";
var TROFF_SETTING_UI_LOOP_BUTTONS_SHOW = "TROFF_SETTING_UI_LOOP_BUTTONS_SHOW";
var TROFF_SETTING_SONG_COLUMN_TOGGLE = "TROFF_SETTING_SONG_COLUMN_TOGGLE";
var TROFF_SETTING_SONG_LISTS_LIST_SHOW = "TROFF_SETTING_SONG_LISTS_LIST_SHOW";
var TROFF_CURRENT_STATE_OF_SONG_LISTS = "TROFF_CURRENT_STATE_OF_SONG_LISTS";
var TROFF_SETTING_SHOW_SONG_DIALOG = "TROFF_SETTING_SHOW_SONG_DIALOG";


var MARKER_COLOR_PREFIX = "markerColor";


function addImageToContentDiv() {
	var content_div = document.getElementById('content');
	var videoBox = document.createElement('div');
	var image = document.createElement('img');

	videoBox.setAttribute('id', "videoBox");
	image.classList.add( "contain-object" );
	image.classList.add( "full-width" );
	Troff.setMetadataImage(image);
	Troff.setImageLayout();

	var fsButton = document.createElement('button');
	fsButton.addEventListener('click', Troff.forceFullscreenChange );
	fsButton.appendChild( document.createTextNode('Fullscreen (F)') );
	content_div.appendChild(fsButton);
	videoBox.appendChild(image);
	content_div.appendChild(videoBox);

	return image;
}

function addAudioToContentDiv() {
	var content_div = document.getElementById('content');
	var audio = document.createElement('audio');
	audio.addEventListener('loadedmetadata', function(e){
		Troff.setMetadata(audio);
		Troff.setAudioVideoLayout();
	});
	content_div.appendChild(audio);
	return audio;
}

function addVideoToContentDiv() {
	var content_div = document.getElementById('content');
	var videoBox = document.createElement('div');
	var video = document.createElement('video');

	var fsButton = document.createElement('button');

	var margin = "4px";
	video.style.marginTop = margin;
	video.style.marginBottom = margin;


	fsButton.addEventListener('click', Troff.playInFullscreenChanged);
	fsButton.appendChild( document.createTextNode('Play in Fullscreen') );
	fsButton.setAttribute('id', "playInFullscreenButt");
	fsButton.setAttribute('class', "stOnOffButton mt-2 mr-2");

	videoBox.setAttribute('id', "videoBox");

	video.addEventListener('loadedmetadata', function(e){
		Troff.setMetadata(video);
		Troff.setAudioVideoLayout();
	});

	content_div.appendChild(fsButton);

	content_div.appendChild( $("<button>")
		.text("Mirror Image")
		.attr( "id", "mirrorImageButt")
		.click( Troff.mirrorImageChanged )
		.addClass("stOnOffButton mt-2 mr-2")[0] )

	videoBox.appendChild(video);
	content_div.appendChild(videoBox);
	return video;
}

function getFileExtension( filename ){
	return filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
}

function getFileType(filename) {
	 var ext = getFileExtension( filename );
	 if (imgFormats.indexOf(ext) >= 0)
			return "image";
	 else if (audFormats.indexOf(ext) >= 0)
			return "audio";
	 else if (vidFormats.indexOf(ext) >= 0)
			return "video";
	 else return null;
}

function getFileTypeFaIcon( filename ) {
	var type = getFileType( filename );

	switch(type){
	case "image":
		return "fa-image";
	case "audio":
		return "fa-music";
	case "video":
		return "fa-film";
	}
	return "fa-question";
}

function clearContentDiv() {
	 var content_div = document.getElementById('content');
	 while (content_div.childNodes.length >= 1) {
			content_div.removeChild(content_div.firstChild);
	 }
}

function setSong2(/*fullPath, galleryId*/ path, type, songData ){
	Troff.pauseSong();

	if( $( "#TROFF_SETTING_SONG_LIST_CLEAR_ON_SELECT" ).hasClass( "active" ) ) {
		$("#dataSongTable_filter").find( "input" ).val('');
		$('#dataSongTable').DataTable().search('').draw();
	}

	var exitOnSelect = $( "#TROFF_SETTING_SONG_LIST_EXIT_ON_SELECT" ).hasClass( "active" ),
		floatingDialog = $( "#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG" ).hasClass( "active" );

	if( exitOnSelect && floatingDialog ) {
		closeSongDialog();
	}

	//var path = fullPath;
	DB.setCurrentSong(path, "pwa-galleryId");

	Troff.setWaitForLoad(path, "pwa-galleryId");
	//fs.root.getFile(path, {create: false}, function(fileEntry) {

	var newElem = null;
	// show the file data
	clearContentDiv();
	var type = getFileType(path);

	if (type == "image")
		newElem = addImageToContentDiv();
	else if (type == "audio")
		newElem = addAudioToContentDiv();
	else if (type == "video")
		newElem = addVideoToContentDiv();

	if ( !newElem ) {
		console.error( "setSong2: newElem is not defined!" );
		return;
	}
	// TODO: metadata? finns det något sätt jag kan få fram metadata från filerna?
	$( "#currentPath" ).text( path );

	$('#currentSong').text( Troff.pathToName( path ) ).show();
	$('#currentArtist').text( "" );

	$( "#downloadSongFromServerInProgressDialog" ).addClass( "hidden" );

	// TODO: se om jag kan få till metadata? (att man själv får fylla i det kanske? )
	/*if(metadata.title){
		$('#currentSong').text( metadata.title ).show();
	} else {
		$('#currentArtist').text(Troff.pathToName(path));
	}
	if(metadata.artist)
		$('#currentArtist').text( metadata.artist );
	if(metadata.album)
		$('#currentAlbum').text ( metadata.album ).show();
	*/

	newElem.setAttribute('src', songData);

} //end setSong2

function sortAndValue(sortValue, stringValue) {
	if( sortValue === undefined )
		return "<i class=\"hidden\">" + 0 + "</i>";//<i class=\"fa " + faType + "\"></i>",
	return "<i class=\"hidden\">" + sortValue + "</i>" + stringValue;//<i class=\"fa " + faType + "\"></i>",
}

function clickSongList_NEW( event ) {
	IO.blurHack();
	var $target = $(event.target),
		data = $target.data("songList"),
		galleryId = $target.attr("data-gallery-id"),
		fullPath = $target.attr("data-full-path");

	$( "#songListAll_NEW" ).removeClass( "selected" );

	if( $("#TROFF_SETTING_SONG_LIST_ADDITIVE_SELECT").hasClass( "active" ) ) {

		if( data || galleryId ) {
			$target.toggleClass( "active" );
			$( "#songListsList" ).find( "button" ).removeClass("selected");
		} else {
			// It only enters here IF the All songs-button is pressed :)
			$( "#songListsList" ).find( "button" ).removeClass("selected").removeClass("active");
			$target.addClass("selected");
		}
	} else {
		$( "#songListsList" ).find( "button" ).removeClass("selected").removeClass("active");
		$target.addClass( "selected" );
	}

	Troff.saveCurrentStateOfSonglists();

	filterSongTable( getFilterDataList() );

}

function filterSongTable( list ) {
	var regex = list.join("|") || false;
	if( $( "#directoryList, #galleryList, #songListsList").find("button").filter( ".active, .selected" ).length == 0 ) {
		$( "#songListAll_NEW" ).addClass( "selected" );
		regex = "";
	}
	$('#dataSongTable').DataTable()
		.columns( 0 )
		.search( regex, true, false )
		.draw();
}

function getFilterDataList(){
	var list = [];
	$( "#directoryList, #galleryList").find("button").filter( ".active, .selected" ).each(function(i, v){
		var fullPath = $(v).attr("data-full-path");
		var galleryId = $(v).attr("data-gallery-id");

		if( fullPath ) {
			list.push( "^{\"galleryId\":\"" + galleryId + "\",\"fullPath\":\"" + escapeRegExp( fullPath ) );
		} else {
			list.push( "^{\"galleryId\":\"" + galleryId + "\"" );
		}
	} );

	$( "#songListsList").find("button").filter( ".active, .selected" ).each(function(i, v){
		var innerData = $(v).data("songList");

		if( innerData ) {
			$.each(innerData.songs, function(i, vi) {
				if( vi.isDirectory ) {
					list.push( "^{\"galleryId\":\"" + vi.galleryId + "\"" );
				} else {
					list.push( "\"fullPath\":\"" + escapeRegExp(vi.fullPath) + "\"}$" );
				}
			} );
		}
	} );
	return list;
}

function escapeRegExp(string) {
	return string
		.replace("\"", "\\\"") // wierd extra escaping of > \" <
		.replace(/[".*+?^${}()|[\]\\]/g, '\\$&');	// $& means the whole matched string
}

async function createSongAudio( path ) {
	let songIsV2;
	try {
		songIsV2 = await cacheImplementation.isSongV2( path )
	} catch ( e ) {
		return errorHandler.fileHandler_fetchAndSaveResponse( new ShowUserException(`The song "${path}" does not exist.
			if you have the file named "${path}", you can
			simply import it again and the markers will be connected with the file!` ) );
	}

	if( songIsV2 ) {
		try {
			var songData = await cacheImplementation.getSong( path );

			setSong2( path, "audio", songData );
		} catch (e) {
			console.error("error: No song selected yet: ", e);
		}
	} else {
		try {
			let v3SongObjectUrl = await fileHandler.getObjectUrlFromFile( path );
			setSong2( path, "audio", v3SongObjectUrl );
		} catch ( e ) {
			errorHandler.fileHandler_sendFile( e );
		}
	}

};

function addItem_NEW_2( key ) {

	var galleryId = "pwa-galleryId";
	var extension = getFileExtension( key );
	var faType = getFileTypeFaIcon( key );

	var selected_path = Troff.getCurrentSong();
	var selected_galleryId = Troff.getCurrentGalleryId();

	DB.getVal( key, function( song ) {

		var tempo = "?",
			info = "",
			//titleOrFileName = metadata.title || file.name.substr(0, file.name.lastIndexOf( '.' ) - 1);
			titleOrFileName = Troff.pathToName( key );
		if( song != undefined ) {
			tempo = song.TROFF_VALUE_tapTempo;
			info = song.info;
		}

		var dataInfo = {
			"galleryId" : galleryId,
			"fullPath" : key
		};

		var newRow = $('#dataSongTable').DataTable().row.add( [
			JSON.stringify( dataInfo ),
//					null, // Play
			null, // Menu ( Hidden TODO: bring forward and implement )
			sortAndValue(faType, "<i class=\"fa " + faType + "\"></i>"),//type
			"?",//sortAndValue( metadata.duration, Troff.secToDisp( metadata.duration ) ),//Duration
			titleOrFileName,
			key, //metadata.title || "",
			"?",//metadata.artist || "",
			"?",//metadata.album || "",
			tempo,
			"?",//metadata.genre || "",
			"?",//mData.name + itemEntry.fullPath, //File Path
			"",//Troff.milisToDisp( file.lastModified ),
			"?",//sortAndValue( file.size, Troff.byteToDisp( file.size ) ),
			info,
			"." + extension
		] )
		//.onClick => .on('click', 'tbody tr', function(event) i funktionen initSongTable
		.draw( false )
		.node();

		if(selected_path == key && selected_galleryId == galleryId){
			$( newRow ).addClass( "selected" );
		}

	} ); // end DB.getVal
}

function initSongTable() {
	var dataSongTable,
		selectAllCheckbox = $( '<div class="checkbox preventSongLoad"><label><input type="checkbox" value=""><span class="cr"><i class="cr-icon fa-check"></i></span></label></div>' );

	selectAllCheckbox.click( function( event ) {
		var headerCheckbox = $( "#dataSongTable" ).find( "th" ).find( "input[type=checkbox]" ),
			allCheckboxes = $( "#dataSongTable" ).find( "td" ).find( "input[type=checkbox]" );
		allCheckboxes.prop( 'checked', headerCheckbox.is( ":checked" ) );

	} );

	$( "#dataSongTable" ).find( "thead" ).find( "tr" )
		.append( $('<th>').text( "dataInfo" ) )
//		.append( $('<th>').addClass("primaryColor").text( "Play" ) )
		.append( $('<th>').addClass("primaryColor").append( selectAllCheckbox ) )
		.append( $('<th>').addClass("primaryColor").text( "Type" ) )
		.append( $('<th>').addClass("primaryColor").text( "Duration" ) )
		.append( $('<th>').addClass("primaryColor").text( "Title Or File" ) )
		.append( $('<th>').addClass("primaryColor").text( "Title" ) )
		.append( $('<th>').addClass("primaryColor").text( "Artist" ) )
		.append( $('<th>').addClass("primaryColor").text( "Album" ) )
		.append( $('<th>').addClass("primaryColor").text( "Tempo" ) )
		.append( $('<th>').addClass("primaryColor").text( "Genre" ) )
		.append( $('<th>').addClass("primaryColor").text( "File path" ) )
		.append( $('<th>').addClass("primaryColor").text( "Modified" ) )
		.append( $('<th>').addClass("primaryColor").text( "Size" ) )
		.append( $('<th>').addClass("primaryColor").text( "Song info" ) )
		.append( $('<th>').addClass("primaryColor").text( "File type" ) );


	dataSongTable = $("#dataSongTable").DataTable({
		"language": {
			"emptyTable": "<h1 class=\"lead\">No files added!</h1>" +
			"<br />Try adding songs by clicking the <br / >" +
				"<label " +
					"title=\"Add songs, videos or pictures to Troff\"" +
					"class=\"cursor-pointer mr-2 regularButton fa-stack Small full-height-on-mobile\"" +
					"for=\"fileUploader\">" +
						"<i class=\"fa-music fa-stack-10x m-relative-7 font-size-relative-1\"></i>" +
						"<i class=\"fa-plus fa-stack-10x m-relative-4 font-size-relative-65\"></i>" +
				"</label>" +
				"-button at the top<br />of the song-dialog"
		},
		"fixedHeader": true,
		"paging": false,
		"createdRow": function( row, data, dataIndex ) {
			$(row).attr( "draggable", "true");
		},
		"columnDefs": [ {
			"targets": [ 0 ],
			"visible": false,
			//"searchable": false
		}, {
			"targets": 1,
			"data": null,
			"className": "preventSongLoad secondaryColor",
			"orderable": false,
			"defaultContent": '<div class="checkbox preventSongLoad"><label><input type="checkbox" value=""><span class="cr"><i class="cr-icon fa fa-check"></i></span></label></div>'
		}, {
			"targets": [ "_all" ],
			"className": "secondaryColor",
		} ]
	} )
	.on( 'dragstart', 'tr', function( event ) { //function dragSongToSonglist(event){
		if( event.dataTransfer === undefined ) {
			event.dataTransfer = event.originalEvent.dataTransfer;
		}
		var jsonDataInfo = JSON.stringify({
			name : dataSongTable.row( $(this) ).data()[4],
			data : JSON.parse( dataSongTable.row( $(this) ).data()[0] )
		});

		event.dataTransfer.setData("jsonDataInfo", jsonDataInfo);
	})
	.on( 'click', 'tbody tr', function ( event ) {

		let $td = $( event.target ).closest( "td, th" );
		if( $td.hasClass( "preventSongLoad" ) || $td.hasClass( "dataTables_empty" ) ) {
			return;
		}

		var dataInfo = JSON.parse(dataSongTable.row( $(this) ).data()[0]);

		$("#dataSongTable").DataTable().rows(".selected").nodes().to$().removeClass( "selected" );
		$(this).addClass("selected");

		createSongAudio( /*key:*/ dataInfo.fullPath );
	} );

	/*
	//något att titta på: ???????? slim sim :)  (för att ordna kolumnerna :) (fixa DB sparning, o interface...x ) )
	var table = $('#table').DataTable({ colReorder: true });
	$('button#newOrder').click(function() {
			table.colReorder.order([3,4,2,0,1], true);
	});
	*/

	//to make header primaryColor:
	$( "#dataSongTable thead th" ).removeClass( "secondaryColor" );

	// to move the searchbar away from the scrolling-area
	$( "#dataSongTable_filter" ).detach().prependTo( $( "#newSearchParent" ) );
	$( "#dataSongTable_filter" ).find( "input" )
		.attr("placeholder", "Search (Ctrl + F)" )
		.addClass("form-control-sm")
		.detach().prependTo( $( "#dataSongTable_filter" ) )
		.on( "click", Troff.enterSerachDataTableSongList )
		.on( "keyup", Troff.onSearchKeyup )
		.on( "blur", Troff.exitSerachDataTableSongList );

	//när man tar enter så rensas inte filtret (kanske en setting om den ska ränsas?)

	$( "#dataSongTable_filter" ).find( "label" ).remove();

	if( $( "#toggleSonglistsId" ).hasClass( "active" ) ) {
		$( "#buttAttachedSongListToggle" ).addClass( "active" );
	}


	// Options for the observer (which mutations to observe)
	const songListsObserverConfig = {
		attributes: true,
		childList: false,
		subtree: false
	};

	// Callback function to execute when mutations are observed
	var songListsObserverCallback = function(mutationsList, observer) {
		for (var mutation of mutationsList) {
			if( mutation.attributeName === "class" ) {
				var classList = mutation.target.className;
				if( $( mutation.target ).hasClass( "active" ) ) {
					$( "#buttAttachedSongListToggle" ).addClass( "active" );
				} else {
					$( "#buttAttachedSongListToggle" ).removeClass( "active" );
				}
				return;
			}
		}
	};

	// Create an observer instance linked to the callback function
	var songListsObserver = new MutationObserver(songListsObserverCallback);
	// Start observing the target node for configured mutations
	songListsObserver.observe( $( "#toggleSonglistsId" )[0], songListsObserverConfig);
}

function onChangeSongListSelector( event ) {

	var $target = $( event.target ),
		$selected = $target.find(":selected"),
		$checkedRows = $( "#dataSongTable" ).find( "td" ).find( "input[type=checkbox]:checked" ),
		songs = getSelectedSongs();

	var $songlist = $("#songListList").find( '[data-songlist-id="'+$selected.val()+'"]' );

	if( $selected.val() == "+" ) {
		createSongList_NEW( songs );
	} else if( $selected.val() == "--remove" ) {
		IO.confirm( "Remove songs?", "Remove songs: <br />" + songs.map( s => s.name ).join( "<br />") +
			"?<br /><br />Can not be undone.", () => {
			songs.forEach( song => {
				cacheImplementation.removeSong( song.data.fullPath );
			});
			$checkedRows.closest("tr").each( (i, row ) => {
				$('#dataSongTable').DataTable().row( row ).remove().draw();
			} );
		});
	} else if( $selected.parent().attr( "id" ) == "songListSelectorAddToSonglist" ) {
		addSongsToSonglist( songs, $songlist );
	} else if(  $selected.parent().attr( "id" ) == "songListSelectorRemoveFromSonglist" ){
		removeSongsFromSonglist( songs, $songlist );
	} else {
		console.error("something wrong");
	}

	$target.val( "-" );

}

function getSelectedSongs() {

	var $checkboxes = $( "#dataSongTable" ).find( "td" ).find( "input[type=checkbox]:checked" ),
		checkedVissibleSongs = $checkboxes.closest("tr").map( function(i, v) {
			return {
				name : $('#dataSongTable').DataTable().row( v ).data()[4],
				data : JSON.parse( $('#dataSongTable').DataTable().row( v ).data()[0] )
			};
		}),
		i,
		songs = [];

	for( i = 0; i < checkedVissibleSongs.length; i++ ){
		songs.push( checkedVissibleSongs[i] );
	}
	$checkboxes.prop("checked", false);
	return songs;

}

function clickButtNewSongList_NEW( event ) {
	var songs = getSelectedSongs();
	createSongList_NEW( songs );
}

function createSongList_NEW( songDataList ) {

	var songs = songDataList.map(x => x.data);

	$( "#newSonglistNrSongs" ).text( songs.length );
	$("#createSongListDialog").removeClass("hidden");

	var saveSongList = function( event ) {
		var clearCreateSongList = function(){
			IO.blurHack();
			$("#createSongListName").val("");
			$("#createSongListDialog").addClass("hidden");
			$('#createSongListSave').off( "click.saveSongList" );
			IO.clearEnterFunction();
		};

		if( $( "#createSongListName" ).val() === "" ) {
			clearCreateSongList();
			return;
		}

		var newSongList = {
			id : Troff.getUniqueSonglistId(),
			name : $( "#createSongListName" ).val(),
			songs : songs
		};

		Troff.addSonglistToHTML_NEW( newSongList );
		DB.saveSonglists_new();

		clearCreateSongList();
	}

	IO.setEnterFunction(function(event){
		saveSongList();
		return false;
	});
	$("#createSongListSave").on( "click.saveSongList", saveSongList );
	$( "#createSongListName" ).focus();

}

function onDragleave( ev ) {
	$( ev.target ).removeClass( "drop-active" );
}

function allowDrop( ev ) {
	if( $( ev.target ).hasClass( "songlist" ) ) {
		$( ev.target ).addClass( "drop-active" );
		ev.preventDefault();
	}
}

function dropSongOnSonglist( event ) {

	if( !$( event.target ).hasClass( "songlist" ) ) {
		return;
	}
	event.preventDefault();

	$(event.target).removeClass( "drop-active" );

	if( event.dataTransfer === undefined ) {
		event.dataTransfer = event.originalEvent.dataTransfer;
	}

	var dataInfo = JSON.parse( event.dataTransfer.getData("jsonDataInfo") ),
		$target = $(event.target);

	addSongsToSonglist( [dataInfo], $target );
}

function removeSongsFromSonglist( songs, $target ) {

	var	i,
		songDidNotExists,
		songList = $target.data("songList");



	$.each( songs, function(i, song) {
		var index,
			dataInfo = song.data,
			value;
		songDidNotExists = true;

		for( index = 0; index < songList.songs.length; index++ ) {
			value = songList.songs[index];
			if( value.galleryId == dataInfo.galleryId && value.fullPath == dataInfo.fullPath) {
				songDidNotExists = false;
				songList.songs.splice(index, 1);
			}
		}

		if( songDidNotExists ) {
			$.notify( song.name + " did not exist in " + songList.name, "info" );
			return;
		}

		$target.data("songList", songList);

		notifyUndo( song.name + " was removed from " + songList.name, function(){
			var undo_songList = $target.data("songList");

			undo_songList.songs.push( dataInfo );

			DB.saveSonglists_new();
		} );
	});
	DB.saveSonglists_new();
}

function addSongsToSonglist( songs, $target ) {
	var	songAlreadyExists,
		songList = $target.data("songList");


	$.each( songs, function(i, song) {
		var dataInfo = song.data;
		songAlreadyExists = songList.songs.filter(function(value, index, arr){
			return value.galleryId == dataInfo.galleryId &&
				value.fullPath == dataInfo.fullPath;
		} ).length > 0;

		if( songAlreadyExists ) {
			$.notify( song.name + " is already in " + songList.name, "info" );
			return;
		}


		songList.isDirectory = false;
		songList.songs.push( dataInfo );

		$target.data("songList", songList);

		notifyUndo( song.name + " was added to " + songList.name, function(){
			var i,
				undo_songList = $target.data("songList");

			undo_songList.songs = undo_songList.songs.filter(function(value, index, arr){
				return !(value.galleryId == dataInfo.galleryId &&
					value.fullPath == dataInfo.fullPath);
			});

			DB.saveSonglists_new();
		} );
	});
	DB.saveSonglists_new();
}

function clickAttachedSongListToggle( event ) {
	$("#toggleSonglistsId").trigger( "click" );
}

function reloadSongsButtonActive( event ) {
	if( event == null || !$(event.target).hasClass( "outerDialog" ) ) {
		return
	}
	if( $( "#outerSongListPopUpSquare" ).hasClass( "hidden" ) ) {
		closeSongDialog();
	} else {
		openSongDialog();
	}
}

function closeSongDialog ( event ) {
	$( "#outerSongListPopUpSquare" ).addClass( "hidden" );
	$( "#songPickerAttachedArea" ).addClass( "hidden" );
	$( "#buttSongsDialog" ).removeClass( "active" );
	DB.saveVal( TROFF_SETTING_SHOW_SONG_DIALOG, false );
};

function openSongDialog( event ) {
	if( $("#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG" ).hasClass( "active" ) ) {
		$( "#outerSongListPopUpSquare" ).removeClass( "hidden" );
	} else {
		$( "#songPickerAttachedArea" ).removeClass( "hidden" );
	}

	$( "#buttSongsDialog" ).addClass( "active" );

	DB.saveVal( TROFF_SETTING_SHOW_SONG_DIALOG, true );
}


function clickSongsDialog( event ) {
	if( $( event.target ).hasClass( "active" ) ) {
		closeSongDialog();
	} else {
		openSongDialog();
	}
}

function minimizeSongPicker(){
	$( "#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG" ).click();
}

function maximizeSongPicker(){
	$( "#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG" ).click();
}

function clickToggleFloatingSonglists( event ) {
	let shouldOpenSongDialog = $( "#buttSongsDialog" ).hasClass( "active" );
	closeSongDialog();
	if( $( "#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG" ).hasClass( "active" ) ) {
		moveSongPickerToFloatingState();
	} else {
		moveSongPickerToAttachedState();
	}
	if( shouldOpenSongDialog ) {
		openSongDialog();
	}
}

function moveSongPickerToAttachedState() {
	dataTableShowOnlyColumnsForAttachedState();
	$("#newSearchParent, #songPicker").detach().appendTo( $("#songPickerAttachedArea") );
	$( ".hideOnSongsDialogFloatingState" ).removeClass( "hidden" );
	$( ".hideOnSongsDialogAttachedState" ).addClass( "hidden" );
};

function moveSongPickerToFloatingState() {
	$("#newSearchParent, #songPicker").detach().insertBefore( "#songPickerFloatingBase" );
	dataTableShowColumnsForFloatingState();
	$( "#songPickerAttachedArea, .hideOnSongsDialogFloatingState" ).addClass( "hidden" );
	$( ".hideOnSongsDialogAttachedState" ).removeClass( "hidden" );
};

function dataTableColumnPicker( event ) {
	var $target = $(event.target);
	// Get the column API object
	var column = $('#dataSongTable').DataTable().column( $(this).data('column') );

	$target.toggleClass( "active" );

	var columnVisibilityArray = $("#columnToggleParent").children().map(function(i, v){
		return $(v).hasClass("active");
	}).get();

	DB.saveVal( TROFF_SETTING_SONG_COLUMN_TOGGLE, columnVisibilityArray );

	// Toggle the visibility
	column.visible( ! column.visible() );

}


function dataTableShowOnlyColumnsForAttachedState() {
	$( "#columnToggleParent" ).children().each( function( i, v ) {
		if( $(v).data( "show-on-attached-state" ) ) {
			$('#dataSongTable').DataTable().column( $(v).data( "column" ) ).visible( true );
		} else {
			$('#dataSongTable').DataTable().column( $(v).data( "column" ) ).visible( false );
		}
	} );
}

function dataTableShowColumnsForFloatingState() {
	$( "#columnToggleParent" ).children().each( function( i, v ) {
		if( $( v ).hasClass( "active" ) ) {
			$('#dataSongTable').DataTable().column( $(v).data( "column" ) ).visible( true );
		} else {
			$('#dataSongTable').DataTable().column( $(v).data( "column" ) ).visible( false );
		}
	} );
}


//******************************************************************************
//* End FS - File System ----------------------------------------------------- *
//******************************************************************************

var TroffClass = function(){
		var strCurrentSong = "";
		var iCurrentGalleryId = 0;
		var startTime = 0; // unused?
		var previousTime = 0; // unused?
		var time = 0; // unused?
		var nrTapps = 0;
		var m_zoomStartTime = 0;
		var m_zoomEndTime = null;

	/*Troff*/this.initFileApiImplementation = function() {

		$( "#fileUploader" ).on("change", event => {
			fileHandler.handleFiles(event.target.files, (key) =>{
				addItem_NEW_2( key );
				if( !$( "#dataSongTable_wrapper" ).find( "tr").hasClass( "selected" ) ) {
					Troff.selectSongInSongList( key );
					createSongAudio( key );
				}
			} );
		});

		//loadAllFiles:
		cacheImplementation.getAllKeys().then(keys => {
			keys.forEach(addItem_NEW_2);
		});

	};

	/*Troff*/ this.setUrlToSong = function( serverId, fileName ) {
		"use strict";
		if( serverId === undefined ) {
			if( !window.location.hash ) {
				return;
			}
			// remove url-hash completely:
			history.pushState("", document.title, window.location.pathname + window.location.search );
			return;
		}
		window.location.hash = Troff.createHash( serverId, fileName );
	};

	/*Troff*/ this.createHash = function( serverId, fileName ) {
		return "#" + serverId + "&" + encodeURI( fileName )
	}

	/*Troff*/ this.uploadSongToServer = async function( event ) {
		"use strict";

		// show a pop-up that says song is being uploaded, will let you know when it is done
		// alt 1, please do not close this app in the mean time
		// alt 2, please do not switch song in the mean time....

		const songKey = Troff.getCurrentSong();

		$( "#uploadSongToServerInProgressDialog" ).removeClass( "hidden" );
		try {
			let resp = await fileHandler.sendFile( songKey, nDB.get( songKey ) );

			nDB.setOnSong( songKey, "serverId", resp.id );

			if( songKey == Troff.getCurrentSong() ) {
				Troff.setUrlToSong( resp.id, resp.fileName );
			}

			$( "#uploadSongToServerInProgressDialog" ).addClass( "hidden" );
			$( "#shareSongUrl").val( window.location.origin + Troff.createHash( resp.id, resp.fileName ) );
			$( "#doneUploadingSongToServerDialog_songName" ).text( songKey );
			$( "#doneUploadingSongToServerDialog" ).removeClass( "hidden" );

		} catch ( error ) {
			return errorHandler.fileHandler_sendFile( error, songKey );
		}
	};

	/*Troff*/ this.buttCopyUrlToClipboard = function() {
		let url = $( "#doneUploadingSongToServerDialog" ).find( "#shareSongUrl").val();

		IO.copyTextToClipboard( url );

	};

	/*Troff*/ this.showUploadSongToServerDialog = function() {
		if( window.location.hash ) {
			$( "#shareSongUrl").val( window.location.href );
			$( ".showOnUploadComplete" ).addClass( "hidden" );
			$( ".showOnSongAlreadyUploaded" ).removeClass( "hidden" );

			$( "#doneUploadingSongToServerDialog_songName" ).text( Troff.getCurrentSong() );
			$( "#doneUploadingSongToServerDialog" ).removeClass( "hidden" );
		} else {
			$( ".showOnUploadComplete" ).removeClass( "hidden" );
			$( ".showOnSongAlreadyUploaded" ).addClass( "hidden" );
			$( "#uploadSongToServerDialog" ).removeClass( "hidden" );
		}
	}

	/*Troff*/ this.selectSongInSongList = function( fileName ) {
		let list = $("#dataSongTable").DataTable().rows().data()

		for( let i = 0; i < list.length; i++ ) {
			let data = JSON.parse(  list[i][0] );
			if( data.fullPath == fileName ) {
				$("#dataSongTable").DataTable().rows().nodes().to$().eq(i).addClass("selected");
				return;
			}
		}
	};

	/*Troff*/ this.importTroffDataToExistingSong_importNew = async function( event ) {
		const fileName = $( "#importTroffDataToExistingSong_fileName" ).val();
		const serverId = $( "#importTroffDataToExistingSong_serverId" ).val();

		Troff.showMarkersDownloadInProgressDialog( fileName );

		let troffData;
		try {
			troffData = await backendService.getTroffData( serverId, fileName );
		} catch( error ) {
			return errorHandler.backendService_getTroffData( error, serverId, fileName );
		}

		let markers = JSON.parse( troffData.markerJsonString );
		markers.serverId = serverId;
		try {
			let saveToDBResponse = nDB.set( troffData.fileName, markers );
			let doneSaveToDB = await saveToDBResponse;
		}  catch ( error ) {
			return errorHandler.fileHandler_fetchAndSaveResponse( error, fileName );
		}

		await createSongAudio( troffData.fileName );
		Troff.selectSongInSongList( fileName );

	};

	/*Troff*/ this.importTroffDataToExistingSong_merge = async function( event ) {
		const fileName = $( "#importTroffDataToExistingSong_fileName" ).val();
		const serverId = $( "#importTroffDataToExistingSong_serverId" ).val();

		Troff.showMarkersDownloadInProgressDialog( fileName );

		const markersFromCache = nDB.get( fileName );
		let markersFromServer;
		try {
			let troffDataFromServer = await backendService.getTroffData( serverId, fileName );
			markersFromServer = JSON.parse( troffDataFromServer.markerJsonString );
		} catch( error ) {
			return errorHandler.backendService_getTroffData( error, serverId, fileName );
		}

		await createSongAudio( fileName );
		Troff.selectSongInSongList( fileName );

		const aoStates = [];
		for( let i = 0; i < markersFromServer.aStates.length; i++ ) {
			const parsedState = JSON.parse ( markersFromServer.aStates[i] );
			aoStates.push( Troff.replaceMarkerIdWithMarkerTimeInState( parsedState, markersFromServer.markers ) );
		}

		let oImport = {};
		oImport.strSongInfo = markersFromServer.info;
		oImport.aoStates = aoStates;
		oImport.aoMarkers = markersFromServer.markers;

		setTimeout( function() {
			Troff.doImportStuff( oImport );
		}, 42 );

	};

	/*Troff*/ this.importTroffDataToExistingSong_keepExisting = async function( event ) {
		const fileName = $( "#importTroffDataToExistingSong_fileName" ).val();
		const serverId = $( "#importTroffDataToExistingSong_serverId" ).val();

		await createSongAudio( fileName );
		Troff.selectSongInSongList( fileName );
	};

	/*Troff*/ this.showImportData = function( fileName, serverId ) {
		"use strict";
		$( "#importTroffDataToExistingSong_songName" ).text( fileName );
		$( "#importTroffDataToExistingSong_fileName" ).val( fileName );
		$( "#importTroffDataToExistingSong_serverId" ).val( serverId );
		$( "#downloadSongFromServerInProgressDialog" ).addClass("hidden");
		$( "#importTroffDataToExistingSongDialog" ).removeClass("hidden");
	};

	/*Troff*/ this.showMarkersDownloadInProgressDialog = function( songName ) {
		$( ".downloadSongFromServerInProgressDialog_songName" ).text( songName );
		$( "#downloadSongFromServerInProgressDialog" ).removeClass( "hidden" );
		$( ".downloadSongFromServerInProgressDialog_song" ).addClass( "hidden" );
		$( ".downloadSongFromServerInProgressDialog_markers" ).removeClass( "hidden" );
	};

	/*Troff*/ this.showDownloadSongFromServerInProgress = function( songName ) {
		"use strict";
		$( ".downloadSongFromServerInProgressDialog_songName" ).text( songName );
		$( "#downloadSongFromServerInProgressDialog" ).removeClass("hidden");
		$( ".downloadSongFromServerInProgressDialog_song" ).removeClass( "hidden" );
		$( ".downloadSongFromServerInProgressDialog_markers" ).addClass( "hidden" );
	}

	/*Troff*/ this.downloadSongFromServerButDataFromCacheExists = async function(fileName, serverId, troffDataFromCache ) {
		"use strict";

		let fileDoesExists = await fileHandler.doesFileExistInCache( fileName );

		if( fileDoesExists ) {
			if( serverId == troffDataFromCache.serverId ) {
				await createSongAudio( fileName );
				Troff.selectSongInSongList( fileName );
			} else {
				Troff.showImportData( fileName, serverId );
			}
			return;
		}

		Troff.showDownloadSongFromServerInProgress( fileName );

		let troffData;
		try {
			troffData = await backendService.getTroffData( serverId, fileName );
		} catch( error ) {
			return errorHandler.backendService_getTroffData( error, serverId, fileName );
		}

		try {
			await fileHandler.fetchAndSaveResponse( troffData.fileId, fileName );
		} catch ( error ) {
			return errorHandler.fileHandler_fetchAndSaveResponse( error, fileName );
		}

		if( serverId == troffDataFromCache.serverId ) {
			await createSongAudio( fileName );
			addItem_NEW_2( fileName );
		} else {
			Troff.showImportData( fileName, serverId );
		}

	};

	/*Troff*/ this.downloadSongFromServer = async function( hash ) {
		"use strict";
		const [serverId, fileNameURI] = hash.substr(1).split( "&" );
		const fileName = decodeURI( fileNameURI );
		const troffDataFromCache = nDB.get( fileName );
		let troffData;

		if( troffDataFromCache != null ) {
			return Troff.downloadSongFromServerButDataFromCacheExists(fileName, serverId, troffDataFromCache);
		}
		Troff.showDownloadSongFromServerInProgress( fileName );

		try {
			troffData = await backendService.getTroffData( serverId, fileName );
		} catch( error ) {
			return errorHandler.backendService_getTroffData( error, serverId, fileName );
		}

		let markers = JSON.parse( troffData.markerJsonString );
		markers.serverId = serverId;

		try {
			await Promise.all([
				fileHandler.fetchAndSaveResponse( troffData.fileId, troffData.fileName ),
				nDB.set( troffData.fileName, markers )]
			);
		} catch ( error ) {
			return errorHandler.fileHandler_fetchAndSaveResponse( error, fileName );
		}

		await createSongAudio( troffData.fileName );
		addItem_NEW_2( troffData.fileName );
	};

	this.recallFloatingDialog = function() {
		DB.getVal( "TROFF_SETTING_SONG_LIST_FLOATING_DIALOG", function( floatingDialog ){
			if( floatingDialog ) {
				moveSongPickerToFloatingState();
			} else {
				moveSongPickerToAttachedState();
			}
		});
	}

	this.recallSongColumnToggle = function( callback ) {
		DB.getVal( TROFF_SETTING_SONG_COLUMN_TOGGLE, function( columnToggle ){
			if( columnToggle === undefined ) {
				setTimeout(function() {
					Troff.recallSongColumnToggle( callback );
				}, 42);
				return;
			}
			$( "#columnToggleParent" ).children().each( function( i, v ) {
				if( columnToggle[i] ) {
					$(v).addClass( "active" );
				} else {
					var column = $('#dataSongTable').DataTable().column( $(v).data('column') );
					column.visible( false );
				}
			} );
			callback();
		} );
	}

	this.toggleExtendedMarkerColor = function( event ) {
		if( $( "#markerList").hasClass( "extended-color" ) ) {
			$( "#markerList").removeClass( "extended-color" );
			$( "#toggleExtendedMarkerColor").removeClass( "active" );
			DB.saveVal( TROFF_SETTING_EXTENDED_MARKER_COLOR, false );
		} else {
			$( "#markerList").addClass( "extended-color" );
			$( "#toggleExtendedMarkerColor").addClass( "active" );
			DB.saveVal( TROFF_SETTING_EXTENDED_MARKER_COLOR, true );
		}
	};

	this.recallExtendedMarkerColor = function() {
		DB.getVal( TROFF_SETTING_EXTENDED_MARKER_COLOR, function( extend ) {
			if( extend ) {
				$( "#markerList").addClass( "extended-color" );
				$( "#toggleExtendedMarkerColor").addClass( "active" );
			}
		} );
	};

	this.toggleExtraExtendedMarkerColor = function( event ) {
		if( $( "#markerList").hasClass( "extra-extended" ) ) {
			$( "#markerList").removeClass( "extra-extended" );
			$( "#toggleExtraExtendedMarkerColor").removeClass( "active" );
			DB.saveVal( TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, false );
		} else {
			$( "#markerList").addClass( "extra-extended" );
			$( "#toggleExtraExtendedMarkerColor").addClass( "active" );
			DB.saveVal( TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, true );
		}
	};

	this.recallExtraExtendedMarkerColor = function() {
		DB.getVal( TROFF_SETTING_EXTRA_EXTENDED_MARKER_COLOR, function( extend ) {
			if( extend || extend === null ) {
				$( "#markerList").addClass( "extra-extended" );
				$( "#toggleExtraExtendedMarkerColor").addClass( "active" );
			}
		} );
	};


	this.setTheme = function( event ) {
		var $target = $( event.target ),
			theme = $target.data( "theme" );
		$target.closest("#themePickerParent").find( ".selected" ).removeClass( "selected" );
		$target.addClass( "selected" );
		Troff.updateHrefForTheme(theme);

		DB.saveVal( TROFF_SETTING_SET_THEME, theme);

	};

	/*Troff*/this.updateHrefForTheme = function( theme ) {
		"use strict";
		const href = $("#colorScheme").attr("href"),
			startIndex = href.indexOf("col"),
			endIndex = href.indexOf(".css"),
			firstPart = href.substr(0, startIndex),
			lastPart = href.substr(endIndex),
			finalHref = firstPart + theme + lastPart;
		if( finalHref != href ) {
			$("#colorScheme").attr("href", finalHref);
		}
	};

	this.recallGlobalSettings = function(){
		Troff.recallTheme();
		Troff.recallExtendedMarkerColor();
		Troff.recallExtraExtendedMarkerColor();
		Troff.recallSongColumnToggle( function(){
			Troff.recallFloatingDialog();
		});
	};


	this.recallTheme = function() {
		DB.getVal( TROFF_SETTING_SET_THEME, function( theme ) {
			theme = theme || "col1";
			$( "#themePickerParent" )
				.find( "[data-theme=\"" + theme + "\"]" )
				.addClass( "selected" );
			Troff.updateHrefForTheme(theme);
		} );
	};

	this.closeSettingsDialog = function( event ) {
		$( "#outerSettingPopUpSquare" ).addClass( "hidden" );
	};
	this.openSettingsDialog = function( event ) {
		$( "#outerSettingPopUpSquare" ).removeClass( "hidden" );
	};

	//Public variables:
	this.dontShowZoomInstructions = false;

	this.firstTimeUser = function(){
		$('#firstTimeUserDialog').removeClass( "hidden" );
	};

	// this is regarding the "play in fullscreen" - button
	this.setPlayInFullscreen = function(bPlayInFullscreen){
		if(bPlayInFullscreen){
			$("#playInFullscreenButt").addClass("active");
		} else {
			$("#playInFullscreenButt").removeClass("active");
		}
	};

	this.setMirrorImage = function(bMirrorImage){
		if(bMirrorImage){
			$("#mirrorImageButt").addClass("active");
			$("#videoBox").addClass( "flip-horizontal" );
		} else {
			$("#mirrorImageButt").removeClass("active");
			$("#videoBox").removeClass( "flip-horizontal" );
		}
	};

	// this is regarding the "play in fullscreen" - button
	this.playInFullscreenChanged = function(){
		var butt = document.querySelector('#playInFullscreenButt');
		butt.classList.toggle("active");

		var bFullScreen = butt.classList.contains('active');
		DB.setCurrent(strCurrentSong, 'bPlayInFullscreen', bFullScreen );

		IO.blurHack();
	};

	this.mirrorImageChanged = function( event ) {
		var bMirrorImage = !$(event.target).hasClass( "active" );
		DB.setCurrent(strCurrentSong, 'bMirrorImage', bMirrorImage );
		Troff.setMirrorImage( bMirrorImage );

		IO.blurHack();
	}

	this.setImageLayout = function(){
		$( "body" ).addClass( "pictureActive" );
	};
	this.setAudioVideoLayout = function(){
		$( "body" ).removeClass( "pictureActive" );
	};


	// this is regarding the f-key, IE- the actual fullscreen
	this.forceFullscreenChange = function(){
		var videoBox = document.querySelector('#videoBox');
		if(!videoBox) return;
//		var infoSection = document.querySelector('#infoSection');
		if(videoBox.classList.contains('fullscreen')){
			videoBox.classList.remove('fullscreen');
		} else {
			videoBox.classList.add('fullscreen');
		}
	};

	// this is regarding the f/esc-key, IE- the actual fullscreen
	this.forceNoFullscreen = function(){
		var videoBox = document.querySelector('#videoBox');
		if(!videoBox) return;
		videoBox.classList.remove('fullscreen');
	};

	/* this funciton is called when the full song/video is loaded,
	 * it should thus do the things that conect player to Troff...
	 */
	this.setMetadata = function(media){
		var songLength = media.duration;
		document.getElementById('timeBar').max = media.duration;
		$('#maxTime')[0].innerHTML = Troff.secToDisp(media.duration);

		DB.getSongMetaDataOf(Troff.getCurrentSong());
		media.addEventListener("timeupdate", Troff.timeupdateAudio );
	};

	this.setMetadataImage = function( media ) {
		DB.getImageMetaDataOf(Troff.getCurrentSong());
	}

	this.getStandardMarkerInfo = function(){
		return "This text is specific for every selected marker. " +
			"Notes written here will be automatically saved." +
			"\n\nUse this area for things regarding this marker.";
	};

	this.setWaitBetweenLoops = function(bActive, iWait){
		$('#waitBetweenLoops').val(iWait);
		if(bActive){
			$('#buttWaitBetweenLoops').addClass('active');
			$('#waitBetweenLoops').removeClass('grayOut');
		} else {
			$('#buttWaitBetweenLoops').removeClass('active');
			$('#waitBetweenLoops').addClass('grayOut');
		}
	};

	this.getWaitBetweenLoops = function(){
		if($('#waitBetweenLoops').hasClass('grayOut'))
			return 0;
		return $('#waitBetweenLoops').val();
	};

	this.getNewMarkerId = function(){
		return Troff.getNewMarkerIds(1)[0];
	};

	this.getNewMarkerIds = function(iNrOfIds){
		var a = [];
		var aRet = [];
		var nr = 0;
		for(var i=0; i<iNrOfIds; i++){
			while($('#markerNr'+nr).length > 0 || a.indexOf(nr) != -1){
				nr++;
			}
			a[i] = nr;
			aRet[i] = "markerNr" + nr;
		}
		return aRet;
	};

	this.updateStartBefore = function() {
		var goToMarker = $("#" + TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER ).hasClass( "active" );
		if( $('audio, video')[0].paused && goToMarker )
			Troff.goToStartMarker();
		Troff.setAppropriateActivePlayRegion();
	};

	this.speedUpdate = function() {
		var sliderVal = document.getElementById("speedBar").value;
		$('#speed, #speedDemo').html(sliderVal);
		$('audio, video')[0].playbackRate = sliderVal/100;
	};

	/*Troff*/this.setSpeed = function( speed ) {
		$('#speedBar').val( speed )
		$('#speedBar')[0].dispatchEvent(new Event('input'));
	};

	this.volumeUpdate = function() {
		var sliderVal = document.getElementById("volumeBar").value;
		$('#volume').html(sliderVal);
		$('audio, video')[0].volume = sliderVal/100;
	};

	this.setVolume = function( volume ) {
		$('#volumeBar').val( volume );
		$('#volumeBar')[0].dispatchEvent(new Event('input'));
	};

	/* This is used when the value of the slider is changed,
	 * to update the audio / video
	 */
	this.timeUpdate = function() {
		var sliderVal = document.getElementById("timeBar").value;
		$('#time').html(Troff.secToDisp(sliderVal));

		if( sliderVal > Troff.getStopTime() ){
			var aFirstAndLast = Troff.getFirstAndLastMarkers();
			var firstMarkerId = aFirstAndLast[0];
			var lastMarkerId = aFirstAndLast[1] + 'S';

			if(sliderVal < $('#' + lastMarkerId)[0].timeValue )
				Troff.selectStopMarker(lastMarkerId);
			else {
				IO.confirm('Out of range', 'You pressed outside the playing region, ' +
					'do you want to add a marker to the end of the song?', function(){
					var songLength = Number(document.getElementById('timeBar').max);

					var oMarker = {};
					oMarker.name = "End";
					oMarker.time = songLength;
					oMarker.info = "";
					oMarker.id = Troff.getNewMarkerId();

					aMarkers = [oMarker];
					Troff.addMarkers(aMarkers); // adds marker to html
					DB.saveMarkers(Troff.getCurrentSong() ); // saves end marker to DB

					var aFirstAndLast = Troff.getFirstAndLastMarkers();
					var firstMarkerId = aFirstAndLast[0];
					var lastMarkerId = aFirstAndLast[1] + 'S';
					Troff.selectStopMarker(lastMarkerId);
					document.querySelector('audio, video').currentTime = sliderVal;
				});
			}
		}// end if

		document.querySelector('audio, video').currentTime = sliderVal;
	}; // end timeUpdate

	this.getStopTime = function() {
		var extraTime = 0;

		if( $('audio, video').length === 0 ) {
			return 0;
		}

				if( $('#buttStopAfter').hasClass('active') )
				extraTime = $('#stopAfter').val() ? $('#stopAfter').val() : 0;
		if($('.currentStopMarker')[0])
				return Math.min(parseFloat($('.currentStopMarker')[0].timeValue)+
								parseFloat(extraTime), $('audio, video')[0].duration);
		else
				return $('audio, video')[0].duration;
	};

	this.getStartTime = function() {
		if($('.currentMarker')[0]){ //if there is a start marker
				var extraTime = 0;
				if( $('#buttStartBefore').hasClass('active') )
				extraTime = $('#startBefore').val() ? $('#startBefore').val() : 0;
				return Math.max(parseFloat($('.currentMarker')[0].timeValue)-
								parseFloat(extraTime), 0);
		}
		return 0;
	};

	/*Troff*/this.setLoopTo = function(number){
		if( number === undefined ) {
			number =
					$("#TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_INFINIT_IS_ON").hasClass( "active" ) ?
					"Inf" :
					$("#TROFF_SETTING_SONG_DEFAULT_NR_LOOPS_VALUE").val();
		}

		if(number===0) number = "Inf";

		$('.currentLoop').removeClass('currentLoop');
		if(number){
				$('#buttLoop'+number).addClass('currentLoop');
		} else {
				$(this).addClass('currentLoop');
		}
		Troff.updateLoopTimes();
	};

	this.setLoop = function(mode){
		$('.currentLoop').removeClass('currentLoop');
		$(this).addClass('currentLoop');

		Troff.updateLoopTimes();
		IO.blurHack();
	};

	this.updateLoopTimes = function(){
		var dbLoop = '';
		if($('#buttLoopInf').hasClass('currentLoop') )
				dbLoop = 'Inf';
		else
				dbLoop = $('.currentLoop').val();

		if(strCurrentSong)
			DB.setCurrent(strCurrentSong, 'loopTimes', dbLoop );

		IO.loopTimesLeft( $(".currentLoop").val() );
	}; // end updateLoopTimes


	this.getMood = function(){
		if( $('#infoSection').hasClass('pause') )
				return 'pause';
		if( $('#infoSection').hasClass('wait') )
				return 'wait';
		if( $('#infoSection').hasClass('play') )
				return 'play';
		console.error('infoSection hase not correct class!');
	};

	/* this is used every time the time changes in the audio / video */
	/*Troff*/this.timeupdateAudio = function() {
		var audio = document.querySelector('audio, video');
		var dTime = audio.currentTime;

		if(dTime >= Troff.getStopTime()){
				Troff.atEndOfLoop();
		}

		$('#time').html(Troff.secToDisp(dTime));
		document.getElementById("timeBar").value = dTime;
	}; // end timeupdateAudio

	/*Troff*/this.atEndOfLoop = function(){
		var audio = document.querySelector('audio, video');
		Troff.goToStartMarker();
		var dTime = audio.currentTime;
		audio.pause();

		if( Troff.isLoopInfinite() ) {
			Troff.doIncrementSpeed();
			Troff.playSong( Troff.getWaitBetweenLoops() * 1000 );
		} else {
			if ( IO.loopTimesLeft()>1 ){
				IO.loopTimesLeft( -1 );
				Troff.doIncrementSpeed();
				Troff.playSong( Troff.getWaitBetweenLoops() * 1000 );
			} else {
				IO.loopTimesLeft( $('#loopTimes').val() );
				Troff.pauseSong();
			}
		} // end else

	}; // end atEndOfLoop


//	this.isLoopOn = function(){
//		return !$('#buttLoopOff').hasClass('currentLoop');
//	};

	this.isLoopInfinite = function(){
		return $('#buttLoopInf').hasClass('currentLoop');
	};

	/*Troff*/this.doIncrementSpeed = function(){
		if( !$( "#buttIncrementUntil" ).hasClass( "active" ) ) {
			return;
		}

		var loopTimesLeft,
			speedDiffLeft,
			incrementSpeedBy,
			incrementUntill = parseInt( $( "#incrementUntilValue" ).val() ),
			currentSpeed = $('audio, video')[0].playbackRate * 100;


		speedDiffLeft = incrementUntill - currentSpeed;

		if( Troff.isLoopInfinite() ) {
			if( speedDiffLeft == 0 ) {
				incrementSpeedBy = 0
			} else {
				incrementSpeedBy = speedDiffLeft > 0 ? 1 : -1;
			}

			$('#speedBar').val( currentSpeed + incrementSpeedBy );

		} else {
			loopTimesLeft = parseInt( IO.loopTimesLeft() );
			incrementSpeedBy = speedDiffLeft / loopTimesLeft;

			$('#speedBar').val( currentSpeed + incrementSpeedBy );
		}

		Troff.speedUpdate();
	}

	// goToStartMarker används när man updaterar startBefore / trycker på StartBefore  / trycker på en marker???
	/*Troff*/this.goToStartMarker = function(){
		document.querySelector('audio, video').currentTime = Troff.getStartTime();
	}; // end goToStartMarker

	this.enterKnappen = function(){
		var goToMarker = $("#" + TROFF_SETTING_ENTER_GO_TO_MARKER_BEHAVIOUR ).hasClass( "active" ),
			updateLoopTimes = $("#" + TROFF_SETTING_ENTER_RESET_COUNTER ).hasClass( "active" ),
			useTimer = $("#" + TROFF_SETTING_ENTER_USE_TIMER_BEHAVIOUR ).hasClass( "active" );
		Troff.spaceOrEnter( goToMarker, useTimer, updateLoopTimes );
	};// end enterKnappen

	this.space = function(){
		var goToMarker = $("#" + TROFF_SETTING_SPACE_GO_TO_MARKER_BEHAVIOUR ).hasClass( "active" ),
			updateLoopTimes = $("#" + TROFF_SETTING_SPACE_RESET_COUNTER ).hasClass( "active" ),
			useTimer = $("#" + TROFF_SETTING_SPACE_USE_TIMER_BEHAVIOUR ).hasClass( "active" );
		Troff.spaceOrEnter( goToMarker, useTimer, updateLoopTimes );
	}; // end space()

	this.playUiButton = function() {
		var goToMarker = $("#" + TROFF_SETTING_PLAY_UI_BUTTON_GO_TO_MARKER_BEHAVIOUR ).hasClass( "active" ),
			updateLoopTimes = $("#" + TROFF_SETTING_PLAY_UI_BUTTON_RESET_COUNTER ).hasClass( "active" ),
			useTimer = $("#" + TROFF_SETTING_PLAY_UI_BUTTON_USE_TIMER_BEHAVIOUR ).hasClass( "active" );
		Troff.spaceOrEnter( goToMarker, useTimer, updateLoopTimes );
	}

	this.spaceOrEnter = function( goToMarker, useTimer, updateLoopTimes ) {
		var audio = document.querySelector("audio, video");
		if(!audio){
				console.error("no song loaded");
				return;
		}

		if( goToMarker ) {
			Troff.goToStartMarker();
		}
		if( Troff.getMood() == 'pause' ) {
				if( useTimer && $('#buttPauseBefStart').hasClass('active') ) {
					Troff.playSong( $('#pauseBeforeStart').val() * 1000 );
				} else {
					Troff.playSong();
				}
		} else {
				Troff.pauseSong(updateLoopTimes);
		}
		IO.blurHack();
	}; // end spaceOrEnter()

	/*Troff*/this.playSong = function(wait){
		wait = wait || 0;
		var audio = document.querySelector('audio, video');
		if (!audio) return;

		var secondsLeft = wait/1000;
		$('.secondsLeft').html(secondsLeft);

		if(Troff.stopTimeout) clearInterval(Troff.stopTimeout);
		Troff.setMood('wait');
		Troff.stopTimeout = setTimeout(function(){
				if(Troff.getMood() == 'pause' ) return;
				audio.play();
				Troff.setMood('play');
		}, wait);

		// stopInterval is the counter
		if(Troff.stopInterval) clearInterval(Troff.stopInterval);
		Troff.stopInterval = setInterval(function() {
				if(Troff.getMood() == 'wait' ){ //audio.isPaused) {
				secondsLeft -= 1;
				if(secondsLeft <= 0 ){
						$('.secondsLeft').html(0);
						clearInterval(Troff.stopInterval);
				} else {
						$('.secondsLeft').html(secondsLeft);
				}
				}  else {
				clearInterval(Troff.stopInterval);
				$('.secondsLeft').html( 0 );
				}
		}, 1000);
	}; // end playSong

	/*Troff*/this.pauseSong = function( updateLoopTimes ){
		updateLoopTimes = updateLoopTimes!==undefined?updateLoopTimes:true;
		var audio = document.querySelector('audio, video');
		if (audio)
				audio.pause();
		Troff.setMood('pause');
		if( updateLoopTimes ) {
			Troff.updateLoopTimes();
		}

		if(Troff.stopTimeout)  clearInterval(Troff.stopTimeout);
		if(Troff.stopInterval) clearInterval(Troff.stopInterval);

	};

	this.updateSecondsLeft = function(){
		if(Troff.getMood() == 'pause'){
				if ($('#buttPauseBefStart').hasClass('active'))
				$('.secondsLeft').html( $('#pauseBeforeStart').val() );
				else
				$('.secondsLeft').html( 0 );
		}
	};

	this.setMood = function( mood ){
		if(mood == 'pause'){
			$('#infoSection, .moodColorizedText').removeClass('play wait').addClass('pause');
			Troff.updateSecondsLeft();
			if(document.querySelector('#playInFullscreenButt.active')){
				document.querySelector('#videoBox').classList.remove('fullscreen');
				document.querySelector('#infoSection').classList.remove('overFilm');
			}
			$('#buttPlayUiButtonPlay').removeClass("hidden");
			$('#buttPlayUiButtonPause').addClass("hidden");
		}
		if(mood == 'wait'){
			$('#infoSection, .moodColorizedText').removeClass('play pause').addClass('wait');
			if(document.querySelector('#playInFullscreenButt.active')){
				document.querySelector('#videoBox').classList.add('fullscreen');
				document.querySelector('#infoSection').classList.add('overFilm');
			}
			$('#buttPlayUiButtonPlay').addClass("hidden");
			$('#buttPlayUiButtonPause').removeClass("hidden");
		}
		if(mood == 'play'){
			$('#infoSection, .moodColorizedText').removeClass('wait pause').addClass('play');
			if(document.querySelector('#playInFullscreenButt.active')){
				document.querySelector('#videoBox').classList.add('fullscreen');
				document.querySelector('#infoSection').classList.remove('overFilm');
			}
			$('#buttPlayUiButtonPause').removeClass("hidden");
			$('#buttPlayUiButtonPlay').addClass("hidden");
		}
	};
	// Troff. ...
	/*Troff*/this.setCurrentSongStrings = function( currentSong, currentGalleryId ) {
		strCurrentSong = currentSong;
		iCurrentGalleryId = currentGalleryId;
	}
	/*Troff*/this.getCurrentSong = function() {
		return strCurrentSong;
	};
	this.getCurrentGalleryId = function() {
		return iCurrentGalleryId;
	};

	this.setWaitForLoad = function(path, iGalleryId){
		if(strCurrentSong){
				Troff.pauseSong();
				Troff.clearAllMarkers();
				Troff.clearAllStates();
		}
		Troff.setAreas([false, false, false, false]);
		strCurrentSong = path;
		iCurrentGalleryId = iGalleryId;

		$('#currentArtist').text("Wait for song to load");
		$('#currentSong, #currentAlbum').hide();
	};

	this.setCurrentSongInDB = function(){ //slim sim here
		DB.setCurrentSong(strCurrentSong, iCurrentGalleryId);
	}; // end SetCurrentSong

	this.pathToName = function(filepath){
		let lastIndex = filepath.lastIndexOf( '.' );
		if( lastIndex == -1 ) {
			return filepath;
		}
		return filepath.substr( 0, lastIndex );
	};

	this.getCurrentStates = function(){
		return $('#stateList').children();
	};

	/*Troff*/this.getCurrentMarkers = function(bGetStopMarkers){
		if(bGetStopMarkers){
			return $('#markerList li input:nth-child(4)');
		}
		return $('#markerList li input:nth-child(3)');
	};

	/*
		exportStuff, gets current song markers to the clippboard
	*/
	/*Troff*/this.exportStuff = function(){
		Troff.toggleImportExport();
		DB.getMarkers( strCurrentSong, function(aoMarkers){
			var oExport = {};
			oExport.aoMarkers = [];
			for (var i=0; i<aoMarkers.length; i++){
				var oTmp = {};
				oTmp.name = aoMarkers[i].name;
				oTmp.time = aoMarkers[i].time;
				oTmp.info = aoMarkers[i].info;
				oTmp.color = aoMarkers[i].color;
				oExport.aoMarkers[i] = oTmp;
			}
			var aState = $('#stateList').children();
			oExport.aoStates = [];
			for(i=0; i<aState.length; i++){
				var oState = JSON.parse(aState.eq(i).attr('strstate'));
				oExport.aoStates[i] = Troff.replaceMarkerIdWithMarkerTimeInState( oState, aoMarkers );
			}
			oExport.strSongInfo = $('#songInfoArea').val();
			var sExport = JSON.stringify(oExport);

			IO.prompt("Copy the marked text to export your markers", sExport);
		});
	}; // end exportStuff

	/*
		importStuff, prompts for a string with markers
	*/
	/*Troff*/this.importStuff = function(){
		Troff.toggleImportExport();
		IO.prompt("Please paste the text you received to import the markers",
							"Paste text here",
							function(sImport){
			var oImport = JSON.parse(sImport);
			if( oImport.strSongInfo !== undefined &&
					oImport.aoStates !== undefined &&
					oImport.aoMarkers !== undefined ){
				Troff.doImportStuff( oImport );

			} else {
				//This else is here to allow for imports of 0.5 and earlier
				var aMarkersTmp = oImport;
				Troff.importMarker(aMarkersTmp);
			}

		});
	};

	/*Troff*/ this.replaceMarkerIdWithMarkerTimeInState = function( oState, aoMarkers ) {
		for( let i = 0; i < aoMarkers.length; i++) {
			if( oState.currentMarker == aoMarkers[i].id ){
				oState.currentMarkerTime = aoMarkers[i].time;
			}
			if( oState.currentStopMarker == aoMarkers[i].id + "S" ){
				oState.currentStopMarkerTime = aoMarkers[i].time;
			}
			if( oState.currentMarkerTime !== undefined && oState.currentStopMarkerTime !== undefined ) {
				break;
			}
		}
		delete oState.currentMarker;
		delete oState.currentStopMarker;
		return oState;
	};

	/*Troff*/ this.importMarker = function(aMarkers){
		var aMarkerId = Troff.getNewMarkerIds(aMarkers.length);

		for(var i=0; i<aMarkers.length; i++){
			// these 5 lines are here to allow for import of markers
			//from version 0.3.0 and earlier:
			var tmpName = Object.keys(aMarkers[i])[0];
			aMarkers[i].name = aMarkers[i].name || tmpName;
			aMarkers[i].time = aMarkers[i].time || Number(aMarkers[i][tmpName]) || 0;
			aMarkers[i].info = aMarkers[i].info || "";
			aMarkers[i].color = aMarkers[i].color || "None";
			//:allow for version 0.3.0 end here

			aMarkers[i].id = aMarkerId[i];
		}
		Troff.addMarkers(aMarkers); // adds marker to html
	}

	/*Troff*/ this.doImportStuff = function( oImport ) {

		Troff.importMarker(oImport.aoMarkers);
		importSonginfo(oImport.strSongInfo);
		importStates(oImport.aoStates);

		DB.saveMarkers( Troff.getCurrentSong(), function() {
			DB.saveStates( Troff.getCurrentSong(), function() {
				Troff.updateSongInfo();
			} );
		} );

		function importSonginfo(strSongInfo){
			$('#songInfoArea').val($('#songInfoArea').val() + strSongInfo);
		}

		function importStates(aoStates) {
			for(var i = 0; i < aoStates.length; i++){
				var strTimeStart = aoStates[i].currentMarkerTime;
				var strTimeStop = aoStates[i].currentStopMarkerTime;
				delete aoStates[i].currentMarkerTime;
				delete aoStates[i].currentStopMarkerTime;
				aoStates[i].currentMarker = getMarkerFromTime(strTimeStart);
				aoStates[i].currentStopMarker = getMarkerFromTime(strTimeStop) + 'S';
			}

			function getMarkerFromTime(strTime){
				var aCurrMarkers = $('#markerList').children();
				for(var i=0; i<aCurrMarkers.length; i++){
					var currMarker = aCurrMarkers.eq(i).children().eq(2);
					if(currMarker[0].timeValue == strTime){
						return currMarker.attr('id');
					}
				}

				console.error("Could not find a marker at the time " + strTime + "; returning the first marker");
				return aCurrMarkers.eq(0).children().eq(2).attr('id');

			}

			aoStates.map(function(s){
				Troff.addButtonsOfStates([JSON.stringify(s)]);
			});
//        DB.saveStates(Troff.getCurrentSong()); -- xxx
		}
	};

	/*
		createMarker, all, figure out the time and name,
		will then call the add- and save- Marker
	 */
	/*Troff*/this.createMarker = function(){
		var time = document.querySelector('audio, video').currentTime;
		var songSRC = $('audio, video').attr('src');
		var iMarkers =  $('#markerList li').length + 1;

		var quickTimeout = setTimeout(function(){

			var oFI = {};
			oFI.strHead = "Please enter the marker name here";
			var iMarkers =  $('#markerList li').length + 1;
			oFI.strInput = "marker nr " + iMarkers;
			oFI.bDouble = true;
			oFI.strTextarea = "";
			oFI.strTextareaPlaceholder = "Add extra info about the marker here.";

			IO.promptEditMarker(0, function(newMarkerName, newMarkerInfo, newMarkerColor, newTime){
				if(newMarkerName === "") return;

				var oMarker = {};
				oMarker.name = newMarkerName;
				oMarker.time = newTime;
				oMarker.info = newMarkerInfo || "";
				oMarker.color = newMarkerColor;
				oMarker.id = Troff.getNewMarkerId();

				var markers = [oMarker];
				Troff.addMarkers(markers); // adds marker to html
				DB.saveMarkers(Troff.getCurrentSong() );
			});
			clearInterval(quickTimeout);
		}, 0);
	}; // end createMarker   ********/

	/*Troff*/this.toggleImportExport = function(){
		$( '#outerImportExportPopUpSquare').toggleClass( "hidden" );
		IO.blurHack();
	};


	/*Troff*/this.toggleArea = function(event) {
		IO.blurHack();

		var sectionToHide = $( event.target ).attr( "section-to-hide" );

		if( sectionToHide ) {
			event.target.classList.toggle('active');
			$( sectionToHide ).toggleClass( "hidden" );
			DB.setCurrentAreas(Troff.getCurrentSong());
		}
	};

	this.setAreas = function(abAreas) {
		$('#statesTab').toggleClass("active", abAreas[0]);
		$('#stateSection').toggleClass("hidden", !abAreas[0]);
		$('#settingsTab').toggleClass("active", abAreas[1]);
		$('#timeSection').toggleClass("hidden", !abAreas[1]);
		$('#infoTab').toggleClass("active", abAreas[2]);
		$('#userNoteSection').toggleClass("hidden", !abAreas[2]);
		$('#countTab').toggleClass("active", abAreas[3]);
		$('#infoSection').toggleClass("hidden", !abAreas[3]);
	};

	this.setInfo = function(info){
		$('#songInfoArea').val(info);
	};

	this.setSonglists_NEW = function( aoSonglists ) {
		for(var i=0; i<aoSonglists.length; i++){
			Troff.addSonglistToHTML_NEW(aoSonglists[i]);
		}
	};

	/*Troff*/this.addSonglistToHTML_NEW = function( oSongList ) {

		removeSonglist_NEW = function( event ) {
			$(event.target).closest( "li" ).remove();
			$("#songListSelector").find("[value=\"" + oSongList.id + "\"]").remove()
			DB.saveSonglists_new();

			notifyUndo( "The songlist \"" + oSongList.name + "\" was removed", function() {
				Troff.addSonglistToHTML_NEW( oSongList );
				DB.saveSonglists_new();
			} );
		}

		$( "#songListList" )
			.append(
				$("<li>")
					.addClass("py-1")
					.append( $("<div>")
						.addClass( "flex-display" )
						.addClass( "pr-2" )
						.append( $( "<button>" )
							.addClass("small")
							.addClass("regularButton")
							.addClass( "mr-2" )
							.append(
								$( "<i>" )
								.addClass( "fa")
								.addClass( "fa-trash")
							).on("click", removeSonglist_NEW )
						)
						.append( $( "<button>" )
							.addClass( "songlist" )
							.addClass( "stOnOffButton" )
							.addClass( "flex-one" )
							.addClass( "text-left" )
							.data("songList", oSongList)
							.attr("data-songlist-id", oSongList.id)
							.text( oSongList.name )
							.click(clickSongList_NEW)
						)
					)
					.on( "drop", dropSongOnSonglist)
					.on( "dragover", allowDrop)
					.on( "dragleave", onDragleave)
			);

		var oAdd = $("<option>")
			.text("Add to " + oSongList.name)
			.val(oSongList.id);
		$("#songListSelectorAddToSonglist").append( oAdd );
		var oRemove = $("<option>")
			.text("Remove from " + oSongList.name)
			.val(oSongList.id);
		$("#songListSelectorRemoveFromSonglist").append( oRemove );

	};

	this.recallCurrentStateOfSonglists = function() {
		DB.getVal( "TROFF_SETTING_SONG_LIST_ADDITIVE_SELECT", function( isAdditiveSelect ) {
			DB.getVal( TROFF_CURRENT_STATE_OF_SONG_LISTS, function( o ) {

				var indicatorClass = isAdditiveSelect ? "active" : "selected";

				$("#songListAll_NEW").removeClass( "selected" );

				o.directoryList.forEach(function(v, i){
					$("#directoryList").find("[data-gallery-id="+v.galleryId+"]").each(function( inner_index, inner_value){
						if( $(inner_value).data("full-path") == v.fullPath ) {
							$(inner_value).addClass( indicatorClass );
							$("#songListAll_NEW").removeClass( "selected" );
						}
					});
				});
				o.galleryList.forEach(function(v, i){
					$("#galleryList").find("[data-gallery-id="+v+"]").addClass( indicatorClass );
					$("#songListAll_NEW").removeClass( "selected" );
				});
				o.songListList.forEach(function(v, i){
					$("#songListList").find("[data-songlist-id="+v+"]").addClass( indicatorClass );
					$("#songListAll_NEW").removeClass( "selected" );
				});

				filterSongTable( getFilterDataList() );
			});
		});

	};

	/*Troff*/this.saveCurrentStateOfSonglists = function() {
		var o = {},
			songListList = [],
			galleryList = [],
			directoryList = [];
		$("#songListList").find( ".active, .selected" ).each(function(i, v){
			songListList.push( $(v).attr("data-songlist-id") );
		} );
		o.songListList = songListList;

		$("#galleryList").find( ".active, .selected" ).each(function(i, v){
			galleryList.push( $(v).attr("data-gallery-id") );
		} );
		o.galleryList = galleryList;

		$("#directoryList").find( ".active, .selected" ).each(function(i, v){
			directoryList.push( {
				galleryId : $(v).attr("data-gallery-id"),
				fullPath : $(v).attr( "data-full-path" )
			} );
		} );
		o.directoryList = directoryList;

		DB.saveVal( TROFF_CURRENT_STATE_OF_SONG_LISTS, o );
	};

	this.enterSongListName = function(){
		IO.setEnterFunction(function(event){
			IO.blurHack();
			Troff.saveNewSongList();
			return false;
		});
	};
	this.exitSongListName = function(){
		IO.clearEnterFunction();
		IO.blurHack();
	};

	/*Troff*/this.getUniqueSonglistId = function(){
		var iSonglistId = 1;
		var bFinniched = false;

		var aDOMSonglist = $('#songListList').find('button[data-songlist-id]');
		while(true){
			bFinniched = true;
			for(var i=0; i<aDOMSonglist.length; i++){
				if(aDOMSonglist.eq(i).data('songList').id == iSonglistId){
					iSonglistId++;
					bFinniched = false;
				}
			}
			if(bFinniched)
				return iSonglistId;
		}
	};

	this.enterSongInfo = function(a, b, c){
		$('#songInfoArea').addClass('textareaEdit');
		IO.setEnterFunction(function(event){
			if(event.ctrlKey==1){ //Ctrl+Enter will exit
				IO.blurHack();
				return false;
			}
			return true;
		});
	};

	this.exitSongInfo = function(){
		$('#songInfoArea').removeClass('textareaEdit');
		IO.clearEnterFunction();
	};

	/*Troff*/this.updateSongInfo = function(){
		var strInfo = $('#songInfoArea')[0].value;
		var songId = Troff.getCurrentSong();
		DB.setCurrentSongInfo(strInfo, songId);
	};

	/*Troff*/this.rememberCurrentState = function(){
		if( $("#statesTab").hasClass( "hidden" ) ) return;

		IO.blurHack();
		var nrStates = $('#stateList').children().length + 1;
		IO.prompt(
			"Remember state of settings to be recalled later",
			"State " + nrStates,
			function(stateName){

			if(stateName === "") return;

			var state = {};
			state.name = stateName;
			state.currentLoop = $('.currentLoop').attr('id');
			state.currentMarker = $('.currentMarker').attr('id');
			state.currentStopMarker = $('.currentStopMarker').attr('id');

			$( "[data-save-on-song-toggle-class]" ).each( function( i, element ){
				const $target = $( element ),
					id = $target.attr( "id" ),
					classToToggleAndSave = $target.data( "save-on-song-toggle-class" );
				if( id == undefined ) {
					console.error( "''id'' is required for elements with [data-save-on-song-toggle-class]" );
					return;
				}

				state[ id ] = $target.hasClass( classToToggleAndSave );
			});
			$( "[data-save-on-song-value]" ).each( function( i, element ){
				const $target = $( element ),
					id = $target.attr( "id" ),
					value = $target.val();

				if( id == undefined ) {
					console.error( "''id'' is required for elements with [data-save-on-song-value]" );
					return;
				}

				state[ id ] = value;
			});

			Troff.addButtonsOfStates([JSON.stringify(state)]);
			DB.saveStates(Troff.getCurrentSong());
		});

	};

	this.addButtonsOfStates = function(astrState){
		for(var i=0; i<astrState.length; i++){
			var oState = JSON.parse(astrState[i]);

			$('<div>')
				.append(
					$('<input>')
					.attr('type', 'button')
					.addClass('small regularButton')
					.val('R')
					.click(Troff.removeState))
				.append(
					$('<input>')
					.attr('type', 'button')
					.addClass('regularButton')
					.val(oState.name)
					.click(Troff.setState))
				.attr('strState', astrState[i])
				.appendTo('#stateList');
		}
		if(astrState.length !== 0)
			$('#statesHelpText').hide();
	};

	/*Troff*/this.setState = function(stateWrapper){
		var strState = $(stateWrapper.target).parent().attr('strState');
		var oState = JSON.parse(strState);
		$('#' + oState.currentLoop).click();
		$( "[data-save-on-song-toggle-class]" ).each( function( i, element ){
			const $target = $( element ),
				id = $target.attr( "id" ),
				classToToggleAndSave = $target.data( "save-on-song-toggle-class" );
			if( id == undefined ) {
				console.error( "''id'' is required for elements with [data-save-on-song-toggle-class]" );
				return;
			}
			if( oState[ id ] == undefined ) {
				return;
			}

			if( $target.hasClass( classToToggleAndSave ) != oState[ id ] ) {
				$target.trigger('click');
			}
		});
		$( "[data-save-on-song-value]" ).each( function( i, element ){
			const $target = $( element ),
				id = $target.attr( "id" );

			if( id == undefined ) {
				console.error( "''id'' is required for elements with [data-save-on-song-value]" );
				return;
			}
			if( oState[ id ] == undefined ) {
				return;
			}

			$target.val( oState[ id ] );
			$target[0].dispatchEvent(new Event('input'));
		});

		$('#' + oState.currentMarker).click();
		$('#' + oState.currentStopMarker).click();

		//DB.saveSongDataFromState(Troff.getCurrentSong(), oState);
	};

	/*Troff*/this.onSearchKeyup = function( event ) {

		if( event != undefined && [37, 38, 39, 40].indexOf(event.keyCode) != -1 ) {
			return;
		}
		var tBody = $("#dataSongTable").find("tbody"),
			importantEl = tBody.find( "tr" ).filter( ".important" );

		if( importantEl.length === 0  ) {
			tBody.find( "tr" ).eq(0).addClass('important');
		} else {
			importantEl.slice(1).removeClass('important');
		}

	};

	/*Troff*/this.enterSerachDataTableSongList = function( event ) {
		$input = $( event.target );
		$input.addClass('textareaEdit');

		if( !$input.is(':focus') ) {
			$input.focus();
		}

		Troff.onSearchKeyup( null );

		IO.setEnterFunction(function(event){
			if(event.ctrlKey==1){//Ctrl+Enter will exit
				$input.val('').trigger('click');
				IO.blurHack();
				return false;
			}

			$("#dataSongTable").DataTable().rows(".important").nodes().to$().trigger( "click" );
			$("#dataSongTable").DataTable().rows(".important").nodes().to$().removeClass( "important" );

			IO.blurHack();
			return true;
		}, function(event){
			var element = $("#dataSongTable").find("tbody").find( "tr" ).filter( ".important" ),
				next;

			if( event.keyCode == 37 || event.keyCode == 39 ) return;
			event.preventDefault();

			if( event.keyCode == 40 ) {
				next = element.next();
			} else {
				next = element.prev();
			}

			if( next.length ) {
				element.removeClass( "important" );
				next.addClass( "important" );
			}
		});

	};

	/*Troff*/this.exitSerachDataTableSongList = function( event ) {
		$("#dataSongTable").DataTable().rows(".important").nodes().to$().removeClass( "important" );

		IO.clearEnterFunction();
		IO.blurHack();
	};

	/*Troff*/this.showSearchAndActivate = function( event ) {
		if( !$('#buttSongsDialog').hasClass( "active" ) ) {
			$('#buttSongsDialog').trigger( "click" ).select();
		}

		if( !$( "[data-st-css-selector-to-hide=\"#dataSongTable_filter\"]" ).hasClass("active") ) {
			$( "[data-st-css-selector-to-hide=\"#dataSongTable_filter\"]" ).trigger( "click" ).select();
		}

		$( "#dataSongTable_filter" ).find( "input" ).trigger( "click" ).select();
	};

	/*Troff*/this.enterMarkerInfo = function(a, b, c){
		$('#markerInfoArea').addClass('textareaEdit');
		IO.setEnterFunction(function(event){
			if(event.ctrlKey==1){//Ctrl+Enter will exit
				IO.blurHack();
				return false;
			}
			return true;
		});
	};
	this.exitMarkerInfo = function(){
		$('#markerInfoArea').removeClass('textareaEdit');
		IO.clearEnterFunction();
	};

	/*Troff*/this.updateMarkerInfo = function(){
			var strInfo = $('#markerInfoArea')[0].value;
			var color = $('.currentMarker')[0].color;
			var markerId = $('.currentMarker').attr('id');
			var time = $('.currentMarker')[0].timeValue;
			var markerName = $('.currentMarker').val();
			var songId = Troff.getCurrentSong();

			$('.currentMarker')[0].info = strInfo;

			DB.updateMarker(markerId, markerName, strInfo, color, time, songId);

		};

		this.addMarkers = function(aMarkers){

			var startM = function() {
				Troff.selectMarker(this.id);
				IO.blurHack();
			};
			var stopM = function() {
				Troff.selectStopMarker(this.id);
				IO.blurHack();
			};
			var editM = function() {
				Troff.editMarker(this.id.slice(0,-1));
				IO.blurHack();
			};

			for(var i=0; i<aMarkers.length; i++) {
				var oMarker = aMarkers[i];
				var name = oMarker.name;
				var time = Number(oMarker.time);
				var info = oMarker.info;
				var color = oMarker.color || "None";
				var nameId = oMarker.id;

				var maxTime = Number(document.getElementById('timeBar').max);

				if(time == "max" || time > maxTime){
					time = maxTime;
					var song = Troff.getCurrentSong();
				}

				var button = document.createElement("input");
				button.type = "button";
				button.id = nameId;
				button.value = name;
				button.classList.add('onOffButton');
				button.timeValue = time;
				button.info = info;
				button.color = color;

				var buttonS = document.createElement("input");
				buttonS.type = "button";
				buttonS.id = nameId + 'S';
				buttonS.value = 'Stop';
				buttonS.classList.add('onOffButton');
				buttonS.timeValue = time;

				var buttonE = $( "<button>" )
					.addClass( "small" )
					.addClass( "regularButton" )
					.attr( "id", nameId + 'E')
					.append(
						$( "<i>" )
						.addClass( "fa-pencil")
					);

				var p = document.createElement("b");
				p.innerHTML = Troff.secToDisp(time);

				var docMarkerList = document.getElementById('markerList');
				var listElement = document.createElement("li");

				listElement.appendChild( buttonE[0] );
				listElement.appendChild(p);
				listElement.appendChild(button);
				listElement.appendChild(buttonS);
				$( listElement ).addClass( MARKER_COLOR_PREFIX + color );


				var child = $('#markerList li:first-child')[0];
				var bInserted = false;
				var bContinue = false;
				while(child) {
					var childTime = parseFloat(child.childNodes[2].timeValue);
					if(childTime !== undefined && Math.abs(time - childTime) < 0.001){
						var markerId = child.childNodes[2].id;

						if(child.childNodes[2].info != info){
							updated = true;
							var newMarkerInfo = child.childNodes[2].info + "\n\n" + info;
							$('#'+markerId)[0].info = newMarkerInfo;
							if($('.currentMarker')[0].id == child.childNodes[2].id)
								$('#markerInfoArea').val(newMarkerInfo);
						}
						if(child.childNodes[2].value != name){
							var newMarkerName = child.childNodes[2].value + ", " + name;
							updated = true;
							$('#'+markerId).val(newMarkerName);
						}

						bContinue = true;
						break;
					} else if (time < childTime){
						$('#markerList')[0].insertBefore(listElement,child);
						bInserted = true;
						break;
					} else {
						child = child.nextSibling;
					}
				} // end while

				if( bContinue ) continue;
				if ( !bInserted ) {
					docMarkerList.appendChild(listElement);
				}

				document.getElementById(nameId).addEventListener('click', startM);
				document.getElementById(nameId + 'S').addEventListener('click', stopM);
				document.getElementById(nameId + 'E').addEventListener('click', editM);
			}//end for-loop
			Troff.setAppropriateMarkerDistance();
			Troff.fixMarkerExtraExtendedColor();
		}; // end addMarker ****************/


		/*
		 * returns the id of the earliest and latest markers.
		 * (note: latest marker without the 'S' for stop-id)
		 */
		this.getFirstAndLastMarkers = function(){
			var aOMarkers = $('#markerList > li > :nth-child(3)');
			if(aOMarkers.length == 0 ) {
				return null;
			}
			var max = parseFloat(aOMarkers[0].timeValue);
			var min = parseFloat(aOMarkers[0].timeValue);
			var iMaxIndex = 0;
			var iMinIndex = 0;
			var aMarkers = [];
			for(var i=0; i<aOMarkers.length; i++){
				var tv = aOMarkers[i].timeValue;
				aMarkers[i] = tv;

				if(parseFloat(aMarkers[i]) > max){
					iMaxIndex = i;
					max = parseFloat(aMarkers[i]);
				}
				if(parseFloat(aMarkers[i]) < min){
					iMinIndex = i;
					min = parseFloat(aMarkers[i]);
				}
			}
			return [aOMarkers[iMinIndex].id, aOMarkers[iMaxIndex].id];

		};


		this.unselectMarkers = function(){
			var aFirstAndLast = Troff.getFirstAndLastMarkers();
			var startMarkerId = aFirstAndLast[0];
			var stopMarkerId = aFirstAndLast[1] + 'S';

			$('.currentMarker').removeClass('currentMarker');
			$('#' + startMarkerId ).addClass('currentMarker');
			$('#markerInfoArea').val($('#'+startMarkerId)[0].info);
			$('.currentStopMarker').removeClass('currentStopMarker');
			$('#' + stopMarkerId).addClass('currentStopMarker');

			Troff.setAppropriateActivePlayRegion();
			IO.blurHack();

			DB.setCurrentStartAndStopMarker(startMarkerId, stopMarkerId, strCurrentSong);
		};

		this.unselectStartMarker = function(){
			var aFirstAndLast = Troff.getFirstAndLastMarkers();
			var startMarkerId = aFirstAndLast[0];
			var stopMarkerId = aFirstAndLast[1] + 'S';

			$('.currentMarker').removeClass('currentMarker');
			$('#' + startMarkerId).addClass('currentMarker');
			$('#markerInfoArea').val($('#'+startMarkerId)[0].info);

			Troff.setAppropriateActivePlayRegion();
			IO.blurHack();
			DB.setCurrentStartMarker(startMarkerId, strCurrentSong );
		};

		this.unselectStopMarker = function(){
			var aFirstAndLast = Troff.getFirstAndLastMarkers();
			var startMarkerId = aFirstAndLast[0];
			var stopMarkerId = aFirstAndLast[1] + 'S';

			$('.currentStopMarker').removeClass('currentStopMarker');
			$('#' + stopMarkerId).addClass('currentStopMarker');

			Troff.setAppropriateActivePlayRegion();
			IO.blurHack();
			DB.setCurrentStopMarker(stopMarkerId, strCurrentSong );
		};

		/*
			selectMarker - All, sets new Marker, sets playtime to markers playtime
		*/
		this.selectMarker = function(markerId){
			var startTime = Number($('#'+markerId)[0].timeValue);
			var stopTime = Troff.getStopTime();

			// if stopMarker befor Marker - unselect stopMarker:
			if(stopTime <= (startTime +0.5)){
				$('.currentStopMarker').removeClass('currentStopMarker');
				var aFirstAndLast = Troff.getFirstAndLastMarkers();
				var firstMarkerId = aFirstAndLast[0];
				var lastMarkerId = aFirstAndLast[1] + 'S';

				$('#' + lastMarkerId).addClass('currentStopMarker');
			}
			var stopMarker = $('.currentStopMarker').attr('id');
			stopMarker = stopMarker ? stopMarker : 0;

			//marks selected Marker:
			$('.currentMarker').removeClass('currentMarker');
			$('#'+markerId).addClass('currentMarker');
			$('#markerInfoArea').val($('#'+markerId)[0].info);

			if( $("#" + TROFF_SETTING_ON_SELECT_MARKER_GO_TO_MARKER ).hasClass( "active" ) ) {
				Troff.goToStartMarker();
			}

			Troff.setAppropriateActivePlayRegion();

			DB.setCurrentStartAndStopMarker(markerId, stopMarker, strCurrentSong);
		}; // end selectMarker

		/*
			selectStopMarker - All, selects a marker to stop playing at
		*/
		this.selectStopMarker = function(markerId){
			var stopTime = Number($('#'+markerId)[0].timeValue);
			var startTime = Troff.getStartTime();

			// if Marker after stopMarker - unselect Marker:
			if((startTime + 0.5) >= stopTime ){
				var aFirstAndLast = Troff.getFirstAndLastMarkers();
				var firstMarkerId = aFirstAndLast[0];
				var lastMarkerId = aFirstAndLast[1] + 'S';

				$('.currentMarker').removeClass('currentMarker');
				$('#' + firstMarkerId).addClass('currentMarker');
				$('#markerInfoArea').val($('#'+firstMarkerId)[0].info);
			}

			var startMarker = $('.currentMarker').attr('id');
			startMarker = startMarker ? startMarker : 0;

			//marks selected StopMarker:
			$('.currentStopMarker').removeClass('currentStopMarker');
			$('#'+markerId).addClass('currentStopMarker');

			Troff.setAppropriateActivePlayRegion();
			DB.setCurrentStartAndStopMarker(startMarker, markerId, strCurrentSong);

		}; // end selectStopMarker

	this.removeState = function(){
		var that = this;
		IO.confirm("Remove state",
			"This action can not be undone",
			function(){
			$(that).parent().remove();
			DB.saveStates(Troff.getCurrentSong());
			if($('#stateList >').length === 0)
				$('#statesHelpText').show();
		});
	};

		/*
			removeMarker, all, Tar bort en markÃ¶r frÃ¥n html och DB
		*/
		this.removeMarker = function(markerIdWithoutHash){
			markerId = '#' + markerIdWithoutHash;
			var oMarker = {};
			oMarker.id = markerIdWithoutHash;
			oMarker.name = $( markerId ).val();
			oMarker.time = Number( $( markerId )[0].timeValue );
			oMarker.info = $( markerId )[0].info;
			oMarker.color = $( markerId )[0].color;

			notifyUndo( "Marker " + oMarker.name + " was removed", function() {
				aMarkers = [oMarker];
				Troff.addMarkers( aMarkers );
				DB.saveMarkers(Troff.getCurrentSong() ); // saves end marker to DB
			} );

			// Remove Marker from HTML
			$( markerId ).closest('li').remove();
			Troff.setAppropriateMarkerDistance();

			// remove from DB
			DB.saveMarkers(Troff.getCurrentSong());
		}; // end removeMarker ******/


		this.toggleMoveMarkersMoreInfo = function(){
			$( "#moveMarkersMoreInfoDialog" ).toggleClass( "hidden" );
			IO.blurHack();
		};

		/*
			show the move markers pop up dialog.
		*/
		this.showMoveMarkers = function(){
			IO.setEnterFunction(function(){
				Troff.moveMarkers();
			});
			$('#moveMarkersDialog').removeClass( "hidden" );
			$('#moveMarkersNumber').select();
		};

		/*
			hide the delete markers pop up dialog.
		*/
		/*Troff*/this.hideDeleteMarkersDialog = function(){
			$( "#deleteMarkersDialog" ).addClass( "hidden" );
			IO.clearEnterFunction();
		};


		/*
			hide the move markers pop up dialog.
		*/
		this.hideMoveMarkers = function(){
			$('#moveMarkersDialog').addClass( "hidden" );
			$('#moveMarkersMoreInfoDialog').addClass( "hidden" );
			//$('#moveMarkersMoreInfoDialog').hide();
			$('#moveMarkersNumber').val(0);
			IO.clearEnterFunction();
		};

		/*Troff*/this.deleteAllMarkers = function() {
			Troff.deleteMarkers( false );
		}

		/*Troff*/this.deleteSelectedMarkers = function() {
			Troff.deleteMarkers( true );
		}

		/*Troff*/this.stretchSelectedMarkers = function() {
			var aAllMarkers = Troff.getCurrentMarkers(),
				startNumber,
				endNumber;

			[startNumber, endNumber] = Troff.getStartAndEndMarkerNr( 0, 1 );

			Troff.stretchMarkers(
				$( "#stretchMarkersNumber" ).val(),
				aAllMarkers[startNumber].timeValue,
				startNumber,
				endNumber
			);
		}

		/*Troff*/this.stretchAllMarkers = function() {

			var baseValue = 0,
				startNumber = 0,
				endNumber = Troff.getCurrentMarkers().length;

			Troff.stretchMarkers(
				$( "#stretchMarkersNumber" ).val(),
				baseValue,
				startNumber,
				endNumber
			);
		}

		/*Troff*/this.stretchMarkers = function(stretchProcent, baseValue, startNr, endNr) {
			var i,
				maxTime = Number(document.getElementById('timeBar').max),
				aAllMarkers = Troff.getCurrentMarkers(),
				newTime,
				markerId,
				calculatetTime;

			if( stretchProcent == 100 ) {
				IO.alert(
					"100% will not change markers",
					"Stretching the markers to 100% of there original position will not change the marker position.<br /><br />" +
					"<span class=\"small\">Please change the %-value or close the Stretch markers dialog</span>."
				);
				return;
			}


			for( i = startNr; i < endNr; i++ ) {
				markerId = aAllMarkers[i].id;

				calculatetTime = ( aAllMarkers[i].timeValue - baseValue ) * stretchProcent/100 + baseValue;
				newTime = Math.max(0, Math.min(maxTime, calculatetTime) );

				Troff.checkIfMarkerIndexHasSameTimeAsOtherMarkers(i, markerId, aAllMarkers, newTime );

				$('#'+markerId)[0].timeValue = newTime;
				$('#'+markerId + 'S')[0].timeValue = newTime;
				$('#'+markerId).prev().html( Troff.secToDisp(newTime) );
			}

			Troff.setAppropriateMarkerDistance();
			DB.saveMarkers(Troff.getCurrentSong() );
			$( "#stretchMarkersDialog" ).addClass( "hidden" );
			$( "#stretchMarkersNumber" ).val( 100 );
		}

		/*
			move all or some markers.
		*/
		this.moveAllMarkersUp = function(){
			$('#moveMarkersNumber').val(- $('#moveMarkersNumber').val());
			Troff.moveMarkers(false, false);
		};
		this.moveAllMarkersDown = function(){
			Troff.moveMarkers(false, false);
		};
		this.moveSomeMarkersUp = function(){
			$('#moveMarkersNumber').val(- $('#moveMarkersNumber').val());
			Troff.moveMarkers(true, false);
		};
		this.moveSomeMarkersDown = function(){
			Troff.moveMarkers(true, false);
		};

		this.moveOneMarkerDown = function(val){
			$('#moveMarkersNumber').val( val );
			Troff.moveMarkers(true, true);
		};

		/*Troff*/this.getStartAndEndMarkerNr = function( addToStartNr, addToEndNr ) {
			addToStartNr = addToStartNr || 0;
			addToEndNr = addToEndNr || 0;

			var aAllMarkers = Troff.getCurrentMarkers(),
				startNr = 0,
				endNr = aAllMarkers.length,
				selectedId = $('.currentMarker').attr('id'),
				selectedStopId = $('.currentStopMarker').attr('id'),
				nextAttrId,
				attrId;


			for(var k=0; k<aAllMarkers.length; k++){
				if(selectedId == aAllMarkers.eq(k).attr('id'))
					startNr = k;

				nextAttrId = aAllMarkers.eq(k).next().attr('id');
				attrId = aAllMarkers.eq(k).attr('id');
				if(selectedStopId == aAllMarkers.eq(k).next().attr('id'))
					endNr = k;
			}
			return [ startNr + addToStartNr, endNr + addToEndNr ];
		}

		/*Troff*/this.deleteMarkers = function( bDeleteSelected ) {
			var i,
				markerId,
				startNumber = 1,
				markers = $("#markerList").children(),
				endNumber = markers.length - 1;

			if( bDeleteSelected ) {
				var [startNumber, endNumber] = Troff.getStartAndEndMarkerNr( 0, 1 );
			}

			if( markers.length - (endNumber - startNumber) < 2 ) {
				IO.alert( "You must have at least 2 markers left" );
				return;
			}

			for( i = startNumber; i < endNumber; i++ ) {
				markerId = markers.eq( i ).find("input").attr("id");
				Troff.removeMarker( markerId );
			}
			Troff.hideDeleteMarkersDialog();
		}

		/*
			move all markers.
		*/
		this.moveMarkers = function(bMoveSelected, bOneMarker){
			$('#moveMarkersDialog').addClass( "hidden" );
			IO.clearEnterFunction();

			var value = $('#moveMarkersNumber').val();
			$('#moveMarkersNumber').val( 0 );

			var aAllMarkers = Troff.getCurrentMarkers();

			var startNumber = 0;
			var endNumber = aAllMarkers.length;

			if( bOneMarker ) {
				aAllMarkers = $('.currentMarker');
				endNumber = 1;
			} else if(bMoveSelected){
				[startNumber, endNumber] = Troff.getStartAndEndMarkerNr( 0, 1 );
			}

			for(var i=startNumber; i<endNumber; i++){
				var markerId = aAllMarkers[i].id;

				var markerTime = Number(aAllMarkers[i].timeValue) + Number(value);
				var maxTime = Number(document.getElementById('timeBar').max);
				var newTime = Math.max(0, Math.min(maxTime, markerTime) );

				Troff.checkIfMarkerIndexHasSameTimeAsOtherMarkers(i, markerId, aAllMarkers, newTime );

				$('#'+markerId)[0].timeValue = newTime;
				$('#'+markerId + 'S')[0].timeValue = newTime;
				$('#'+markerId).prev().html( Troff.secToDisp(newTime) );
			}

			Troff.setAppropriateMarkerDistance();
			DB.saveMarkers(Troff.getCurrentSong() );
		};

		/*Troff*/this.checkIfMarkerIndexHasSameTimeAsOtherMarkers = function ( markerIndex, markerId, aAllMarkers, newTime ) {
			for(var j = 0; j < markerIndex; j++ ) {
				if(Number(aAllMarkers[j].timeValue) == newTime){
					var newMarkerName = $('#'+markerId).val();
					if(newMarkerName != aAllMarkers.eq(j).val())
						newMarkerName += ", " + aAllMarkers.eq(j).val();
					$('#'+markerId).val( newMarkerName );

					var newMarkerInfo = $('#'+markerId)[0].info;
					if(newMarkerInfo !=  aAllMarkers[j].info)
						newMarkerInfo += "\n\n" + aAllMarkers[j].info;
					$('#'+markerId)[0].info = newMarkerInfo;
					if( $('#' + markerId).hasClass('currentMarker') )
						$('#markerInfoArea').val(newMarkerInfo);

					aAllMarkers.eq(j).parent().remove();
				}
			}
		}

		/*
			editMarker, all, Editerar en markÃ¶r i bÃ¥de html och DB
		*/
		this.editMarker = function(markerId){
			var oldName  = $('#'+markerId).val();
			var oldTime = Number($('#'+markerId)[0].timeValue);
			var oldMarkerInfo = $('#'+markerId)[0].info;
			var oldMarkerColor = $('#'+markerId)[0].color;
			var oldMarkerClass = MARKER_COLOR_PREFIX + oldMarkerColor;

			var text = "Please enter new marker name here";
			IO.promptEditMarker(markerId, function(newMarkerName, newMarkerInfo, newMarkerColor, newTime){

			if(newMarkerName === null || newMarkerName === "" ||
				newTime === null || newTime === "" ) {
				return;
			}

			if( newTime < 0 )
				newTime = 0;
			if( newTime > $('audio, video')[0].duration )
				newTime = $('audio, video')[0].duration;


			var updated = false;


			// Update HTML Name
			if(newMarkerName != oldName){
					updated = true;
					$('#'+markerId).val(newMarkerName);
			}

			// update HTML Info
			if(newMarkerInfo != oldMarkerInfo){
				updated = true;
				$('#'+markerId)[0].info = newMarkerInfo;

				if( $('#' + markerId).hasClass('currentMarker') )
					$('#markerInfoArea').val(newMarkerInfo);
			}
			if(newMarkerColor != oldMarkerColor){
				updated = true;
				$('#'+markerId)[0].color = newMarkerColor;
				$('#'+markerId).parent().removeClass( oldMarkerClass );
				$('#'+markerId).parent().addClass( MARKER_COLOR_PREFIX + newMarkerColor );
			}

			// update HTML Time
			if(newTime != oldTime){
				updated = true;

				$('#'+markerId)[0].timeValue = newTime;
				$('#'+markerId + 'S')[0].timeValue = newTime;
				Troff.setAppropriateMarkerDistance();

				var startTime = Number($('.currentMarker')[0].timeValue);
				var stopTime = Number($('.currentStopMarker')[0].timeValue);

				if( startTime >= stopTime ){
					$('.currentStopMarker').removeClass('currentStopMarker');
					Troff.setAppropriateActivePlayRegion();
				}
				$('#'+markerId).prev().html( Troff.secToDisp(newTime) );
			}

			// update name and time and info and color in DB, if nessessarry
			if(updated){
				DB.updateMarker(
					markerId,
					newMarkerName,
					newMarkerInfo,
					newMarkerColor,
					Number(newTime),
					strCurrentSong
				);
				Troff.fixMarkerExtraExtendedColor();
				/*
				note: DB.updateMarker will also update the "currentStartMarker" and the
				currentStopMarker, if the updated marker is the start or stop marker.
				*/
			}

			}); // end prompt-Function
		}; // end editMarker ******/

		/*
			clearAllStates - HTML, clears states
		*/
		this.clearAllStates = function(){
			$('#stateList').empty();
			$('#statesHelpText').show();
		}; // end clearAllStates

		/*
			clearAllMarkers - HTML, clears markers
		*/
		this.clearAllMarkers = function(){
			$('#markerSection').css("height", "100%");
			$('#markerSection').css("margin-top", 0);
			var docMarkerList = document.getElementById('markerList');
			if (docMarkerList) {
				while (docMarkerList.firstChild) {
					docMarkerList.removeChild(docMarkerList.firstChild) ;
				}
			}
		}; // end clearAllMarkers

		/*Troff*/this.setAppropriateActivePlayRegion = function () {
			var aFirstAndLast = Troff.getFirstAndLastMarkers();

			if( aFirstAndLast === null || aFirstAndLast === undefined ) {
				setTimeout( Troff.setAppropriateActivePlayRegion, 200 );
				return;
			}

			var firstMarkerId = aFirstAndLast[0];
			var lastMarkerId = aFirstAndLast[1] + 'S';
			if( $('.currentMarker').length === 0 ){
				$('#' + firstMarkerId).addClass('currentMarker');
				$('#markerInfoArea').val( $('#' + firstMarkerId)[0].info);
			}
			if( $('.currentStopMarker').length === 0 )
				$('#' + lastMarkerId).addClass('currentStopMarker');


			var timeBarHeight = $('#timeBar').height() - 12;
			var barMarginTop = parseInt($('#timeBar').css('margin-top')) + 6;

			var startTime = Troff.getStartTime();
			var stopTime = Troff.getStopTime();
			var songTime = $('audio, video')[0].duration;

			var height = (stopTime - startTime) * timeBarHeight / songTime;
			var top = startTime * timeBarHeight / songTime + barMarginTop;

			$('#activePlayRegion').height(height);
			$('#activePlayRegion').css("margin-top", top + "px");
		}; // end setAppropriateActivePlayRegion

		this.setAppropriateMarkerDistance = function () {
			$( "#markerSection" ).removeClass( "hidden" );
			var child = $('#markerList li:first-child')[0];

			var timeBarHeight = $('#timeBar').height() - 10;
			var totalDistanceTop = 4;

			var barMarginTop = parseInt($('#timeBar').css('margin-top'));
			while(child){
				var audioVideo =  document.querySelector('audio, video');
				if( audioVideo == null ) {
					console.error("there is no audio or video tag");
					return;
				}
				var songTime = audioVideo.duration;
				var markerTime = Number(child.childNodes[2].timeValue);
				var myRowHeight = child.clientHeight;

				var freeDistanceToTop = timeBarHeight * markerTime / songTime;

				var marginTop = freeDistanceToTop - totalDistanceTop + barMarginTop;
				totalDistanceTop = freeDistanceToTop + myRowHeight + barMarginTop;

				if( marginTop > 0 ){
					$( child ).css( "border-top-width", marginTop + "px" );
					$( child ).css( "border-top-style", "solid" );
					$( child ).css( "margin-top", "" );
				} else {
					$( child ).css( "border-top-width", "" );
					$( child ).css( "border-top-style", "" );
					$( child ).css( "margin-top", marginTop + "px" );
				}
				child = child.nextSibling;
			}
			Troff.setAppropriateActivePlayRegion();
		}; // end setAppropriateMarkerDistance

		this.selectNext = function(reverse){
			var markers = $('#markerList').children();

			var currentMarkerTime = Number($('.currentMarker')[0].timeValue, 10);
			var currentStopTime = Number($('.currentStopMarker')[0].timeValue, 10);
			markers.sort(function(a, b){
				return Number(a.childNodes[2].timeValue) - Number(b.childNodes[2].timeValue);
			});

			var bSelectNext = false;
			var bSelectNextStop = false;

			if(reverse){
				for(var i=markers.length-1; i>-1; i--) {
					checkOrSelect(i);
				}
			} else {
				for(var j = 0; j < markers.length; j++) {
					checkOrSelect(j);
				}
			}

			function checkOrSelect(i){
				if(bSelectNextStop){
					$(markers[i].childNodes[3]).click();
					bSelectNextStop = false;
				}
				if(Number(markers[i].childNodes[3].timeValue) == currentStopTime){
					bSelectNextStop = true;
				}
				if(bSelectNext){
					$(markers[i].childNodes[2]).click();
					bSelectNext = false;
				}
				if(Number(markers[i].childNodes[2].timeValue) == currentMarkerTime){
					bSelectNext = true;
				}
			}
		};


		this.zoomDontShowAgain = function(){
			$('#zoomInstructionDialog').addClass( "hidden" );
			Troff.dontShowZoomInstructions = true;
			DB.setZoomDontShowAgain();
			IO.clearEnterFunction();
		};

		this.zoomDialogOK = function(){
			$('#zoomInstructionDialog').addClass( "hidden" );
			IO.clearEnterFunction();
		};

		this.zoomOut = function(){
			IO.blurHack();
			Troff.zoom(0, Number(document.getElementById('timeBar').max));
		};

		this.zoomToMarker = function(){
			IO.blurHack();
			var startTime = Troff.getStartTime();
			var endTime = Troff.getStopTime();
			if(startTime === m_zoomStartTime && endTime == m_zoomEndTime){
				if(!Troff.dontShowZoomInstructions){
					IO.setEnterFunction(Troff.zoomDialogOK);
					$('#zoomInstructionDialog').removeClass( "hidden" );
				}
			}
			Troff.zoom(startTime, endTime);
		};

		this.zoom = function(startTime, endTime){

			//NOTE all distances is in %, unless otherwise specified

			if( endTime === undefined ) { return; }

			m_zoomStartTime = startTime;
			m_zoomEndTime = endTime;

			DB.saveZoomTimes(strCurrentSong, startTime, endTime);

			var winHeightPX = $( "#markerSectionParent" ).height();

			var mPX = parseInt($('#timeBar').css('marginTop'));

			var mDiv = 8;//parseInt($('#timeBar').css('marginTop'))

			var oH = 100; //original Height of div
			var m = (mPX + mDiv) * oH / winHeightPX; // original margin between timebar and div
			var mT = 2 * m; //total margin
			var oh = oH - mT;//original Height of timebar

			var tL = Number(document.getElementById('timeBar').max);
			var t1 = startTime / tL;
			var t2 = endTime / tL;

			var zt = 1 / (t2 - t1); // == tL/(endTime - startTime);
			var zd = (zt * oh + mT)/oH;
			var mt = t1 * oh * zt;

			var height = 100 * zd;
			var marginTop = -mt;

			let marginTopPX = winHeightPX * marginTop / 100;

			$('#markerSection').css("height", (height + "%"));
			$('#markerSection').css("margin-top", (marginTopPX + "px"));

			Troff.setAppropriateMarkerDistance();
		};

		this.tapTime = function(){
				previousTime = time;
				time = new Date().getTime() / 1000;
				IO.blurHack();

				if(time - previousTime > 3){
						startTime = previousTime = time;
						nrTaps = 0;
				} else {
						nrTaps++;
				}
				let currTempo = Math.round ( nrTaps * 60 / (time - startTime) )

				if( Number.isInteger( currTempo ) ){
					$('#tapTempo').val( currTempo );
				} else {
					$('#tapTempo').val( "" );
				}

				$('#tapTempo')[0].dispatchEvent(new Event('input'));
		};

		this.setTempo = function( tempo ){
				$('#tapTempo').val( tempo );
		};




		this.fixMarkerExtraExtendedColor = function() {
			$( "#markerList" ).children().removeClassStartingWith("extend_");

			$( "#markerList" ).children( ":not(.markerColorNone)" ).each( function( index ) {
				specialColorClass = Troff.getClassStartsWith( $(this).attr('class'), "markerColor");
				$( this ).nextUntil( ":not(.markerColorNone)" ).addClass("extend_" + specialColorClass);
			} );

		}


		/* standAlone Functions */
		this.getClassStartsWith = function(classes,startString){
			var r = $.grep(classes.split(" "),
				function(classes,r) {
					return 0 === classes.indexOf(startString);
				}).join();
			return r || !1;
		}

		this.secToDisp = function(seconds){
				var sec = ( seconds | 0 ) % 60;
				if ( sec < 10 )
						sec = "0"+sec;
				var min = (seconds / 60) | 0;
				return min + ':' + sec;
		};

		/*Troff*/this.incrementInput = function( identifier, amount ){
			$( identifier ).val( parseInt( $( identifier ).val() ) + amount );
			$( identifier ).each((i, element) => {
				element.dispatchEvent(new Event('input'));
			});
		};

		/* end standAlone Functions */


}; // end TroffClass




var RateClass = function(){
	this.RATED_STATUS_NOT_ASKED = 1;
	this.RATED_STATUS_NO_THANKS = 2;
	this.RATED_STATUS_ASK_LATER = 3;
	this.RATED_STATUS_ALREADY_RATED = 4;

	this.startFunc = function(){
		var oData = {
			millisFirstTimeStartingApp : nDB.get( "millisFirstTimeStartingApp" ),
			iRatedStatus : nDB.get( "iRatedStatus" ),
			straLastMonthUsage : nDB.get( "straLastMonthUsage" )
		}
		 // Check if it is the first time user starts the App

		if(!oData.millisFirstTimeStartingApp){
			Troff.firstTimeUser();
			Rate.firstTimeStartingAppFunc();
			return;
		}

		if(oData.iRatedStatus == Rate.RATED_STATUS_ALREADY_RATED) return;

		var millisOneMonth = 2678400000; // nr of millisecunds in a month!
		var aLastMonthUsage = JSON.parse(oData.straLastMonthUsage);

		var d = new Date();
		var millis = d.getTime();
		aLastMonthUsage.push(millis);

		// update the user statistics
		aLastMonthUsage = aLastMonthUsage.filter(function(element){
			return element > millis - millisOneMonth;
		});

		while( aLastMonthUsage.length > 100 ) {
			aLastMonthUsage.shift();
		}

		nDB.set( 'straLastMonthUsage', JSON.stringify( aLastMonthUsage ) );

		// return if no conection
		if(!navigator.onLine) return;

		// return if user has used the app for less than 3 months
		if(millis - oData.millisFirstTimeStartingApp < 3*millisOneMonth ) return;

		// return if user has used Troff less than 4 times durring the last month
		if(aLastMonthUsage.length < 4) return;

		if(oData.iRatedStatus == Rate.RATED_STATUS_NOT_ASKED) {
			Rate.showRateDialog();
		}

		if(oData.iRatedStatus == Rate.RATED_STATUS_ASK_LATER) {
			if(Math.random() < 0.30)
				Rate.showRateDialog();
		}

		if(oData.iRatedStatus == Rate.RATED_STATUS_NO_THANKS) {
			if(aLastMonthUsage.length < 20) return;
			if(Math.random() < 0.05){
				Rate.showRateDialog();
			}
		}

	};


	this.firstTimeStartingAppFunc = function(){
		var d = new Date();
		var millis = d.getTime();
		var aLastMonthUsage = [millis];
		var straLastMonthUsage = JSON.stringify(aLastMonthUsage);
		nDB.set( 'millisFirstTimeStartingApp', millis );
		nDB.set( 'iRatedStatus', Rate.RATED_STATUS_NOT_ASKED );
		nDB.set( 'straLastMonthUsage', straLastMonthUsage );

	};

	this.showRateDialog = function(){
		IO.setEnterFunction(function(){
			Rate.rateDialogRateNow();
		});
		if(navigator.onLine){
			$('#rateDialog').removeClass( "hidden" );
		}
	};

	this.rateDialogNoThanks = function(){
		IO.blurHack();
		IO.clearEnterFunction();
		$('#rateDialog').addClass( "hidden" );
		nDB.set('iRatedStatus', Rate.RATED_STATUS_NO_THANKS );
	};
	this.rateDialogAskLater = function(){
		IO.blurHack();
		IO.clearEnterFunction();
		$('#rateDialog').addClass("hidden");
		nDB.set('iRatedStatus', Rate.RATED_STATUS_ASK_LATER );
	};
	this.rateDialogRateNow = function(){
		IO.blurHack();
		IO.clearEnterFunction();
		$('#rateDialog').addClass("hidden");
		nDB.set( 'iRatedStatus', Rate.RATED_STATUS_ALREADY_RATED );

		window.open( "https://www.facebook.com/troffmusic/" );
	};
}; //End RateClass


const nDB = { // new data base
	setOnSong : function( songId, key, value ) {
		let obj = nDB.get( songId );
		obj[key] = value;
		nDB.set( songId, obj );
	},
	set : function( key, value ) {
		window.localStorage.setItem( key, JSON.stringify( value ) );
	},
	get : function( key ) {
		return JSON.parse( window.localStorage.getItem( key ) );
	},
	delete : function( key ) {
		window.localStorage.removeItem( key );
		// todo, add print if "key" do not exist
	},
	getAllKeys : function() {
		return Object.keys(localStorage)
	},
	clearAllStorage : function() {
		localStorage.clear();
	},
};

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

	// deprecated: use nDB.set( key, value )
	this.saveVal = function( key, value) {
		nDB.set( key, value );
	};

	// deprecated: use nDB.get_callback( key, callback )
	this.getVal = function( key, returnFunction ) {
		nDBc.get( key, returnFunction );
	};

	this.cleanSong = function(songId, songObject){

		songObject = DB.fixSongObject(songObject, songId);

		nDB.set( songId, songObject );
	}; // end cleanSong

	this.fixSongObject = function(songObject, songId){

		if (songObject === undefined) songObject = {};

		var songLength;
		try{
			songLength = Number(document.getElementById('timeBar').max);
		} catch (e) {
			console.error("getElementById('timeBar') does not exist." +
			" Tried to call fixSongObject without it....");
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
		if(songObject.loopTimes > 9) songObject.loopTimes = "inf";
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

			DB.fixDefaultValue( allKeys, TROFF_SETTING_SONG_COLUMN_TOGGLE, [
				$("#columnToggleParent" ).find( "[data-column=3]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=4]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=5]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=6]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=7]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=8]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=9]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=10]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=11]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=12]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=13]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=14]" ).data( "default" ),
				$("#columnToggleParent" ).find( "[data-column=15]" ).data( "default" ),
			] );

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

			allKeys.forEach( (key, i) => {
				if( key == "TROFF_CURRENT_STATE_OF_SONG_LISTS" ) {
					return;
				}
				DB.cleanSong(key, nDB.get( key ) );
			} );
		});//end get all keys
	};

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
				console.error('Error "setCurrentAreas, noSong" occurred, songId=' +
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
			//Troff.setSonglists(JSON.parse(straoSongLists)); //todo: ta bort denna setSonglists :)
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
			console.error('Error "updateMarker, noSong" occurred, songId=' + songId);
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
			console.error('Error "saveState, noSong" occurred, songId=' + songId);
			song = {};
			song.markers = [];
		}

		song.aStates = aStates;
		song.serverId = undefined;
		Troff.setUrlToSong( undefined, null );

		nDB.set( songId, song );
		if( callback ) {
			callback();
		}
	});
	};

	/*DB*/this.saveZoomTimes = function(songId, startTime, endTime) {
	nDBc.get(songId, function( song ){
		if(!song){
			console.error('Error "saveZoomTimes, noSong" occurred, songId=' + songId);
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
			console.error('Error "saveMarker, noSong" occurred, songId=' + songId);
			song = {};
			song.markers = [];
		}


		song.currentStartMarker = $('.currentMarker')[0].id;
		song.currentStopMarker = $('.currentStopMarker')[0].id;
		song.markers = aMarkers;
		song.serverId = undefined;
		Troff.setUrlToSong( undefined, null );

		nDB.set( songId, song );

		if( callback ) {
			callback();
		}
	});
	};// end saveMarkers


	// This is NOT run when creating a State, but when loading a state
	// so that when the song is reloaded, the correct markers, nr of loops
	// mm is selected,
	// this method should not be used, but rather the existing methods for
	// saving the volume, speed, slected marker mm, but once I reasoned
	// that accessing the DB and updating the same song-object that many times
	// would be bad for preformance.... so now I have this method....
	/*DB* /this.saveSongDataFromState = function(songId, oState){
	nDBc.get(songId, function( song ){
		if(!song){
				console.error('Error "saveSongDataFromState, noSong" occurred,'+
												' songId=' +songId);
				return;
		}

		Denna behövs inte eftersom alla världen sparas när man laddar in den! :)

		song.TROFF_CLASS_TO_TOGGLE_buttStartBefore = oState.buttStartBefore;
		song.TROFF_VALUE_startBefore = oState.startBefore;
		song.TROFF_CLASS_TO_TOGGLE_buttStopAfter = oState.buttStopAfter;
		song.TROFF_VALUE_stopAfter = oState.stopAfter;

		song.TROFF_CLASS_TO_TOGGLE_buttPauseBefStart = oState.buttPauseBefStart;
		song.TROFF_VALUE_pauseBeforeStart = oState.pauseBeforeStart;
		song.TROFF_CLASS_TO_TOGGLE_buttIncrementUntil = oState.buttIncrementUntil;
		song.TROFF_VALUE_incrementUntilValue = oState.incrementUntilValue;
		song.TROFF_CLASS_TO_TOGGLE_buttWaitBetweenLoops = oState.buttWaitBetweenLoops;
		song.TROFF_VALUE_waitBetweenLoops = oState.waitBetweenLoops;

		song.volume = oState.volumeBar;
		song.speed = oState.speedBar;
		if($('#'+ oState.currentMarker).length)
			song.currentStartMarker = oState.currentMarker;
		if($('#'+ oState.currentStopMarker).length)
			song.currentStopMarker = oState.currentStopMarker;
		song.wait = [oState.buttWaitBetweenLoops, oState.waitBetweenLoops];

		nDB.set( songId, song );
	});

	}; */

	/*DB*/this.setCurrentStartAndStopMarker = function(startMarkerId, stopMarkerId,
			songId) {
	nDBc.get(songId, function( song ){
		if(!song){
				console.error('Error "setStartAndStopMarker, noSong" occurred,'+
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
		});
	};

	this.setCurrentTempo = function(tempo, songId){
		DB.setCurrent(songId, 'tempo', tempo);
	};

	/*DB*/this.setCurrent = function( songId, key, value, callback ) {
		nDBc.get(songId, function( song ){
			if(!song){
					console.error('Error, "noSong" occurred;\n'+
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
				$target[0].dispatchEvent(new Event('input'));
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
			IO.removeLoadScreen();
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
		setTimeout( () => {
			$( "#loadScreen, #loadScreenStyle" ).remove();
		}, 0);
	};

	/*IO*/this.startFunc = function() {

		document.addEventListener('keydown', IO.keyboardKeydown);
		document.addEventListener('fullscreenchange', IO.fullScreenChange );

		$( ".outerDialog" ).click( function( event ) {
			if( $(event.target ).hasClass( "outerDialog" ) && !$(event.target ).hasClass( "noCloseOnClick" ) ) {
				$( event.target ).addClass( "hidden" );
			}
		} );


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
			var $target = $( event.target ),
				$value = $( $target.data( "st-css-selector-to-toggle" ) );

			if( $target.hasClass( "stOnOffButton" ) ) {
				if( $value.hasClass( "hidden" ) ) {
					$target.addClass( "active" );
				} else {
					$target.removeClass( "active" );
				}
			}

		} );

		//TODO: fix so that all cancelButtons use this class, and remove there id, and event-listener :)
		$( ".dialogCancelButton" ).click( function( event ) {
			$( event.target ).closest(".outerDialog").addClass("hidden")
		} );

		$( "[data-href]" ).on( "click", IO.openWindow );
		$( ".onClickToggleFullScreen" ).on( "click", IO.toggleFullScreen );
		$( ".blurOnClick" ).on( "click", IO.blurHack );
		$( ".showUploadSongToServerDialog" ).on( "click", Troff.showUploadSongToServerDialog )
		$( "#buttCopyUrlToClipboard" ).on( "click", Troff.buttCopyUrlToClipboard );
		$( ".onClickCopyTextToClipboard" ).on( "click", IO.onClickCopyTextToClipboard );
		$( "#buttNewSongList_NEW" ).on( "click", clickButtNewSongList_NEW );
		$( "#songListAll_NEW" ).click( clickSongList_NEW );
		$( "#songListSelector" ).change( onChangeSongListSelector );

		$( "#buttSettingsDialog" ).click ( Troff.openSettingsDialog );
		$( "#buttCloseSettingPopUpSquare" ).click ( Troff.closeSettingsDialog );

		$( ".buttCloseSongsDialog" ).click( closeSongDialog );
		$( "#buttAttachedSongListToggle" ).click( clickAttachedSongListToggle );


		$( "#buttSongsDialog" ).click( clickSongsDialog );
		$( ".buttSetSongsDialogToAttachedState" ).click( minimizeSongPicker );
		$( ".buttSetSongsDialogToFloatingState" ).click( maximizeSongPicker );
		$( "#outerSongListPopUpSquare" ).click( reloadSongsButtonActive );

		$( "#TROFF_SETTING_SONG_LIST_FLOATING_DIALOG" ).click( clickToggleFloatingSonglists );

		$( "#toggleExtendedMarkerColor" ).click ( Troff.toggleExtendedMarkerColor );
		$( "#toggleExtraExtendedMarkerColor" ).click ( Troff.toggleExtraExtendedMarkerColor );

		$( "#themePickerParent" ).find("input").click ( Troff.setTheme );
		$( "#columnToggleParent" ).find("input").click( dataTableColumnPicker );


		$('#buttPlayUiButtonParent').click( Troff.playUiButton );

		$('#timeBar')[0].addEventListener('input', Troff.timeUpdate );
		$('#volumeBar')[0].addEventListener('input', Troff.volumeUpdate );
		$('#speedBar')[0].addEventListener('input', Troff.speedUpdate );

		$('#buttRememberState').click(Troff.rememberCurrentState);
		$('#buttMarker').click(Troff.createMarker);
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

		$('#buttCancelMoveMarkersDialog').click(Troff.hideMoveMarkers);
		$('#buttPromptMoveMarkers').click(Troff.showMoveMarkers);
		$('#buttPromptMoveMarkersMoreInfo').click(Troff.toggleMoveMarkersMoreInfo);
		$('#buttImportExportMarker').click(Troff.toggleImportExport);
		$('#buttCancelImportExportPopUpSquare').click(Troff.toggleImportExport);
		$('#buttExportMarker').click(Troff.exportStuff);
		$('#buttImportMarker').click(Troff.importStuff);

		$("[data-save-on-song-toggle-class]").click( IO.saveOnSongToggleClass );

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

		$('#markerInfoArea').change(Troff.updateMarkerInfo);
		$('#markerInfoArea').blur(Troff.exitMarkerInfo);
		$('#markerInfoArea').click(Troff.enterMarkerInfo);

		$('#songInfoArea').change(Troff.updateSongInfo);
		$('#songInfoArea').blur(Troff.exitSongInfo);
		$('#songInfoArea').click(Troff.enterSongInfo);
		$('#newSongListName').click(Troff.enterSongListName);
		$('#newSongListName').blur(Troff.exitSongListName);
		$('#saveNewSongList').click(Troff.saveNewSongList);
		$('#removeSongList').click(Troff.removeSonglist);
		$('#cancelSongList').click(Troff.cancelSongList);

		$('#buttUnselectMarkers').click(Troff.unselectMarkers);
		$('#buttResetVolume').click(() => Troff.setVolume( $( "#TROFF_SETTING_SONG_DEFAULT_VOLUME_VALUE" ).val() ) );
		$('#volumeMinus').click(() => { Troff.incrementInput( "#volumeBar", - 5 ) } );
		$('#volumePlus').click(() => { Troff.incrementInput( "#volumeBar", + 5 ) } );
		$('#buttResetSpeed, #buttResetSpeedDemo').click(() => Troff.setSpeed( $( "#TROFF_SETTING_SONG_DEFAULT_SPEED_VALUE" ).val() ) );
		$('#speedMinus, #speedMinusDemo').click(() => { Troff.incrementInput( "#speedBar", - 5 ) } );
		$('#speedPlus, #speedPlusDemo').click(() => { Troff.incrementInput( "#speedBar", + 5 ) } );

		$('#buttTapTempo').click( Troff.tapTime );


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


		window.addEventListener('resize', function(){
			Troff.setAppropriateMarkerDistance();
		});

		Troff.recallGlobalSettings();

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

	this.confirm = function(textHead, textBox, func, funcCancle){
		let outerDiv = $( "<div>" ).addClass("outerDialog onTop");
		let innerDiv = $( "<div>" ).addClass("innerDialog m-4");

		let clickCancel = function(){
			if(funcCancle) funcCancle();
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
					.attr( "type", "button" ).attr( "value", "OK" )
					.on( "click", IOEnterFunction )
			)
			.append(
				$("<input>" )
					.addClass( "regularButton" )
					.attr( "type", "button" ).attr( "value", "Cancel" )
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
			var hStyle = "" +
					"font-size: 18px;";
			var pStyle = "" +
					"font-size: 14px;";

			if(textBox){
					$("body").append($("<div id='"+outerId+"' class='outerDialog'>"+
						"<div id='"+innerId+"' style='"+innerDivStyle+
										 "' class='secondaryColor'><h2 style='"+hStyle+"'>" + textHead +
										 "</h2><p class=\"full-width\" style='"+pStyle+"' type='text' id='"+textId+
										 "'>"+textBox+"</p> <input type='button' id='"+buttEnterId+
										 "'class='regularButton' value='OK'/></div></div>"));
					$("#"+textId).val(textBox).select();
			} else {
					$("body").append($("<div id='"+outerId+"' class='outerDialog'>"+
						"<div id='"+innerId+"' style='"+innerDivStyle+
									"' class='secondaryColor'><p style='"+pStyle+"'>" + textHead +
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
			console.error( 'this element is missing "id", can not save!', $target );
			return;
		}

		key = "TROFF_VALUE_" + id;
		DB.setCurrent(Troff.getCurrentSong(), key, value );
	}

	/*IO*/this.saveOnSongToggleClass = function( event ) {
		IO.blurHack();

		var $target = $( event.target ),
			targetHasClass,
			id = $target.attr( "id" ),
			classToToggleAndSave = $target.data( "save-on-song-toggle-class" );

		if( id == undefined ) {
			console.error( 'this element is missing "id", can not save!', $target );
			return;
		}

		if( classToToggleAndSave == undefined ) {
			console.error( 'this element is missing "classToToggleAndSave", can not toggle!', $target );
			return;
		}

		$target.toggleClass( classToToggleAndSave );

		key = "TROFF_CLASS_TO_TOGGLE_" + id;
		value = $target.hasClass( classToToggleAndSave );

		DB.setCurrent(Troff.getCurrentSong(), key, value );

	}

}; // end IOClass

var Troff = new TroffClass();
var DB = new DBClass();
var IO = new IOClass();
var Rate = new RateClass();

loadExternalHtml = function(includes, callback) {
	if( includes.length == 0 ) {
		return callback();
	}
	const currentElement = includes.eq(-1);
	includes.splice( includes.length-1, 1);

	const file = $( currentElement ).data('include');
	$( currentElement ).load( file, function(){
		loadExternalHtml( includes, callback );
	} );
}

$(document).ready( async function() {
	setTimeout( () => {
		// don't show tha load-schreen for more than 10-seconds
		// (so that it will be removed even if something breaks)
		IO.removeLoadScreen();
	}, 10000 );

	// include external HTML-files:

	const includes = $('[data-include]');
	loadExternalHtml(includes, async function() {
		initSongTable();

		DB.cleanDB();
		DB.getAllSonglists();
		DB.getZoomDontShowAgain();
		IO.startFunc();
		Rate.startFunc();

		Troff.initFileApiImplementation();
		Troff.recallCurrentStateOfSonglists();

		DB.getShowSongDialog();
		initEnvironment();

		if( window.location.hash ) {
			try {
				await Troff.downloadSongFromServer( window.location.hash )
			} catch( e ) {
				console.error( "error on downloadSongFromServer:", e );
				DB.getCurrentSong();
			}
		} else {
			DB.getCurrentSong();
		}

		backendService.calCurl();

	});
});

function initEnvironment() {
	"use strict";
	if( environment.banner.show ) {
		$( "#banner" ).removeClass( "hidden" );
		$( "#banner" ).find( "#banner-text" ).text( environment.banner.text );
	}

	if( environment.showHiddenInProd ) {
		$( ".hidden-in-prod" )
				.removeClass( "hidden" )
				.removeClass( "hidden-in-prod" );
	}
}

$.fn.removeClassStartingWith = function (filter) {
	$(this).removeClass(function (index, className) {
		return (className.match(new RegExp("\\S*" + filter + "\\S*", 'g')) || []).join(' ')
	});
	return this;
};




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
		console.error( `errorHandler.backendService_getTroffData: Full Error:\n`, error );
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
		console.error( `errorHandler.fileHandler_fetchAndSaveResponse: Full Error:\n`, error );
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
		console.error( `errorHandler.fileHandler_sendFile: Full Error:\n`, error );
	}

});
