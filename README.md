# baseline-tsconfig

Get appropriate TypeScript `tsconfig.json` `target` and `lib` values for any [Web Platform Baseline](https://web.dev/baseline) target, powered by the ECMAScript feature mappings from [`es-samples`](https://github.com/e18e/es-samples) and modeled after [`baseline-browser-mapping`](https://github.com/web-platform-dx/baseline-browser-mapping).

## Installation

```bash
npm install --save-dev baseline-tsconfig
```

## Usage

### Default (Baseline Widely Available)

Calling `getCompatibleTsconfig()` with no arguments returns the `target` and `lib` values compatible with **Baseline Widely Available** as of today (30 months after Baseline Newly Available):

```js
import { getCompatibleTsconfig } from "baseline-tsconfig";

const { target, lib } = getCompatibleTsconfig();
// {
//   target: "es2024",
//   lib: [
//     "es2022",
//     "es2023.array",
//     "es2024.collection",
//     "es2024.object",
//     "es2024.promise",
//     "es2024.regexp",
//     "es2024.string",
//     "dom",
//     "dom.iterable"
//   ]
// }
```

### Target a Baseline Year (`targetYear`)

Pass `targetYear` (`2015` through the current year) to get the `target` and `lib` settings for all ECMAScript features that were **Baseline Newly Available** by the end of that calendar year:

```js
import { getCompatibleTsconfig } from "baseline-tsconfig";

getCompatibleTsconfig({ targetYear: 2020 });
// {
//   target: "es2021",
//   lib: [
//     "es2016",
//     "es2017.object",
//     "es2017.string",
//     "es2018.asynciterable",
//     "es2018.promise",
//     "es2018.regexp",
//     "es2019.array",
//     "es2019.object",
//     "es2019.string",
//     "es2019.symbol",
//     "es2020.bigint",
//     "es2020.promise",
//     "es2020.string",
//     "es2021.promise",
//     "es2021.string",
//     "dom",
//     "dom.iterable"
//   ]
// }

getCompatibleTsconfig({ targetYear: 2022 });
// {
//   target: "es2021",
//   lib: ["es2022", "dom", "dom.iterable"]
// }
```

### Target Widely Available on a Specific Date (`widelyAvailableOnDate`)

Pass `widelyAvailableOnDate` (`YYYY-MM-DD`) to get the `target` and `lib` settings for features that reached **Baseline Widely Available** on that date:

```js
import { getCompatibleTsconfig } from "baseline-tsconfig";

getCompatibleTsconfig({ widelyAvailableOnDate: "2024-09-14" });
// {
//   target: "es2021",
//   lib: ["es2022", "dom", "dom.iterable"]
// }
```

### Exclude DOM Libraries (`includeDom: false`)

By default, `'dom'` and `'dom.iterable'` are included in the returned `lib` array. Pass `includeDom: false` for non-browser / pure ECMAScript environments:

```js
getCompatibleTsconfig({ targetYear: 2025, includeDom: false });
// {
//   target: "es2024",
//   lib: ["es2025", "esnext.sharedmemory", "esnext.typedarrays"]
// }
```

### Inspect the Full Timeline (`getTimeline`)

```js
import { getTimeline } from "baseline-tsconfig";

const timeline = getTimeline({ includeDom: false });
// [
//   { date: "2015-07-29", target: "es5", lib: ["es5", "es2015.iterable", "es2015.promise"] },
//   ...
//   { date: "2025-12-09", target: "es2024", lib: ["es2025", "esnext.sharedmemory", "esnext.typedarrays"] }
// ]
```

### CLI

```bash
npx baseline-tsconfig
npx baseline-tsconfig --target-year 2022
npx baseline-tsconfig --widely-available-on-date 2025-01-01
npx baseline-tsconfig --target-year 2024 --no-dom
```
