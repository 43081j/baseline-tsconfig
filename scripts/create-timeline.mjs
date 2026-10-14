import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { features as manifest } from "es-samples";
import { features } from "web-features";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../");
const timelineOutputPath = path.join(projectRoot, "src/data/timeline.js");

// Build reverse lookup map of BCD key -> { featId, status } (from es-samples/scripts/build-features.js)
const bcdToWfMap = new Map();
for (const [featId, feat] of Object.entries(features)) {
  if (feat.compat_features) {
    for (const ck of feat.compat_features) {
      bcdToWfMap.set(ck, {
        featId,
        feature: feat,
        status: feat.status?.by_compat_key?.[ck] || feat.status,
      });
    }
  }
}

export function getBaselineInfo(compatKey, webFeatureId, featureId) {
  if (
    compatKey === "javascript.statements.strict_mode" ||
    webFeatureId === "strict-mode"
  ) {
    return {
      resolvedWfId: "strict-mode",
      newlyAvailable: "2015-07-29",
    };
  }

  // Ensure ES2025 iterator-helpers resolves to iterator-methods rather than ES2015 iterators
  const effectiveCompatKey =
    featureId === "iterator-helpers" && compatKey === "javascript.builtins.Iterator"
      ? "javascript.builtins.Iterator.from"
      : compatKey;
  const effectiveWfId =
    featureId === "iterator-helpers" && webFeatureId === "iterators"
      ? "iterator-methods"
      : webFeatureId;

  let status = null;
  let resolvedWfId = effectiveWfId;

  if (bcdToWfMap.has(effectiveCompatKey)) {
    const bcd = bcdToWfMap.get(effectiveCompatKey);
    status = bcd.status;
    if (bcd.featId) resolvedWfId = bcd.featId;
  } else if (features[effectiveWfId] || features[`${effectiveWfId}s`]) {
    resolvedWfId = features[effectiveWfId] ? effectiveWfId : `${effectiveWfId}s`;
    status = features[resolvedWfId]?.status;
  }

  if (!status || status.baseline === false || !status.baseline_low_date) {
    return {
      resolvedWfId,
      newlyAvailable: null,
    };
  }

  return {
    resolvedWfId,
    newlyAvailable: status.baseline_low_date,
  };
}

function normalizeEsVersion(esVer) {
  if (!esVer) return "";
  if (esVer.startsWith("ES5")) return "es5";
  return esVer.toLowerCase();
}

