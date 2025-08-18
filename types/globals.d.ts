// types/globals.d.ts

// Globals
declare const $: any;
declare const jQuery: any;

// jQuery notify plugin augmentation
interface JQueryStatic {
  notify: (...args: any[]) => any;
}

// If you want to also allow $(...).notify(...) chains (in case any plugin uses that style)
interface JQuery {
  notify?: (...args: any[]) => any;
}
