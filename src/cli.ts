#!/usr/bin/env node

const { getCompatibleTsconfig } = require("./index.cjs");

const args = process.argv.slice(2);
const values: Record<string, any> = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (!arg) continue;

  if (arg === "-h" || arg === "--help") {
    values.help = true;
  } else if (arg === "--no-dom" || arg === "--include-dom=false") {
    values["include-dom"] = false;
  } else if (arg === "--include-dom" || arg === "--include-dom=true") {
    values["include-dom"] = true;
  } else if (arg === "--suppress-warnings") {
    values["suppress-warnings"] = true;
  } else if (arg.startsWith("--target-year=")) {
    values["target-year"] = arg.substring("--target-year=".length);
  } else if (arg === "--target-year") {
    values["target-year"] = args[++i];
  } else if (arg.startsWith("--widely-available-on-date=")) {
    values["widely-available-on-date"] = arg.substring(
      "--widely-available-on-date=".length,
    );
  } else if (arg === "--widely-available-on-date") {
    values["widely-available-on-date"] = args[++i];
  } else if (arg.startsWith("--override-last-updated=")) {
    values["override-last-updated"] = arg.substring(
      "--override-last-updated=".length,
    );
  } else if (arg === "--override-last-updated") {
    values["override-last-updated"] = args[++i];
  } else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }
}

if (values.help) {
  console.log(
    `
Get TypeScript tsconfig.json target and lib settings for Web Platform Baseline targets.

Usage: baseline-tsconfig [options]

Options:
      --target-year                   Pass a year between 2015 and the current year to get target and lib compatible
                                      with all Newly Available features as of the end of the year specified.
      --widely-available-on-date      Pass a date in the format 'YYYY-MM-DD' to get target and lib compatible with
                                      Widely Available on the specified date.
      --no-dom                        Exclude 'dom' and 'dom.iterable' from the returned lib array.
      --suppress-warnings             Suppress potential warnings about data staleness when using a recent cutoff date.
      --override-last-updated         Override the last updated timestamp for debugging purposes.
  -h, --help                          Show help

Examples:
  npx baseline-tsconfig
  npx baseline-tsconfig --target-year 2022
  npx baseline-tsconfig --widely-available-on-date 2025-01-01
  npx baseline-tsconfig --target-year 2024 --no-dom
`.trim(),
  );
  process.exit(0);
}

console.log(
  JSON.stringify(
    getCompatibleTsconfig({
      targetYear: values["target-year"]
        ? Number.parseInt(values["target-year"], 10)
        : undefined,
      widelyAvailableOnDate: values["widely-available-on-date"],
      includeDom: values["include-dom"],
      suppressWarnings: values["suppress-warnings"],
      overrideLastUpdated: values["override-last-updated"]
        ? Number.parseInt(values["override-last-updated"], 10)
        : undefined,
    }),
    null,
    2,
  ),
);
