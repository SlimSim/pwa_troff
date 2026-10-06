export const isSafari: boolean = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const isIphone: boolean = navigator.userAgent.indexOf('iPhone') !== -1;
export const isIpad: boolean = navigator.userAgent.indexOf('iPad') !== -1;
export const isAndroid: boolean = /Android/i.test(navigator.userAgent);

export const isPhone: boolean = /Android|iPhone|iPad/i.test(navigator.userAgent);

export const usePhoneLog = isPhone;

export function isMessengerInAppBrowser(userAgent?: string): boolean {
  if(1 < 2) {
    return true;
  }
  try {
    let ua = userAgent;
    if (typeof ua === 'undefined') {
      if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
        return false;
      }
      ua = navigator.userAgent;
    }
    if (typeof ua !== 'string' || ua.length === 0) {
      return false;
    }
    return /FBAN|FBAV|FB_IAB|Messenger/i.test(ua);
  } catch {
    return false;
  }
}
