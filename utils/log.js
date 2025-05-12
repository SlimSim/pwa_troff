const log = {
  d: (...args) => {
    const stack = new Error().stack.split("\n")[2]; // Get the caller's stack frame
    const match =
      stack.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) ||
      stack.match(/at\s+(.*):(\d+):(\d+)/);
    let functionName = "-";
    let filename = "-";
    let lineNr = "-";
    if (match) {
      const [, func, file, line] = match;
      functionName = func.trim() || "-"; // Extract function name, fallback to "-"
      filename = file ? file.split("/").pop() : "-"; // Extract filename from path
      lineNr = line || "-";
    }
    console.log(`${filename}:${functionName}:${lineNr}:`, ...args);
    logToDebuggingLog(`d:${filename}:${functionName}:${lineNr}:`, ...args);
  },
  e: (...args) => {
    const stack = new Error().stack.split("\n")[2]; // Get the caller's stack frame
    const match =
      stack.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) ||
      stack.match(/at\s+(.*):(\d+):(\d+)/);
    let functionName = "-";
    let filename = "-";
    let lineNr = "-";
    if (match) {
      const [, func, file, line] = match;
      functionName = func.trim() || "-"; // Extract function name, fallback to "-"
      filename = file ? file.split("/").pop() : "-"; // Extract filename from path
      lineNr = line || "-";
    }
    console.error(`${filename}:${functionName}:${lineNr}: `, ...args);
    logToDebuggingLog(`e:${filename}:${functionName}:${lineNr}:`, ...args);
  },
  w: (...args) => {
    const stack = new Error().stack.split("\n")[2]; // Get the caller's stack frame
    const match =
      stack.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) ||
      stack.match(/at\s+(.*):(\d+):(\d+)/);
    let functionName = "-";
    let filename = "-";
    let lineNr = "-";
    if (match) {
      const [, func, file, line] = match;
      functionName = func.trim() || "-"; // Extract function name, fallback to "-"
      filename = file ? file.split("/").pop() : "-"; // Extract filename from path
      lineNr = line;
    }
    console.warn(`${filename}:${functionName}:${lineNr}: `, ...args);
    logToDebuggingLog(`w:${filename}:${functionName}:${lineNr}:`, ...args);
  },
};

const logToDebuggingLog = function (type, message) {
  const logTextarea = document.getElementById("debuggingLogContent");
  if (!logTextarea) return;
  logTextarea.value += type + ": " + message + "\n";
  logTextarea.scrollTop = logTextarea.scrollHeight; // auto-scroll to bottom
};
