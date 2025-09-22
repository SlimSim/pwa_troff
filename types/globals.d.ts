// types/globals.d.ts

import 'jquery';

// Define the notify function interface
interface NotifyFunction {
  (message: string, type?: string): any;
  (options: any): any;
  (...args: any[]): any;
  defaults(options: any): void;
  addStyle(name: string, style: any): void;
}

// Extend the global jQuery interface to include the notify plugin
declare global {
  interface JQueryStatic {
    notify: NotifyFunction;
  }

  // Also extend the jQuery instance interface if the plugin supports chaining
  interface JQuery {
    notify?(message: string, type?: string): JQuery;
    notify?(options: any): JQuery;
    notify?(...args: any[]): JQuery;
    removeClassStartingWith(filter: string): JQuery;
  }

  // Make sure $ and jQuery are available globally
  const $: JQueryStatic;
  const jQuery: JQueryStatic;
}

// This is needed to make this file a module
export {};
