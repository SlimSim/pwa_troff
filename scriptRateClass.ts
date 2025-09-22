import { nDB } from './assets/internal/db.js';
import { IO } from './script.js';
import { Troff, Rate } from './script.js';

type RateStoredData = {
  millisFirstTimeStartingApp: number;
  iRatedStatus: number;
  straLastMonthUsage: string;
};

class RateClass {
  RATED_STATUS_NOT_ASKED: number;
  RATED_STATUS_NO_THANKS: number;
  RATED_STATUS_ASK_LATER: number;
  RATED_STATUS_ALREADY_RATED: number;
  MILLIS_IN_ONE_MONTH: number;

  constructor() {
    this.RATED_STATUS_NOT_ASKED = 1;
    this.RATED_STATUS_NO_THANKS = 2;
    this.RATED_STATUS_ASK_LATER = 3;
    this.RATED_STATUS_ALREADY_RATED = 4;

    this.MILLIS_IN_ONE_MONTH = 2678400000; // nr of millisecunds in a month!
  }

  /**
   * Initializes usage tracking and triggers dialogs when appropriate.
   * No params; reads persisted values from local DB.
   */
  startFunc = () => {
    var oData: RateStoredData = {
      millisFirstTimeStartingApp: nDB.get('millisFirstTimeStartingApp'),
      iRatedStatus: nDB.get('iRatedStatus'),
      straLastMonthUsage: nDB.get('straLastMonthUsage'),
    };
    // Check if it is the first time user starts the App

    if (!oData.millisFirstTimeStartingApp) {
      Troff.firstTimeUser();
      this.firstTimeStartingAppFunc();
      return;
    }

    /** @type {number[]} */
    var aLastMonthUsage: number[] = JSON.parse(oData.straLastMonthUsage);

    var d = new Date();
    var millis = d.getTime();
    aLastMonthUsage.push(millis);

    // update the user statistics
    aLastMonthUsage = aLastMonthUsage.filter((element: number) => {
      return element > millis - this.MILLIS_IN_ONE_MONTH;
    });

    while (aLastMonthUsage.length > 100) {
      aLastMonthUsage.shift();
    }

    nDB.set('straLastMonthUsage', JSON.stringify(aLastMonthUsage));

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

  /**
   * Show the survey link if the user has used the app sufficiently.
   * @param aLastMonthUsage the arry of millis of every time the app have been used in the last month!
   */
  /*Rate*/ checkToShowUserSurvey = (aLastMonthUsage: number[]): void => {
    // return if user has used Troff less than 5 times durring the last month
    if (aLastMonthUsage.length < 5) return;

    $('#linkToUserSurvey').removeClass('hidden');
  };

  /**
   * Decide whether the rate dialog should be displayed.
   * @param {number} iRatedStatus
   * @param {number[]} aLastMonthUsage the arry of millis of every time the app have been used in the last month!
   * @param {number} millis
   * @param {number} millisFirstTimeStartingApp
   * @returns {void}
   */
  checkToShowRateDialog = (
    iRatedStatus: number,
    aLastMonthUsage: number[],
    millis: number,
    millisFirstTimeStartingApp: number
  ) => {
    // return if user has used the app for less than 3 months
    if (millis - millisFirstTimeStartingApp < 3 * this.MILLIS_IN_ONE_MONTH) return;

    // return if user has used Troff less than 4 times durring the last month
    if (aLastMonthUsage.length < 4) return;

    if (iRatedStatus === this.RATED_STATUS_ALREADY_RATED) return;

    if (iRatedStatus === this.RATED_STATUS_NOT_ASKED) {
      this.showRateDialog();
    } else if (iRatedStatus === this.RATED_STATUS_ASK_LATER) {
      if (Math.random() < 0.3) this.showRateDialog();
    } else if (iRatedStatus === this.RATED_STATUS_NO_THANKS) {
      if (aLastMonthUsage.length < 20) return;
      if (Math.random() < 0.05) {
        this.showRateDialog();
      }
    }
  };

  /**
   * Initialize persisted state on first app start.
   */
  firstTimeStartingAppFunc = (): void => {
    var d = new Date();
    var millis = d.getTime();
    var aLastMonthUsage = [millis];
    var straLastMonthUsage = JSON.stringify(aLastMonthUsage);
    nDB.set('millisFirstTimeStartingApp', millis);
    nDB.set('iRatedStatus', this.RATED_STATUS_NOT_ASKED);
    nDB.set('straLastMonthUsage', straLastMonthUsage);
  };

  /**
   * Show rate dialog and wire Enter key to "Rate now".
   */
  showRateDialog = (): void => {
    IO.setEnterFunction(() => {
      this.rateDialogRateNow();
    });
    if (navigator.onLine) {
      $('#rateDialog').removeClass('hidden');
    }
  };

  rateDialogNoThanks = (): void => {
    IO.blurHack();
    IO.clearEnterFunction();
    $('#rateDialog').addClass('hidden');
    nDB.set('iRatedStatus', this.RATED_STATUS_NO_THANKS);
  };

  rateDialogAskLater = (): void => {
    IO.blurHack();
    IO.clearEnterFunction();
    $('#rateDialog').addClass('hidden');
    nDB.set('iRatedStatus', this.RATED_STATUS_ASK_LATER);
  };

  rateDialogRateNow = (): void => {
    IO.blurHack();
    IO.clearEnterFunction();
    $('#rateDialog').addClass('hidden');
    nDB.set('iRatedStatus', this.RATED_STATUS_ALREADY_RATED);

    window.open('https://www.facebook.com/troffmusic/');
  };
} //End RateClass

export default RateClass;
