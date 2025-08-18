// Save the original console.log
// const originalLog = console.log;

// // Override console.log
// console.log = function(...args) {
//     // Call the original console.log with a prefix
//     originalLog.apply(console, ["custom log:", ...args]);
// };

const usePhoneLog = false;

// Save the original console.log
const originalTrace = console.trace;
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const regularLog = {
  t: originalTrace.bind(console),
  d: originalLog.bind(console),
  w: originalWarn.bind(console),
  e: originalError.bind(console),
};

const phoneLog = {
  t: (...args) => {
    const stack = new Error().stack.split('\n')[2]; // Get the caller's stack frame
    const match =
      stack.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) || stack.match(/at\s+(.*):(\d+):(\d+)/);
    let functionName = '-';
    let filename = '-';
    let lineNr = '-';
    if (match) {
      const [, func, file, line] = match;
      functionName = func.trim() || '-'; // Extract function name, fallback to "-"
      filename = file ? file.split('/').pop() : '-'; // Extract filename from path
      lineNr = line || '-';
    }
    console.trace(`${filename}:${functionName}:${lineNr}:`, ...args);
    logToDebuggingLog(`t:${filename}:${functionName}:${lineNr}:`, ...args);
  },
  d: (...args) => {
    const stack = new Error().stack.split('\n')[2]; // Get the caller's stack frame
    const match =
      stack.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) || stack.match(/at\s+(.*):(\d+):(\d+)/);
    let functionName = '-';
    let filename = '-';
    let lineNr = '-';
    if (match) {
      const [, func, file, line] = match;
      functionName = func.trim() || '-'; // Extract function name, fallback to "-"
      filename = file ? file.split('/').pop() : '-'; // Extract filename from path
      lineNr = line || '-';
    }
    console.log(`${filename}:${functionName}:${lineNr}:`, ...args);
    logToDebuggingLog(`d:${filename}:${functionName}:${lineNr}:`, ...args);
  },
  e: (...args) => {
    const stack = new Error().stack.split('\n')[2]; // Get the caller's stack frame
    const match =
      stack.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) || stack.match(/at\s+(.*):(\d+):(\d+)/);
    let functionName = '-';
    let filename = '-';
    let lineNr = '-';
    if (match) {
      const [, func, file, line] = match;
      functionName = func.trim() || '-'; // Extract function name, fallback to "-"
      filename = file ? file.split('/').pop() : '-'; // Extract filename from path
      lineNr = line || '-';
    }
    console.error(`${filename}:${functionName}:${lineNr}: `, ...args);
    logToDebuggingLog(`e:${filename}:${functionName}:${lineNr}:`, ...args);
  },
  w: (...args) => {
    const stack = new Error().stack.split('\n')[2]; // Get the caller's stack frame
    const match =
      stack.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) || stack.match(/at\s+(.*):(\d+):(\d+)/);
    let functionName = '-';
    let filename = '-';
    let lineNr = '-';
    if (match) {
      const [, func, file, line] = match;
      functionName = func.trim() || '-'; // Extract function name, fallback to "-"
      filename = file ? file.split('/').pop() : '-'; // Extract filename from path
      lineNr = line;
    }
    console.warn(`${filename}:${functionName}:${lineNr}: `, ...args);
    logToDebuggingLog(`w:${filename}:${functionName}:${lineNr}:`, ...args);
  },
};

const logToDebuggingLog = (type, message) => {
  const logTextarea = document.getElementById('debuggingLogContent');
  if (!logTextarea) return;
  logTextarea.value += type + ': ' + message + '\n';
  logTextarea.scrollTop = logTextarea.scrollHeight; // auto-scroll to bottom
};

// Choose which log to export
const log = usePhoneLog ? phoneLog : regularLog;

export default log;
