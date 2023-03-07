/* eslint-disable @typescript-eslint/no-use-before-define */
import ts from 'typescript'
import * as vue from '@volar/vue-language-core'
import * as vueTs from '@volar/vue-typescript'
import type { ProgramContext, _Program } from './shared'
import { state } from './shared'
import { proxy } from './utils'
import { vueCompiler } from './compiler'

export function createUniProgram(options: ts.CreateProgramOptions) {
  const emitDeclarationOnly = options.options.emitDeclarationOnly
  const noEmit = options.options.noEmit
  let program = options.oldProgram as _Program | undefined

  if (state.hook) {
    program = state.hook.program
    program.__vue.options = options
  }
  else if (!program) {
    program = createVueCoreProgram(options)
  }
  else {
    const ctx: ProgramContext = program.__vue
    ctx.options = options
    ctx.projectVersion++
  }

  if (!program.__is_uni_tsc) {
    return proxy(program, {
      emit(...args: any[]) {
        if (!emitDeclarationOnly || !noEmit)
          vueCompiler(options.rootNames as string[], options.options)

        return program!.emit(...args)
      },
      __is_uni_tsc: true,
    }) as _Program
  }

  return program
}

export function createVueCoreProgram(options: ts.CreateProgramOptions) {
  const ctx: ProgramContext = {
    projectVersion: 0,
    options,
    get languageServiceHost() {
      return vueLsHost
    },
    get languageService() {
      return vueTsLs
    },
  }

  const vueCompilerOptions = getVueCompilerOptions(ctx)
  const scripts = getCompilerScripts(ctx)

  const vueLsHost = proxy(() => ctx.options.host!, {
    resolveModuleNames: undefined, // avoid failed with tsc built-in fileExists
    isTsc: true,
    getScriptVersion: scripts.getScriptVersion,
    getScriptSnapshot: scripts.getScriptSnapshot,
    getProjectVersion: () => ctx.projectVersion.toString(),
    getProjectReferences: () => ctx.options.projectReferences,
    getTypeScriptModule: () => ts,
    getCompilationSettings: () => ctx.options.options,
    getVueCompilationSettings: () => vueCompilerOptions,
    getScriptFileNames: () => {
      if (!options.options?.emitDeclarationOnly || !options.options?.noEmit)
        return ctx.options.rootNames.filter(v => !v.endsWith('.vue'))
      return ctx.options.rootNames as string[]
    },
    writeFile: (fileName, content) => {
      if (!fileName.includes('__VLS_') && !fileName.endsWith('.vue.js'))
        ctx.options.host!.writeFile(fileName, content, false)
    },
  }) as unknown as vue.VueLanguageServiceHost

  const vueTsLs = vueTs.createLanguageService(vueLsHost)
  const program = vueTsLs.getProgram() as _Program
  program.__vue = ctx

  return program
}

function getVueCompilerOptions(ctx: ProgramContext): Partial<vue.VueCompilerOptions> {
  const tsConfig = ctx.options.options.configFilePath
  if (typeof tsConfig === 'string')
    return vue.createParsedCommandLine(ts as any, ts.sys, tsConfig, []).vueOptions

  return {}
}

function getCompilerScripts(ctx: ProgramContext) {
  const scripts = new Map<string, {
    projectVersion: number
    modifiedTime: number
    scriptSnapshot: ts.IScriptSnapshot
    version: string
  }>()

  function getScript(fileName: string) {
    const script = scripts.get(fileName)
    if (script?.projectVersion === ctx.projectVersion)
      return script

    const modifiedTime = ts.sys.getModifiedTime?.(fileName)?.valueOf() ?? 0
    if (script?.modifiedTime === modifiedTime)
      return script

    if (ctx.options.host!.fileExists(fileName)) {
      const fileContent = ctx.options.host!.readFile(fileName)
      if (fileContent !== undefined) {
        const script = {
          projectVersion: ctx.projectVersion,
          modifiedTime,
          scriptSnapshot: ts.ScriptSnapshot.fromString(fileContent),
          version: ctx.options.host!.createHash?.(fileContent) ?? fileContent,
        }
        scripts.set(fileName, script)
        return script
      }
    }
  }

  function getScriptVersion(fileName: string) {
    return getScript(fileName)?.version ?? ''
  }
  function getScriptSnapshot(fileName: string) {
    return getScript(fileName)?.scriptSnapshot
  }

  return {
    get: getScript,
    getScriptVersion,
    getScriptSnapshot,
  }
}
