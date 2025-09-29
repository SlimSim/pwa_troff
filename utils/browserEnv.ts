export const treatSafariDifferent: boolean = false;

export const isSafari: boolean = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const isIphone: boolean = navigator.userAgent.indexOf('iPhone') !== -1;
export const isIpad: boolean = navigator.userAgent.indexOf('iPad') !== -1;

export const isPhone: boolean = /Android|iPhone|iPad/i.test(navigator.userAgent);

export const usePhoneLog = true; //isPhone;
