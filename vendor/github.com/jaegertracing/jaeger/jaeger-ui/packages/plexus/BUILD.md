# Build Considerations: `./packages/plexus`

**Note:** File references are relative to `./packages/plexus`; `./` refers to `./packages/plexus`.

The package is implemented in TypeScript and must be compiled to JavaScript.

There are three build scenarios and one pre-step common to all of them.

Pre-step:

- Bundle `./src/LayoutManager/layout.worker.tsx` to a UMD module which can initialize a `WebWorker` from a `Blob` URL

Build scenarios:

- Production ES modules
  - **This is the project's default export as `./lib/index.js`.** This build is not bundled and therefore does not use Webpack.
- Production UMD module
- Webpack dev server
  - Runs `./demo/src/index.tsx` which has a few example graphs.

The pre-step, which they all require, is to bundle `./src/LayoutManager/layout.worker.tsx` via the `worker-loader` Webpack loader.

## Babel

Babel is used to transpile the TypeScript for all scenarios and the pre-step. See `babel.config.js` for specifics.

The production ES module build is not bundled and therefore does not use Webpack.

## Webpack

Webpack is used to:

- Bundle `./src/LayoutManager/layout.worker.tsx` so we can have a `WebWorker` without forcing folks to deal with an additional JavaScript asset
- Bundle the production UMD module
- Run the Webpack dev server during development

`./webpack-factory.js` is used to generate the Webpack configurations for each scenario.

## TypeScript `--emitDeclarationOnly`

Compiling TypeScript via Babel does not allow for type declarations to be generated. So, `tsc` is used with `./tsconfig.json` to generate the type defs.

This only applies to the ES module production build, output to `./lib`.

Note: `./tsconfig.json` does not extend `../../tsconfig.json`.

## Pre-step: `layout.worker`

`./src/LayoutManager/layout.worker.tsx` is intended to be loaded as a `WebWorker`. To be able to load it as a `Worker` without requiring an extra JS file, Webpack and the [`worker-loader`](https://github.com/webpack-contrib/worker-loader) loader are used to bundle it into a UMD module, `./src/LayoutManager/layout.worker.bundled.js`.

Within the UMD module, `layout.worker.tsx` (and everything bundled into it) is turned into a `Blob` URL that's used to initialize a `WebWorker`.

The resultant UMD module can be initialized as a class:

```ts
import LayoutWorker from './layout.worker.bundled';

const leWorker = new LayoutWorker();

leWorker.postMessage(...);
```

> It's all fun and games until type checking loses an eye.

To make sure we don't end up with an implicit `any`, `layout.worker.bundled.d.ts` provides a type declaration:

```ts
class LayoutWorker extends Worker { ... }
```

## `package.json`

### Scripts

- `build` — Generates the UMD bundle and ES module production builds
- `prepublishOnly` — Executed after `yarn install` is run in the project root; runs the `build` script
- `start` — Starts the Webpack dev server and watches all files, including `layout.worker`

The `_tasks/*` scripts are not intended to be run, directly.

- `_tasks/clean/*`
  - Remove generated files
- `_tasks/bundle-worker`
  - Generates the `layout.worker` UMD bundle
- `_tasks/build/*`
  - Generates the production ES and UMD builds
- `_tasks/dev-server`
  - Starts the Webpack dev server

### Dependencies (dev and otherwise)

#### `viz.js@1.8.1`

This specific version of [viz.js](https://github.com/mdaines/viz.js) is used to avoid a regression. Meanwhile, [looks like `2.x.x`](https://github.com/mdaines/viz.js/issues/120#issuecomment-389281407) has recovered a lot of ground; [GitHub ticket](https://github.com/jaegertracing/jaeger-ui/issues/339) to upgrade.

#### `jest@23.6.0`

Jest is not actually be used, yet. Present as a placeholder. ([Ticket](https://github.com/jaegertracing/jaeger-ui/issues/340))

## `.eslintrc.js`

Configures ESLint for TypeScript. ESLint is executed from the project root, but this file is merged with the project root `.eslintrc.js` and overrides where there is overlap.

`prettier/@typescript-eslint` needs to be last in the `extends` so it overrides the formatting rules from `plugin:@typescript-eslint/recommended`.

Uses [`@typescript-eslint/parser`](https://github.com/typescript-eslint/typescript-eslint/tree/master/packages/parser) as the parser.

The `tsconfigRootDir: '.'` refers to the project root because that is where ESLint is executed, from. And, the `tsconfig.json` referred to by `./.eslintrc.js` is that in the project root.
