import path from 'node:path'
import ts from 'typescript'
import swc from '@swc/core'
import compilerSFC from '@vue/compiler-sfc'
import fs from 'fs-extra'

const SCRIPT_TARGETS = {
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
} as unknown as Record<ts.ScriptTarget, swc.JscTarget>

function transformSync(target = ts.ScriptTarget.ES2018, content: string) {
  const { code } = swc.transformSync(content, {
    jsc: {
      parser: { syntax: 'typescript' },
      target: SCRIPT_TARGETS[target],
    },
  })
  return code
}

export function vueCompiler(rootNames: string[], options: ts.CompilerOptions) {
  for (const name of rootNames.filter(v => v.endsWith('.vue'))) {
    const vueFile = fs.readFileSync(name, 'utf-8')
    const { descriptor } = compilerSFC.parse(vueFile)

    let source = vueFile
      .replace(/<script.*?<\/script>/gs, '')

    if (descriptor.scriptSetup?.content)
      source = `<script setup>\n${transformSync(options.target, descriptor.scriptSetup.content)} </script>\n\n${source}`

    if (descriptor.script?.content)
      source = `<script>\n${transformSync(options.target, descriptor.script.content)} </script>\n\n${source}`

    const filePath = path.join(options.outDir!, path.relative(process.cwd(), name))
    fs.ensureDirSync(path.dirname(filePath))
    fs.writeFileSync(filePath, source)
  }
}
