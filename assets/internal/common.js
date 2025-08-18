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

(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var shareButtons = document.querySelectorAll(".shareClass");
    for (var i = 0; i < shareButtons.length; i++) {
      shareButtons[i].addEventListener("click", sendMail);
    }
    function sendMail() {
      console.log("sendMail 2 ->");
      window.IO?.blurHack();
      var subject = "Troff is a great music player for practicing";
      var body =
        "Hello\r\n\r\n" +
        "I found this great app that is perfect for practicing dancing or " +
        "instruments to songs. " +
        "It let you loop a part of a song, slow it down " +
        "and create markers on the song timeline.\r\n" +
        "It even supports movies!\r\n\r\n" +
        "It is free to use and download here:\r\n" +
        "https://troff.app/\r\n\r\n" +
        "Best regards!";
      var link =
        "mailto:?subject=" + subject + "&body=" + encodeURIComponent(body);
      window.open(link);
    }

    const toggleNavigation = document.querySelectorAll(".toggle-navigation");

    toggleNavigation.forEach(function (item) {
      item.addEventListener("click", function () {
        const navigation = document.getElementById("navigation");
        if (!navigation) {
          return;
        }
        navigation.classList.toggle("d-none");
      });
    });
  });
})();
