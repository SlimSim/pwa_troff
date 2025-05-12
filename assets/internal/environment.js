const environment = {};

(function main() {
  "use strict";

  environment.banner = {};

  switch (window.location.hostname) {
    case "localhost":
      environment.banner.show = true;
      environment.banner.text = "Welcome to development";
      environment.banner.showLogs = true;
      environment.showHiddenInProd = true;

      environment.firebaseConfig = {
        apiKey: "AIzaSyCo1r8aMFCPHdfNu_V-hqF1GMa4A9rU7ww",
        authDomain: "pwa-troff-dev.firebaseapp.com",
        projectId: "pwa-troff-dev",
        storageBucket: "pwa-troff-dev.appspot.com",
        messagingSenderId: "245960461240",
        appId: "1:245960461240:web:7969954a2707709f13dd4d",
      };
      break;
    case "slimsim.github.io":
    case "beta.troff.app":
      environment.banner.show = true;
      environment.banner.text = "Welcome to test";
      environment.banner.showLogs = true;
      environment.showHiddenInProd = true;

      environment.firebaseConfig = {
        apiKey: "AIzaSyCEO1gRovzs8OX7iVrLcOhjyosnYjeKRtM",
        authDomain: "troff-test.firebaseapp.com",
        projectId: "troff-test",
        storageBucket: "troff-test.appspot.com",
        messagingSenderId: "512336951689",
        appId: "1:512336951689:web:8b47596c7f3edd26878958",
      };
      break;
    case "troff.app":
    case "ios.troff.app":
    case "troff.slimsim.heliohost.org":
    case "troff.ternsjo-it.heliohost.us":
      environment.banner.show = false;
      environment.banner.text = "Production";
      environment.banner.showLogs = false;
      environment.showHiddenInProd = false;

      environment.firebaseConfig = {
        apiKey: "AIzaSyCuXb4zPlM50HMJGilbgM9DxvZuMGxG7yw",
        authDomain: "troff-prod.firebaseapp.com",
        projectId: "troff-prod",
        storageBucket: "troff-prod.appspot.com",
        messagingSenderId: "681700603804",
        appId: "1:681700603804:web:94fe1e2ec88590ed147a59",
        measurementId: "G-8XLWPKBFL1",
      };
      break;
    default:
      console.warn(
        "No environment set for " +
          window.location.host +
          "! Downloading and uploading songs will not work."
      );
  }
})();
