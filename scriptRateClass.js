import { nDB } from "./assets/internal/db.js";
import { IO } from "/script.js";
import { Troff, Rate } from "/script.js";

class RateClass {
  constructor() {
    this.RATED_STATUS_NOT_ASKED = 1;
    this.RATED_STATUS_NO_THANKS = 2;
    this.RATED_STATUS_ASK_LATER = 3;
    this.RATED_STATUS_ALREADY_RATED = 4;

    this.MILLIS_IN_ONE_MONTH = 2678400000; // nr of millisecunds in a month!
  }

  startFunc = () => {
    var oData = {
      millisFirstTimeStartingApp: nDB.get("millisFirstTimeStartingApp"),
      iRatedStatus: nDB.get("iRatedStatus"),
      straLastMonthUsage: nDB.get("straLastMonthUsage"),
    };
    // Check if it is the first time user starts the App

    if (!oData.millisFirstTimeStartingApp) {
      Troff.firstTimeUser();
      this.firstTimeStartingAppFunc();
      return;
    }

    var aLastMonthUsage = JSON.parse(oData.straLastMonthUsage);

    var d = new Date();
    var millis = d.getTime();
    aLastMonthUsage.push(millis);

    // update the user statistics
    aLastMonthUsage = aLastMonthUsage.filter((element) => {
      return element > millis - this.MILLIS_IN_ONE_MONTH;
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

  /*Rate*/ checkToShowUserSurvey = (aLastMonthUsage) => {
    // return if user has used Troff less than 5 times durring the last month
    if (aLastMonthUsage.length < 5) return;

    $("#linkToUserSurvey").removeClass("hidden");
  };

  /*Rate*/ checkToShowRateDialog = (
    iRatedStatus,
    aLastMonthUsage,
    millis,
    millisFirstTimeStartingApp
  ) => {
    // return if user has used the app for less than 3 months
    if (millis - millisFirstTimeStartingApp < 3 * this.MILLIS_IN_ONE_MONTH)
      return;

    // return if user has used Troff less than 4 times durring the last month
    if (aLastMonthUsage.length < 4) return;

    if (iRatedStatus == this.RATED_STATUS_ALREADY_RATED) return;

    if (iRatedStatus == this.RATED_STATUS_NOT_ASKED) {
      this.showRateDialog();
    } else if (iRatedStatus == this.RATED_STATUS_ASK_LATER) {
      if (Math.random() < 0.3) this.showRateDialog();
    } else if (iRatedStatus == this.RATED_STATUS_NO_THANKS) {
      if (aLastMonthUsage.length < 20) return;
      if (Math.random() < 0.05) {
        this.showRateDialog();
      }
    }
  };

  firstTimeStartingAppFunc = () => {
    var d = new Date();
    var millis = d.getTime();
    var aLastMonthUsage = [millis];
    var straLastMonthUsage = JSON.stringify(aLastMonthUsage);
    nDB.set("millisFirstTimeStartingApp", millis);
    nDB.set("iRatedStatus", this.RATED_STATUS_NOT_ASKED);
    nDB.set("straLastMonthUsage", straLastMonthUsage);
  };

  showRateDialog = () => {
    IO.setEnterFunction(() => {
      this.rateDialogRateNow();
    });
    if (navigator.onLine) {
      $("#rateDialog").removeClass("hidden");
    }
  };

  rateDialogNoThanks = () => {
    IO.blurHack();
    IO.clearEnterFunction();
    $("#rateDialog").addClass("hidden");
    nDB.set("iRatedStatus", this.RATED_STATUS_NO_THANKS);
  };
  rateDialogAskLater = () => {
    IO.blurHack();
    IO.clearEnterFunction();
    $("#rateDialog").addClass("hidden");
    nDB.set("iRatedStatus", this.RATED_STATUS_ASK_LATER);
  };
  rateDialogRateNow = () => {
    IO.blurHack();
    IO.clearEnterFunction();
    $("#rateDialog").addClass("hidden");
    nDB.set("iRatedStatus", this.RATED_STATUS_ALREADY_RATED);

    window.open("https://www.facebook.com/troffmusic/");
  };
} //End RateClass

export default RateClass;
