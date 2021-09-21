	// Dessa används för att få snygga värden i kolumnerna i song-table i floating state
	//(men jag använder ju inte dom kolumnerna just nu...)

		/*Troff*/this.milisToDisp = function( milis ) {
			var date = new Date( milis );

			var d = date.getDate();
			var m = date.getMonth() + 1;

			var dd = d < 10 ? "0"+d : d;
			var mm = m < 10 ? "0"+m : m;
			var year = "" + date.getFullYear();

			return year + "-" +  mm + "-" + dd;
		}

		/*Troff*/this.byteToDisp= function( byte ) {
			var nrTimes = 0;
				units = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

			while( byte >= 1000 ) {
				nrTimes++;
				byte = byte / 1000;
				if(nrTimes > units.length)
					return byte;
			}

			return Math.round( byte * 10 ) / 10 + units[nrTimes];
		}
