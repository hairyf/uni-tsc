#!/usr/bin/env node
import fs from 'fs';
const readFileSync = fs.readFileSync as Function
const proxyApiPath = require.resolve('../index');
export const tscPath = require.resolve('typescript/lib/tsc');

export function replace() {
  fs.readFileSync = resetReadFileSync
}

function resetReadFileSync(...args: any[]) {
  if (args[0] === tscPath) {
    let tsc = readFileSync(...args);

    // add *.vue files to allow extensions
    tryReplace(/supportedTSExtensions = .*(?=;)/, s => s + '.concat([[".vue"]])');
    tryReplace(/supportedJSExtensions = .*(?=;)/, s => s + '.concat([[".vue"]])');
    tryReplace(/allSupportedExtensions = .*(?=;)/, s => s + '.concat([[".vue"]])');

    // proxy createProgram apis
    tryReplace(/function createProgram\(.+\) {/, s => s + ` return require(${JSON.stringify(proxyApiPath)}).createProgram(...arguments);`);

    return tsc;

    function tryReplace(search: RegExp, replace: (substring: string, ...args: any[]) => string) {
      const before = tsc;
      tsc = tsc.replace(search, replace);
      const after = tsc;
      if (after === before) {
        throw 'Search string not found: ' + JSON.stringify(search.toString());
      }
    }
  }
  return readFileSync(...args);
}