#!/usr/bin/env node
import { state } from '../shared';
import { replace, tscPath } from './proxy'

function main() {
  try {
    require(tscPath);
  }
  catch (err) {
    if (err === 'hook') {
      state.hook?.worker.then(main);
    }
    else {
      throw err;
    }
  }
}

replace()
main()