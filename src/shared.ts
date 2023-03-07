import * as vue from '@volar/vue-language-core';
import * as vueTs from '@volar/vue-typescript';

export const state: {
	hook?: {
		program: _Program,
		index: number,
		worker: Promise<any>,
	};
} = {};

export type Hook = (program: _Program) => void;
export type _Program = ts.Program & { __vue: ProgramContext; __is_uni_tsc?: boolean };
export interface ProgramContext {
  projectVersion: number,
  options: ts.CreateProgramOptions,
  languageServiceHost: vue.VueLanguageServiceHost,
  languageService: ReturnType<typeof vueTs.createLanguageService>,
}