export function buildTimelineData() {
  const enriched = manifest.map((item) => {
    const info = getBaselineInfo(item.compatKey, item.webFeatureId, item.id);
    return {
      ...item,
      newlyAvailable: info.newlyAvailable,
    };
  });

  // 1. Compute cumulative Baseline Newly Available dates for each tsTarget
  const distinctTargets = [
    "es5",
    "es2015",
    "es2016",
    "es2017",
    "es2018",
    "es2019",
    "es2020",
    "es2021",
    "es2022",
    "es2024",
  ];
  const targetDates = {};
  let prevTargetDate = "2015-07-29";

  for (const t of distinctTargets) {
    const matching = enriched.filter((f) => {
      if (f.tsTarget !== t) return false;
      // Module format is controlled by tsconfig "module", not language syntax "target"
      if (f.id === "es-modules") return false;
      return normalizeEsVersion(f.esVersion) === t;
    });

    let maxDate = prevTargetDate;
    let hasLimited = false;
    for (const f of matching) {
      if (!f.newlyAvailable) {
        hasLimited = true;
        break;
      }
      if (f.newlyAvailable > maxDate) {
        maxDate = f.newlyAvailable;
      }
    }
    if (!hasLimited) {
      prevTargetDate = maxDate;
      targetDates[t] = maxDate;
    }
  }

  // 2. Compute Baseline Newly Available date for each granular tsLib
  const byLib = {};
  for (const f of enriched) {
    if (!f.tsLib) continue;
    const libPrefix = f.tsLib.split(".")[0];
    const esNorm = normalizeEsVersion(f.esVersion);
    const isDefiningFeature =
      esNorm === libPrefix ||
      libPrefix === "esnext" ||
      (f.tsLib === "es2025.regexp" && f.id === "regexp-escape");
    if (!isDefiningFeature) continue;

    if (!byLib[f.tsLib]) byLib[f.tsLib] = [];
    byLib[f.tsLib].push(f.newlyAvailable);
  }

  const libDates = {};
  for (const [lib, dates] of Object.entries(byLib)) {
    if (dates.some((d) => !d)) continue;
    libDates[lib] = [...dates].sort().slice(-1)[0];
  }

  const umbrellaYears = [
    "es2015",
    "es2016",
    "es2017",
    "es2018",
    "es2019",
    "es2020",
    "es2021",
    "es2022",
    "es2023",
    "es2024",
    "es2025",
  ];
  const libsByYear = {};
  for (const y of umbrellaYears) {
    libsByYear[y] = Object.keys(libDates)
      .filter((l) => l.startsWith(y + "."))
      .sort();
  }

  function getConfigAtDate(date) {
    let target = "es5";
    for (const t of distinctTargets) {
      if (targetDates[t] && targetDates[t] <= date) {
        target = t;
      }
    }

    const supportedLibs = new Set(
      Object.keys(libDates).filter((l) => libDates[l] <= date),
    );

    let highestUmbrella = "es5";
    for (const y of umbrellaYears) {
      const subLibs = libsByYear[y];
      if (subLibs.length > 0 && subLibs.every((l) => supportedLibs.has(l))) {
        highestUmbrella = y;
      } else {
        break;
      }
    }

    const coveredPrefixes = new Set(["es5"]);
    if (highestUmbrella !== "es5") {
      for (const y of umbrellaYears) {
        coveredPrefixes.add(y);
        if (y === highestUmbrella) break;
      }
    }

    const remaining = [...supportedLibs]
      .filter((l) => !coveredPrefixes.has(l.split(".")[0]))
      .sort();

    return { target, lib: [highestUmbrella, ...remaining] };
  }

  const allDates = [
    ...new Set([...Object.values(targetDates), ...Object.values(libDates)]),
  ].sort();

  // Collect all unique granular suffixes that actually appear in delta events
  let prevTarget = "es5";
  let prevUmbrella = "es5";
  let prevGranular = new Set();
  const usedSuffixes = new Set();
  const rawSteps = [];

  for (const d of allDates) {
    const cfg = getConfigAtDate(d);
    const yymmdd = d.replace(/-/g, "").slice(2);
    const stepTokens = [];

    if (cfg.target !== prevTarget) {
      stepTokens.push({
        type: "t",
        yr: cfg.target === "es5" ? "05" : cfg.target.slice(4),
      });
      prevTarget = cfg.target;
    }

    const newUmbrella = cfg.lib[0];
    if (newUmbrella !== prevUmbrella) {
      stepTokens.push({
        type: "u",
        yr: newUmbrella === "es5" ? "05" : newUmbrella.slice(4),
      });
      prevUmbrella = newUmbrella;
      const umbNum =
        newUmbrella === "es5" ? 5 : parseInt(newUmbrella.slice(4), 10);
      for (const g of [...prevGranular]) {
        const gPrefix = g.split(".")[0];
        const gNum = gPrefix === "esnext" ? 99 : parseInt(gPrefix.slice(4), 10);
        if (gNum <= umbNum) prevGranular.delete(g);
      }
    }

    for (const g of cfg.lib.slice(1)) {
      if (!prevGranular.has(g)) {
        prevGranular.add(g);
        const dotIdx = g.indexOf(".");
        const prefix = g.slice(0, dotIdx);
        const suffix = g.slice(dotIdx + 1);
        const yr = prefix === "esnext" ? "99" : prefix.slice(4);
        usedSuffixes.add(suffix);
        stepTokens.push({ type: "l", yr, suffix });
      }
    }

    if (stepTokens.length > 0) {
      rawSteps.push({ yymmdd, stepTokens });
    }
  }

  const suffixesList = [...usedSuffixes].sort();
  const compactEntries = rawSteps.map(({ yymmdd, stepTokens }) => {
    const encoded = stepTokens
      .map((tok) => {
        if (tok.type === "t") return `t${tok.yr}`;
        if (tok.type === "u") return `u${tok.yr}`;
        const suffixCode = String.fromCharCode(
          97 + suffixesList.indexOf(tok.suffix),
        );
        return `${tok.yr}${suffixCode}`;
      })
      .join("");
    return `${yymmdd}${encoded}`;
  });

  return {
    suffixesString: suffixesList.join(","),
    timelineString: compactEntries.join("|"),
    lastUpdated: Date.now(),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const { suffixesString, timelineString, lastUpdated } = buildTimelineData();
  fs.mkdirSync(path.dirname(timelineOutputPath), { recursive: true });
  const fileContent =
    `export const suffixesString = ${JSON.stringify(suffixesString)};\n` +
    `export const timelineString = ${JSON.stringify(timelineString)};\n` +
    `export const lastUpdated = ${lastUpdated};\n`;
  fs.writeFileSync(timelineOutputPath, fileContent, "utf8");
  console.log(
    `✔ Generated src/data/timeline.js (${timelineString.length} bytes timelineString, ${suffixesString.length} bytes suffixesString).`,
  );
}
