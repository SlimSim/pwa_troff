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

/**
 * This file is only used by update.html
 */

// import log from '../utils/log.js';
import '../external/jquery-3.6.0.min.js';

$(document).ready(() => {
  function addToCache(cache: Cache, url: string) {
    cache.add(url).catch((e: Error) => {
      console.info(`Info: cache.add( ${url} ) fails:`, e);
    });
  }

  caches.keys().then(async function (names) {
    for (const name of names) {
      if (name.includes('songCache')) {
        continue;
      }

      const urls = (await (await caches.open(name)).keys()).map((i) => i.url);
      caches.delete(name);

      const cache = await caches.open(name);

      urls.forEach((url) => addToCache(cache, url));
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      });
    }

    setTimeout(() => {
      window.location.replace('/#reload');
    }, 9000);
  });

  /*
This don't seem to fire, the service-worker does not send a message :(
(() => {
	if( typeof BroadcastChannel === 'undefined' ) {
		return;
	}

	const channel = new BroadcastChannel('service-worker-broadcastChanel');
	channel.addEventListener('message', event => {
		log.d( "service-worker-broadcastChanel event", event);
		log.d( "service-worker-broadcastChanel event.data", event.data);

		window.location.replace( "/" );
	});
})();
*/
});
