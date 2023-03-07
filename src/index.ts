import * as ts from 'typescript';
import * as vue from '@volar/vue-language-core';
import * as vueTs from '@volar/vue-typescript';
import { state } from './shared';
import fs from 'fs-extra';
import path from 'path'
const compilerSFC = require('@vue/compiler-sfc') as typeof import('@vue/compiler-sfc/dist/compiler-sfc')
const swc = require("@swc/core") as typeof import('@swc/core');
export type Hook = (program: _Program) => void;

export type _Program = ts.Program & { __vue: ProgramContext; };

interface ProgramContext {
  projectVersion: number,
  options: ts.CreateProgramOptions,
  languageServiceHost: vue.VueLanguageServiceHost,
  languageService: ReturnType<typeof vueTs.createLanguageService>,
}

export function createProgram(options: ts.CreateProgramOptions) {

  const emitDeclarationOnly = options.options.emitDeclarationOnly
  const noEmit = options.options.noEmit

  if (!options.options.noEmit && !options.options.outDir)
    throw toThrow('Please enter outDir does not support the same directory compilation');

  if (!options.options.noEmit && options.options.noEmitOnError)
    throw toThrow('noEmitOnError is not supported');

  if (options.options.extendedDiagnostics || options.options.generateTrace)
    throw toThrow('--extendedDiagnostics / --generateTrace is not supported, please run `Write Virtual Files` in VSCode to write virtual files and use `--extendedDiagnostics` / `--generateTrace` via tsc instead of uni-tsc to debug.');

  if (!options.host)
    throw toThrow('!options.host');

  let program = options.oldProgram as _Program | undefined;


  if (state.hook) {
    program = state.hook.program;
    program.__vue.options = options;
  }
  else if (!program) {

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
        return ctx.options.rootNames as string[];
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
    program = vueTsLs.getProgram() as (ts.Program & { __vue: ProgramContext; });
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
  }
  else {
    const ctx: ProgramContext = program.__vue;
    ctx.options = options;
    ctx.projectVersion++;
  }

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

  for (const rootName of options.rootNames) {
    // register file watchers
    options.host.getSourceFile(rootName, ts.ScriptTarget.ESNext);
  }



  const newProgram = assignProxy(program, {
    emit(...args: any[]) {
      if (!emitDeclarationOnly || !noEmit) {
        vueCompiler(options.rootNames as string[], options.options)
      }
      return program!.emit(...args)
    }
  })

  return newProgram
}

function toThrow(msg: string) {
  console.error(msg);
  return msg;
}

function assignProxy<T extends object>(target: T, assign: Partial<T>) {
  return new Proxy(assign, {
    get: (assign, property) => {
      if (property in assign) {
        // @ts-ignore
        return assign[property];
      }
      // @ts-ignore
      return target[property]
    }
  });
}

function vueCompiler(rootNames: string[], options: ts.CompilerOptions) {
  for (const name of rootNames.filter(v => v.endsWith('.vue'))) {
    const vueFile = fs.readFileSync(name, 'utf-8')
    const { descriptor } = compilerSFC.parse(vueFile)

    let source = vueFile
      .replace(/<script.*?<\/script>/gs, '')

    if (descriptor.scriptSetup?.content) {
      source = `<script setup>\n${transformSync(options.target, descriptor.scriptSetup.content)} </script>\n\n` + source
    }
    if (descriptor.script?.content) {
      source = `<script>\n${transformSync(options.target, descriptor.script.content)} </script>\n\n` + source
    }

    const filePath = path.join(options.outDir!, path.relative(process.cwd(), name))
    fs.ensureDirSync(path.dirname(filePath))
    fs.writeFileSync(filePath, source)
  }
}

function transformSync(target = ts.ScriptTarget.ES2018, content: string) {
  const parses = {
    [ts.ScriptTarget.ES3]: 'es3',
    [ts.ScriptTarget.ES5]: 'es5',
    [ts.ScriptTarget.ES2015]: 'es2015',
    [ts.ScriptTarget.ES2016]: 'es2016',
    [ts.ScriptTarget.ES2017]: 'es2017',
    [ts.ScriptTarget.ES2018]: 'es2018',
    [ts.ScriptTarget.ES2019]: 'es2019',
    [ts.ScriptTarget.ES2020]: 'es2020',
    [ts.ScriptTarget.ES2021]: 'es2021',
    [ts.ScriptTarget.ES2022]: 'es2022',
    [ts.ScriptTarget.ESNext]: 'esnext',
    [ts.ScriptTarget.Latest]: 'esnext',
  } as any as Record<ts.ScriptTarget, any>
  const { code } = swc.transformSync(content, {
    jsc: {
      parser: { syntax: 'typescript' },
      target: parses[target]
    }
  })

  return code
}