// Save the original console.log
// const originalLog = console.log;

import { usePhoneLog } from './browserEnv.js';

// const usePhoneLog = true;

// // Override console.log
// console.log = function(...args) {
//     // Call the original console.log with a prefix
//     originalLog.apply(console, ["custom log:", ...args]);
// };

// Save the original console.log
const originalTrace = console.trace;
const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

const regularLog = {
  t: originalTrace.bind(console),
  d: originalLog.bind(console),
  i: originalInfo.bind(console),
  w: originalWarn.bind(console),
  e: originalError.bind(console),
};

const commonCode = () => {
  const stack = new Error().stack ?? '';
  const frames = stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  // Grab the first frame that isn’t the Error header
  // const target = frames[3] ?? frames[1] ?? '';
  const helperNames = [
    'commonCode',
    'phoneLog.d',
    'phoneLog.i',
    'phoneLog.w',
    'phoneLog.e',
    'phoneLog.t',
  ];
  const target =
    frames.find((frame) => !helperNames.some((helper) => frame.includes(helper))) ?? '';

  const chromeMatch = target.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/);
  const chromeAltMatch = target.match(/at\s+(.*):(\d+):(\d+)/);
  const safariMatch = target.match(/([^@]*)@([^:]+):(\d+):(\d+)/);
  const safariGlobalMatch = target.match(/global code@([^:]+):(\d+):(\d+)/);

  let functionName = '-';
  let filename = '-';
  let lineNr = '-';

  if (chromeMatch) {
    const [, func, file, line] = chromeMatch;
    functionName = func?.trim() || '(anonymous)';
    filename = 'cM ' + (file?.split('/')?.pop() || '-');
    lineNr = line || '-';
  } else if (chromeAltMatch) {
    const [, file, line] = chromeAltMatch;
    functionName = '(anonymous)';
    filename = 'cAM ' + (file?.split('/')?.pop() || '-');
    lineNr = line || '-';
  } else if (safariMatch) {
    const [, func, file, line] = safariMatch;
    functionName = func?.trim() || '(anonymous)';
    filename = 'sM ' + (file?.split('/')?.pop() || '-');
    lineNr = line || '-';
  } else if (safariGlobalMatch) {
    const [, file, line] = safariGlobalMatch;
    functionName = '(anonymous)';
    filename = 'sGM ' + (file?.split('/')?.pop() || '-');
    lineNr = line || '-';
  } else {
    const atIndex = target.indexOf('@');
    if (atIndex !== -1) {
      const funcPart = target.slice(0, atIndex).trim();
      const locationPart = target.slice(atIndex + 1).trim();
      const segments = locationPart.split(':');

      if (segments.length >= 3) {
        segments.pop();
        const line = segments.pop();
        const file = segments.join(':');

        functionName = funcPart || '(anonymous)';
        filename = 'else ' + (file?.split('/')?.pop() || '-');
        lineNr = line || '-';

        return { functionName, filename, lineNr };
      }
    }

    functionName = 'stack frames ';

    frames.slice(0, 6).forEach((frame) => {
      functionName += frame + ', ';
    });
  }

  return { functionName, filename, lineNr };
};

const phoneLog = {
  t: (...args: any[]) => {
    const { functionName, filename, lineNr } = commonCode();
    console.trace(`${filename}:${functionName}:${lineNr}:`, ...args);
    logToDebuggingLog(`t;${filename};${functionName};${lineNr};`, ...args);
  },
  d: (...args: any[]) => {
    const { functionName, filename, lineNr } = commonCode();
    console.log(`${filename};${functionName};${lineNr};`, ...args);
    logToDebuggingLog(`d;${filename};${functionName};${lineNr};`, ...args);
  },
  i: (...args: any[]) => {
    const { functionName, filename, lineNr } = commonCode();
    console.info(`${filename}:${functionName}:${lineNr}:`, ...args);
    logToDebuggingLog(`i;${filename};${functionName};${lineNr};`, ...args);
  },
  e: (...args: any[]) => {
    const { functionName, filename, lineNr } = commonCode();
    console.error(`${filename}:${functionName}:${lineNr}: `, ...args);
    logToDebuggingLog(`e;${filename};${functionName};${lineNr};`, ...args);
  },
  w: (...args: any[]) => {
    const { functionName, filename, lineNr } = commonCode();
    console.warn(`${filename}:${functionName}:${lineNr}: `, ...args);
    logToDebuggingLog(`w;${filename};${functionName};${lineNr};`, ...args);
  },
};

const logToDebuggingLog = (type: string, ...message: any[]) => {
  const logTextarea = document.getElementById('debuggingLogContent') as HTMLTextAreaElement;
  if (!logTextarea) return;

  const messageParts = message.map((item) => {
    if (typeof item === 'object' && item !== null) {
      return Object.entries(item)
        .map(([key, value]) => `${key}=${value}`)
        .join(';');
    } else {
      return String(item);
    }
  });
  const messageString = messageParts.join(';');

  logTextarea.value += type + messageString + '\n';
  logTextarea.scrollTop = logTextarea.scrollHeight; // auto-scroll to bottom
};

// Choose which log to export
const log = usePhoneLog ? phoneLog : regularLog;

export default log;
