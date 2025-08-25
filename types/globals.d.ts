// types/globals.d.ts

import 'jquery';

// Globals
declare const $: any;
declare const jQuery: any;

// jQuery notify plugin augmentation
interface JQueryStatic {
  notify: (...args: any[]) => any;
}

// If you want to also allow $(...).notify(...) chains (in case any plugin uses that style)

// declare module 'jquery' {
//   interface JQueryStatic {
//     notify?: (...args: any[]) => any;
//     // notify(message: string, type?: string): void;
//   }
// }
