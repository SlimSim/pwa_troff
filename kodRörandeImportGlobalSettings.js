//script.js rad 5226 (men borde verkligen hitta något bättre sätt att fixa detta på! :)
	//(typ kanske forca en omladdning?)
	/*IO*/this.stickyMessage = function( textHead, textBox, innerDialogClass ) {
		innerDialogClass = innerDialogClass !== undefined ? innerDialogClass : "flexCol mediumDialog";
		return $("<div>").addClass("outerDialog").append(
			$("<div>").addClass("innerDialog " + innerDialogClass )
				.append( $( "<h2>" ).text( textHead ) )
				.append( $( "<p>" ).addClass( "paragraph normalSize" ).text( textBox ) )
		)
		.appendTo( "body" );
	}








//script.js rad 3511 (ska in i const nDB):
	getAllKeyValuePairs : function() {
		return localStorage;
	},
	set_object : function( object ) {
		Object.entries( object ).forEach((v) => {
			const key =  v[0], val = JSON.parse( v[1] );
			nDB.set( key, val );
		});
	},























//script.js rad 1223
	/*Troff*/this.enterWritableField = function() {
		IO.setEnterFunction(function(event){
			if(event.ctrlKey==1){ //Ctrl+Enter will exit
				IO.blurHack();
				return false;
			}
			return true;
		});
	}
	/*Troff*/this.exitWritableField = function() {
		IO.clearEnterFunction();
	}

	/*Troff*/this.getGlobalSettins = function( callback ) {
		nDBc.getAllKeys( function( keys ) {
			var settingItems = {};
			for( var key in keys ) {
				if( key.startsWith( "TROFF_SETTING" ) ) {
					settingItems[ key ] = nDB.get( key );
				}
			}
			callback( settingItems );
		} );

	}

	/*Troff*/this.openExportGlobalSettingsDialog = function() {
		Troff.getGlobalSettins( function( settingItems ) {
			$( "#outerExportGlobalSettingsPopUpSquare" ).removeClass( "hidden" );
			$( "#exportGlobalSettingsTextarea" ).val( JSON.stringify( settingItems, null, 2 ) );
		});
	}

	/*Troff*/this.openExportAllDataDialog = function() {
		nDBc.getAllKeyValuePairs( function(items) {
			$( "#outerExportAllDataPopUpSquare" ).removeClass( "hidden" );
			$( "#exportAllDataTextarea" ).val( JSON.stringify( items, null, 2 ) );
		} );
	}

	/*Troff*/this.okClearAndImportAllDataDialog = function() {
		Troff.okImportAllDataDialog( null, true );
	}

	/* TODO: Troff*/this.okImportAllDataDialog = function( event, bClearData = false ) {
		try {
			var allDataJson = JSON.parse( $( "#importAllDataTextarea" ).val() );
		} catch(e) {
			IO.alert(
				"Corrupt data string",
				"Troff can not import the data string you have pasted.<br /><br />" +
				"<span class=\"small\">Please make sure that the entire string " +
				"from the export is pasted in this box.</span>"
			);
			return;
		}

		var header = "Import all data in Troff",
			body = "Are you sure you want to import this data to troff?";

		if( bClearData ) {
			header = "Override all data in Troff";
			body = "Are you sure you want to import this data and override all data in Troff? <br />" +
						"All your songlists, markers and settings will be overwitten with this new data";
		}

		IO.confirm(
			header,
			body,
			function() {
				nDBc.getAllKeyValuePairs( function( originalAllData ) {
					const persistentOriginalAllData = JSON.stringify( originalAllData );

					var cleanUpAndRestart = function(){
						$( "#importAllDataTextarea" ).val( "" );
						$( ".outerDialog" ).addClass( "hidden" );
						var stickyMessage = IO.stickyMessage(
							"Restart required",
							"Please restart Troff in order for the import to take effect."
						);

						notifyUndo( "All data was uppdated", function() {
							nDB.clearAllStorage();
							nDB.set_object( JSON.parse( persistentOriginalAllData ) );
							stickyMessage.remove();
						}, true );
					}

					if( bClearData ) {
						nDB.clearAllStorage();
					}

					nDB.set_object( allDataJson );
					cleanUpAndRestart();

				} );
			},
			function() {
				$( "#importAllDataTextarea" ).val( "" );
				$( "#outerImportAllDataPopUpSquare" ).addClass( "hidden" );
			}
		);
	} // */

	/* TODO: Troff*/this.okImportGlobalSettingsDialog = function() {
		try {
			var globalSettingsJson = JSON.parse( $( "#importGlobalSettingsTextarea" ).val() );
		} catch(e) {
			IO.alert(
				"Corrupt data string",
				"Troff can 	set_object : function( object ) {
		Object.entries( object ).forEach((v) => {
			const key =  v[0], val = JSON.parse( v[1] );
			nDB.set( key, val );
		});
	},not import the data string you have pasted.<br /><br />" +
				"<span class=\"small\">Please make sure that the entire string " +
				"from the export is pasted in this box.</span>"
			);
			return;
		}

		var allKeys = Object.keys( globalSettingsJson );

		nonAcceptableKeys = [];
		allKeys.forEach(key => {
			if( !key.startsWith( "TROFF_SETTING" ) ) {
				nonAcceptableKeys.push( key );
			}
		});

		if( nonAcceptableKeys.length > 0 ){

			IO.alert(
				"Unacceptable keys",
				"You seem to import things which are not settings, " +
				"the following keys are not acceptable:<br /><span class=\"small\">" +
				nonAcceptableKeys.map(key => key + "<br />") +
				"</span>"
			);
			return;
		}


		IO.confirm(
			"Override global settings in Troff",
			"Are you sure you want to import these global settings and override them in Troff?",
			function() {
				Troff.getGlobalSettins( function( originalSettingItems ) {
					nDB.set_object( globalSettingsJson );
					$( "#importGlobalSettingsTextarea" ).val( "" );
					$( ".outerDialog" ).addClass( "hidden" );
					var stickyMessage = IO.stickyMessage(
						"Restart required",
						"Please restart Troff in order for the import to take effect."
					);

					notifyUndo( "Your global settings was uppdated", function() {
						nDB.set_object( originalSettingItems );
						stickyMessage.remove();
					}, true );
				} );
			},
			function() {
				$( "#importGlobalSettingsTextarea" ).val( "" );
				$( "#outerImportGlobalSettingsPopUpSquare" ).addClass( "hidden" );
			}
		);
	} // */
