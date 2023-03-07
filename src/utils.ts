/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-var-requires */

import ts from 'typescript'
import type { Hook, _Program } from './shared'
import { state } from './shared'

export function saveProgramHooks(program: _Program) {
  const vueCompilerOptions = program.__vue.languageServiceHost.getVueCompilationSettings()
  if (vueCompilerOptions.hooks) {
    const index = (state.hook?.index ?? -1) + 1
    if (index < vueCompilerOptions.hooks.length) {
      const hookPath = vueCompilerOptions.hooks[index]
      const hook: Hook = require(hookPath)
      state.hook = {
        program,
        index,
        worker: (async () => await hook(program))(),
      }
      throw new Error('hook')
    }
  }
}

export function registerWatchers(options: ts.CreateProgramOptions) {
  if (!options.host)
    throw toThrow('!options.host')
  for (const rootName of options.rootNames) {
    // register file watchers
    options.host.getSourceFile(rootName, ts.ScriptTarget.ESNext)
  }
}

export function toThrow(msg: string) {
  console.error(msg)
  return msg
}

interface PartialObject {
  [key: string]: any
}

export function proxy<T extends object>(target: T | (() => T), assign: Partial<T & PartialObject>) {
  return new Proxy(assign, {
    get: (assign, property) => {
      if (property in assign)
        // @ts-expect-error
        return assign[property]
      // @ts-expect-error
      return typeof target === 'function' ? target()[property] : target[property]
    },
  }) as T
}
