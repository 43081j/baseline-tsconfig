import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { features as manifest } from "es-samples";
import { getCompatibleTsconfig, getTimeline } from "../dist/index.js";
import { getBaselineInfo } from "../scripts/create-timeline.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const targetRank = {
  es5: 5,
  es2015: 2015,
  es2016: 2016,
  es2017: 2017,
  es2018: 2018,
  es2019: 2019,
  es2020: 2020,
  es2021: 2021,
  es2022: 2022,
  es2023: 2023,
  es2024: 2024,
  es2025: 2025,
  esnext: 9999,
};

function normalizeEsVersion(esVer) {
  if (!esVer) return "";
  if (esVer.startsWith("ES5")) return "es5";
  return esVer.toLowerCase();
}

function isLibCovered(tsLib, returnedLibArray) {
  if (returnedLibArray.includes(tsLib)) return true;
  const prefix = tsLib.split(".")[0];
  const libYear = prefix === "es5" ? 5 : prefix === "esnext" ? 9999 : parseInt(prefix.slice(2), 10);
  const umbrella = returnedLibArray[0];
  const umbrellaYear =
    umbrella === "es5" ? 5 : parseInt(umbrella.slice(2), 10);
  return libYear <= umbrellaYear;
}

describe("es-samples manifest and TypeScript compiler verification", () => {
  const enriched = manifest.map((item) => {
    const info = getBaselineInfo(item.compatKey, item.webFeatureId, item.id);
    return {
      ...item,
      newlyAvailable: info.newlyAvailable,
    };
  });

  it("covers every es-samples feature tsLib and tsTarget accurately across all 30 timeline dates", () => {
    const timeline = getTimeline({ includeDom: false });
    assert.equal(timeline.length, 30);

    // Group defining features by tsLib
    const libMaxDates = new Map();
    for (const f of enriched) {
      if (!f.tsLib) continue;
      const libPrefix = f.tsLib.split(".")[0];
      const esNorm = normalizeEsVersion(f.esVersion);
      const isDefining =
        esNorm === libPrefix ||
        libPrefix === "esnext" ||
        (f.tsLib === "es2025.regexp" && f.id === "regexp-escape");
      if (!isDefining) continue;

      const prev = libMaxDates.get(f.tsLib);
      if (prev === null) continue;
      if (!f.newlyAvailable) {
        libMaxDates.set(f.tsLib, null);
      } else if (!prev || f.newlyAvailable > prev) {
        libMaxDates.set(f.tsLib, f.newlyAvailable);
      }
    }

    for (const entry of timeline) {
      for (const [libName, availableDate] of libMaxDates.entries()) {
        const covered = isLibCovered(libName, entry.lib);
        if (availableDate !== null && availableDate <= entry.date) {
          assert.ok(
            covered,
            `Expected ${libName} (available ${availableDate}) to be covered on ${entry.date}, got [${entry.lib.join(", ")}]`,
          );
        } else {
          assert.ok(
            !covered,
            `Expected ${libName} (available ${availableDate}) NOT to be covered on ${entry.date}, got [${entry.lib.join(", ")}]`,
          );
        }
      }
    }
  });

  it("downlevels syntax samples from es-samples before their Baseline date and preserves them natively on/after", () => {
    const samplesDir = path.dirname(require.resolve("es-samples/features.json"));

    const testCases = [
      {
        id: "arrow-function-definitions",
        beforeYear: 2016, // target: es5
        afterYear: 2017, // target: es2017
        nativePattern: /=>/,
      },
      {
        id: "exponentiation-operator",
        beforeYear: 2016, // target: es5 -> Math.pow
        afterYear: 2017, // target: es2017 -> **
        nativePattern: /\*\*/,
      },
      {
        id: "async-await",
        beforeYear: 2016, // target: es5 -> __awaiter
        afterYear: 2017, // target: es2017 -> async function
        nativePattern: /\basync\s+function\b/,
      },
      {
        id: "nullish-coalescing-operator",
        beforeYear: 2019, // target: es2017 -> !== null && !== void 0
        afterYear: 2020, // target: es2021 -> ??
        nativePattern: /\?\?/,
      },
      {
        id: "logical-assignment",
        beforeYear: 2019, // target: es2017
        afterYear: 2020, // target: es2021 -> ||= / &&= / ??=
        nativePattern: /\|\|=|&&=|\?\?=/,
      },
      {
        id: "class-static-initialization-blocks",
        beforeYear: 2022, // target: es2021 -> IIFE downlevel
        afterYear: 2023, // target: es2024 -> static {
        nativePattern: /\bstatic\s*\{/,
      },
    ];

    for (const tc of testCases) {
      const feat = enriched.find((f) => f.id === tc.id);
      assert.ok(feat, `Feature ${tc.id} not found`);
      const sampleCode = fs.readFileSync(
        path.join(samplesDir, feat.sampleFile),
        "utf8",
      );

      const beforeCfg = getCompatibleTsconfig({
        targetYear: tc.beforeYear,
        includeDom: false,
      });
      const afterCfg = getCompatibleTsconfig({
        targetYear: tc.afterYear,
        includeDom: false,
      });

      const outBefore = ts.transpileModule(sampleCode, {
        compilerOptions: {
          target: ts.ScriptTarget[beforeCfg.target.toUpperCase()],
          module: ts.ModuleKind.ESNext,
          removeComments: true,
        },
      }).outputText;

      const outAfter = ts.transpileModule(sampleCode, {
        compilerOptions: {
          target: ts.ScriptTarget[afterCfg.target.toUpperCase()],
          module: ts.ModuleKind.ESNext,
          removeComments: true,
        },
      }).outputText;

      assert.ok(
        !tc.nativePattern.test(outBefore),
        `Expected ${tc.id} to be downleveled at targetYear ${tc.beforeYear} (${beforeCfg.target})`,
      );
      assert.ok(
        tc.nativePattern.test(outAfter),
        `Expected ${tc.id} to be preserved natively at targetYear ${tc.afterYear} (${afterCfg.target})`,
      );
    }
  });
});
