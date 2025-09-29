import { IO } from '../script.js';

function copyDebuggingLog() {
  const textarea = document.getElementById('debuggingLogContent') as HTMLTextAreaElement;
  const value = 'type;file;function;row;message\n' + textarea.value;
  IO.copyTextToClipboard(value);
}

function clearDebuggingLog() {
  const textarea = document.getElementById('debuggingLogContent') as HTMLTextAreaElement;
  textarea.value = '';
}

console.log('setting copyDebuggingLog!!!');
$('#buttCopyDebuggingLog').on('click', copyDebuggingLog);
$('#buttClearDebuggingLog').on('click', clearDebuggingLog);
console.log('$', $);
