import { IO } from '../script.js';

function copyDebuggingLog() {
  console.log('copyDebuggingLog ->');
  const textarea = document.getElementById('debuggingLogContent') as HTMLTextAreaElement;
  const value = 'type;file;function;row;message\n' + textarea.value;
  IO.copyTextToClipboard(value);
}

console.log('setting copyDebuggingLog!!!');
$('#buttCopyDebuggingLog').on('click', copyDebuggingLog);
console.log('$', $);
