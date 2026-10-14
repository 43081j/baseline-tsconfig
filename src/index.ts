import {
  lastUpdated,
  suffixesString,
  timelineString,
} from "./data/timeline.js";
import {
  BaselineTsconfigOptions,
  Options,
  TimelineEntry,
  TimelineOptions,
  TsconfigResult,
  TsTarget,
} from "./types.js";

export type {
  BaselineTsconfigOptions,
  Options,
  TimelineEntry,
  TimelineOptions,
  TsconfigResult,
  TsTarget,
};

const suffixes = suffixesString.split(",");
const timelineEntries = timelineString.split("|");

let hasWarned = false;

export function _resetHasWarned(): void {
  hasWarned = false;
}

const checkUpdate = (targetDate: Date, lastUpdatedOverride?: number): void => {
  if (
    hasWarned ||
    (typeof process !== "undefined" &&
      process.env &&
      (process.env.BROWSERSLIST_IGNORE_OLD_DATA ||
        process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ||
        process.env.BASELINE_TSCONFIG_IGNORE_OLD_DATA))
  ) {
    return;
  }

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const lastUpdatedToUse = lastUpdatedOverride ?? lastUpdated;

  if (targetDate > twoMonthsAgo && lastUpdatedToUse < twoMonthsAgo.getTime()) {
    console.warn(
      "[baseline-tsconfig] The data in this module is over two months old and you are targetting a recent feature cut off date of " +
        targetDate.toISOString().slice(0, 10) +
        ". To ensure accurate Baseline data, please update to the latest version of this module using the package manager of your choice." +
        "You can suppress these warnings using the environment variables `BROWSERSLIST_IGNORE_OLD_DATA=true`, `BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA=true`, or `BASELINE_TSCONFIG_IGNORE_OLD_DATA=true`, or by passing `suppressWarnings: true` when you call `getCompatibleTsconfig()`.",
    );
    hasWarned = true;
  }
};

const resolveAtCutoff = (cutoff: string, includeDom: boolean): TsconfigResult => {
  let target: TsTarget = "es5";
  let umbrella = "es5";
  let granular: string[] = [];

  for (let idx = 0; idx < timelineEntries.length; idx++) {
    const e = timelineEntries[idx]!;
    if (e.slice(0, 6) > cutoff) break;
    for (let i = 6; i < e.length; i += 3) {
      const c = e[i]!;
      const v = e.slice(i + 1, i + 3);
      if (c === "t") {
        target = ("es20" + v) as TsTarget;
      } else if (c === "u") {
        umbrella = "es20" + v;
        granular = granular.filter((g) => g.slice(4, 6) > v);
      } else {
        const y = c + v[0]!;
        granular.push(
          (y === "99" ? "esnext." : "es20" + y + ".") +
            suffixes[v.charCodeAt(1) - 97]!,
        );
      }
    }
  }

  const lib = [umbrella, ...granular.sort()];
  if (includeDom) {
    lib.push("dom", "dom.iterable");
  }
  return { target, lib };
};

/**
 * Returns TypeScript `tsconfig.json` `target` and `lib` values compatible with the specified Baseline target.
 * Defaults to Baseline Widely Available as of the current date (30 months prior to today).
 */
export function getCompatibleTsconfig(userOptions?: Options): TsconfigResult {
  const incoming = userOptions ?? {};
  const includeDom = incoming.includeDom ?? true;
  const suppressWarnings = incoming.suppressWarnings ?? false;

  let targetDate = new Date();

  if (
    incoming.widelyAvailableOnDate !== undefined &&
    incoming.targetYear !== undefined
  ) {
    throw new Error(
      "You cannot use targetYear and widelyAvailableOnDate at the same time.  Please remove one of these options and try again.",
    );
  } else if (incoming.widelyAvailableOnDate !== undefined) {
    targetDate = new Date(incoming.widelyAvailableOnDate);
  } else if (incoming.targetYear !== undefined) {
    targetDate = new Date(`${incoming.targetYear}-12-31T00:00:00.000Z`);
  }

  if (Number.isNaN(targetDate.getTime())) {
    throw new Error("Invalid target date provided.");
  }

  // Sets a cutoff date for feature interoperability 30 months before the stated date
  if (
    incoming.widelyAvailableOnDate !== undefined ||
    incoming.targetYear === undefined
  ) {
    targetDate.setUTCMonth(targetDate.getUTCMonth() - 30);
  }

  const targetYearNum = targetDate.getUTCFullYear();

  if (!suppressWarnings) {
    checkUpdate(targetDate, incoming.overrideLastUpdated);

    if (targetYearNum < 2015) {
      console.warn(
        new Error(
          "There are no browser versions compatible with Baseline before 2015.  You may receive unexpected results.",
        ),
      );
    }

    if (targetYearNum < 2002) {
      throw new Error(
        "None of the browsers in the core set were released before 2002.  Please use a date after 2002.",
      );
    }

    if (targetYearNum > new Date().getUTCFullYear()) {
      throw new Error(
        "There are no browser versions compatible with Baseline in the future",
      );
    }
  }

  const cutoff = targetDate.toISOString().slice(2, 10).replace(/-/g, "");
  return resolveAtCutoff(cutoff, includeDom);
}

export const getBaselineTsconfig = getCompatibleTsconfig;

/**
 * Returns the chronological timeline of all Baseline ECMAScript `target` and `lib` changes.
 */
export function getTimeline(userOptions?: TimelineOptions): TimelineEntry[] {
  const includeDom = userOptions?.includeDom ?? true;
  return timelineEntries.map((entry) => {
    const yymmdd = entry.slice(0, 6);
    const date = `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
    const { target, lib } = resolveAtCutoff(yymmdd, includeDom);
    return { date, target, lib };
  });
}

export default getCompatibleTsconfig;
