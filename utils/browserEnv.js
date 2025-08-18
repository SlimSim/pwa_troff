export const treatSafariDifferent = false;

export const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const isIphone = navigator.userAgent.indexOf('iPhone') !== -1;
export const isIpad = navigator.userAgent.indexOf('iPad') !== -1;
