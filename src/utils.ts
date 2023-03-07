import ts from 'typescript';
import * as vue from '@volar/vue-language-core';
import * as vueTs from '@volar/vue-typescript';
import { Hook, ProgramContext, state, _Program } from './shared';


export function createVueCoreProgram(options: ts.CreateProgramOptions) {
  const ctx: ProgramContext = {
    projectVersion: 0,
    options,
    get languageServiceHost() {
      return vueLsHost;
    },
    get languageService() {
      return vueTsLs;
    },
  };
  const vueCompilerOptions = getVueCompilerOptions();

  const scripts = new Map<string, {
    projectVersion: number,
    modifiedTime: number,
    scriptSnapshot: ts.IScriptSnapshot,
    version: string,
  }>();
  const vueLsHost = new Proxy(<vue.VueLanguageServiceHost>{
    resolveModuleNames: undefined, // avoid failed with tsc built-in fileExists
    writeFile: (fileName, content) => {
      if (fileName.indexOf('__VLS_') === -1 && !fileName.endsWith('.vue.js')) {
        ctx.options.host!.writeFile(fileName, content, false);
      }
    },
    getCompilationSettings: () => ctx.options.options,
    getVueCompilationSettings: () => vueCompilerOptions,
    getScriptFileNames: () => {
      if (!options.options?.emitDeclarationOnly || !options.options?.noEmit) {
        return ctx.options.rootNames.filter(v => v.endsWith('.vue'))
      }
      return ctx.options.rootNames as string[]
    },
    getScriptVersion,
    getScriptSnapshot,
    getProjectVersion: () => {
      return ctx.projectVersion.toString();
    },
    getProjectReferences: () => ctx.options.projectReferences,

    getTypeScriptModule: () => ts,
    isTsc: true,
  }, {
    get: (target, property) => {
      if (property in target) {
        return target[property as keyof vue.VueLanguageServiceHost];
      }
      return ctx.options.host![property as keyof ts.CompilerHost];
    },
  });
  const vueTsLs = vueTs.createLanguageService(vueLsHost);
  const program = vueTsLs.getProgram() as (ts.Program & { __vue: ProgramContext; });
  program.__vue = ctx;

  function getVueCompilerOptions(): Partial<vue.VueCompilerOptions> {
    const tsConfig = ctx.options.options.configFilePath;
    if (typeof tsConfig === 'string') {
      return vue.createParsedCommandLine(ts as any, ts.sys, tsConfig, []).vueOptions;
    }
    return {};
  }
  function getScriptVersion(fileName: string) {
    return getScript(fileName)?.version ?? '';
  }
  function getScriptSnapshot(fileName: string) {
    return getScript(fileName)?.scriptSnapshot;
  }
  function getScript(fileName: string) {
    const script = scripts.get(fileName);
    if (script?.projectVersion === ctx.projectVersion) {
      return script;
    }

    const modifiedTime = ts.sys.getModifiedTime?.(fileName)?.valueOf() ?? 0;
    if (script?.modifiedTime === modifiedTime) {
      return script;
    }

    if (ctx.options.host!.fileExists(fileName)) {
      const fileContent = ctx.options.host!.readFile(fileName);
      if (fileContent !== undefined) {

        const script = {
          projectVersion: ctx.projectVersion,
          modifiedTime,
          scriptSnapshot: ts.ScriptSnapshot.fromString(fileContent),
          version: ctx.options.host!.createHash?.(fileContent) ?? fileContent,
        };
        scripts.set(fileName, script);

        return script;
      }
    }
  }

  return program
}

export function saveProgramHooks(program: _Program) {
  const vueCompilerOptions = program.__vue.languageServiceHost.getVueCompilationSettings();
  if (vueCompilerOptions.hooks) {
    const index = (state.hook?.index ?? -1) + 1;
    if (index < vueCompilerOptions.hooks.length) {
      const hookPath = vueCompilerOptions.hooks[index];
      const hook: Hook = require(hookPath);
      state.hook = {
        program,
        index,
        worker: (async () => await hook(program))(),
      };
      throw 'hook';
    }
  }
}

export function registerWatchers(options: ts.CreateProgramOptions) {
  if (!options.host)
    throw toThrow('!options.host');
  for (const rootName of options.rootNames) {
    // register file watchers
    options.host.getSourceFile(rootName, ts.ScriptTarget.ESNext);
  }
}

export function toThrow(msg: string) {
  console.error(msg);
  return msg;
}

interface PartialObject {
  [key:string]:any
}

export function proxy<T extends object>(target: T | (() => T), assign: Partial<T & PartialObject>) {
  return new Proxy(assign, {
    get: (assign, property) => {
      if (property in assign) 
        // @ts-ignore
        return assign[property];
      // @ts-ignore
      return typeof target === 'function' ? target()[property] :  target[property]
    }
  }) as T
}