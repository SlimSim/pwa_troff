export const isSafari: boolean = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const isIphone: boolean = navigator.userAgent.indexOf('iPhone') !== -1;
export const isIpad: boolean = navigator.userAgent.indexOf('iPad') !== -1;
export const isAndroid: boolean = /Android/i.test(navigator.userAgent);

export const isPhone: boolean = /Android|iPhone|iPad/i.test(navigator.userAgent);

/** True when the app is running in installed PWA (standalone) mode. */
export const isStandalone: boolean =
  window.matchMedia('(display-mode: standalone)').matches;

export const usePhoneLog = isPhone;
