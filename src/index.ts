import { _Program } from './shared';
import { registerWatchers, saveProgramHooks, toThrow } from './utils';
import { createUniProgram } from './program';

export function createProgram(options: ts.CreateProgramOptions) {

  if (!options.options.noEmit && !options.options.outDir)
    throw toThrow('Please enter outDir does not support the same directory compilation');

  if (!options.options.noEmit && options.options.noEmitOnError)
    throw toThrow('noEmitOnError is not supported');

  if (options.options.extendedDiagnostics || options.options.generateTrace)
    throw toThrow('--extendedDiagnostics / --generateTrace is not supported, please run `Write Virtual Files` in VSCode to write virtual files and use `--extendedDiagnostics` / `--generateTrace` via tsc instead of uni-tsc to debug.');

  const program = createUniProgram(options)

  saveProgramHooks(program)

  registerWatchers(options)

  return program
}
