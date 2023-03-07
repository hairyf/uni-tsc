# uni-tsc

在 [uniapp](https://uniapp.dcloud.net.cn/) 中使用 uni-tsc 编译兼容 JavaScript 的组件与 `d.ts` 文件，由 
[@vue/compiler-sfc](https://www.npmjs.com/package/@vue/compiler-sfc) |
[@swc/core](https://www.npmjs.com/package/@swc/core) 支持。
## ⚙️ Install

在项目文件夹中本地安装它:

```bash
pnpm add uni-tsc --dev
# Or Yarn
yarn add uni-tsc --dev
```

## Usage

与 [vue-tsc](https://www.npmjs.com/package/vue-tsc) 类似，但与 `vue-tsc` 不同于可以输出已编译的 `.vue` 文件，它适用于编译 [uniapp](https://uniapp.dcloud.net.cn/) 的组件！

> vue-tsc 在 [#2220](https://github.com/vuejs/language-tools/pull/2220) 已不支持 emit 任何文件。

uni-tsc 与 tsc 一样，需要 `tsconfig.json`，建议您使用以下配置：

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "esnext",
    "moduleResolution": "node",
    "strict": true,
    "declaration": true,
    "jsx": "preserve",
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "downlevelIteration": true
  },
  "exclude": [
    "**/dist/**/*.js",
    "**/dist/**/*.ts",
    "**/dist/**/*.vue"
  ],
  "include": [
    "./**/*.ts",
    "./**/*.d.ts",
    "./**/*.tsx",
    "./**/*.vue"
  ]
}

```

基本使用:

`uni-tsc [...files]`

输出类型:

`uni-tsc [...files] --declaration`


> 所有选项与 tsc 保持一致，所以输入 uni-tsc --help 获得更多配置说明。
