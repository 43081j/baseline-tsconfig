import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getCompatibleTsconfig,
  getBaselineTsconfig,
  getTimeline,
  _resetHasWarned,
} from "../dist/index.js";

describe("getCompatibleTsconfig", () => {
  beforeEach(() => {
    _resetHasWarned();
  });

  it("exports getCompatibleTsconfig, getBaselineTsconfig, and getTimeline", () => {
    assert.equal(typeof getCompatibleTsconfig, "function");
    assert.equal(typeof getBaselineTsconfig, "function");
    assert.equal(getCompatibleTsconfig, getBaselineTsconfig);
    assert.equal(typeof getTimeline, "function");
  });

  it("returns default Widely Available configuration with DOM libs included", () => {
    const result = getCompatibleTsconfig();
    assert.equal(typeof result.target, "string");
    assert.ok(result.target.startsWith("es"));
    assert.ok(Array.isArray(result.lib));
    assert.ok(result.lib.includes("dom"));
    assert.ok(result.lib.includes("dom.iterable"));
    // As of 2026 (30 months ago = 2024), target is es2024 and umbrella is es2022
    assert.equal(result.target, "es2024");
    assert.equal(result.lib[0], "es2022");
  });

  it("excludes dom and dom.iterable when includeDom: false is passed", () => {
    const withDom = getCompatibleTsconfig({ targetYear: 2022 });
    const withoutDom = getCompatibleTsconfig({
      targetYear: 2022,
      includeDom: false,
    });

    assert.deepEqual(withDom, {
      target: "es2021",
      lib: ["es2022", "dom", "dom.iterable"],
    });
    assert.deepEqual(withoutDom, {
      target: "es2021",
      lib: ["es2022"],
    });
  });

  it("returns accurate target and collapsed/granular lib values across targetYear 2015-2025", () => {
    // 2015: ES2015 generator/proxy/reflect not yet Baseline until 2016-09-20
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2015, includeDom: false }),
      {
        target: "es5",
        lib: [
          "es5",
          "es2015.collection",
          "es2015.core",
          "es2015.iterable",
          "es2015.promise",
          "es2015.symbol",
        ],
      },
    );

    // 2016: All ES2015 and ES2016 libs are Baseline -> collapses to es2016
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2016, includeDom: false }),
      {
        target: "es5",
        lib: ["es2016"],
      },
    );

    // 2017: async/await is Baseline (target: es2017), SharedArrayBuffer not yet -> es2016 + es2017.object, es2017.string
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2017, includeDom: false }),
      {
        target: "es2017",
        lib: ["es2016", "es2017.object", "es2017.string"],
      },
    );

    // 2018: Promise.prototype.finally becomes Baseline
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2018, includeDom: false }),
      {
        target: "es2017",
        lib: ["es2016", "es2017.object", "es2017.string", "es2018.promise"],
      },
    );

    // 2020: ES2018-ES2021 syntax is Baseline (target: es2021), SharedArrayBuffer still pending (2021-12-13)
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2020, includeDom: false }),
      {
        target: "es2021",
        lib: [
          "es2016",
          "es2017.object",
          "es2017.string",
          "es2018.asynciterable",
          "es2018.promise",
          "es2018.regexp",
          "es2019.array",
          "es2019.object",
          "es2019.string",
          "es2019.symbol",
          "es2020.bigint",
          "es2020.promise",
          "es2020.string",
          "es2021.promise",
          "es2021.string",
        ],
      },
    );

    // 2021: SharedArrayBuffer & Atomics become Baseline on 2021-12-13 -> collapses es2017..es2021 into 'es2021'!
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2021, includeDom: false }),
      {
        target: "es2021",
        lib: ["es2021", "es2022.error", "es2022.regexp"],
      },
    );

    // 2022: Object.hasOwn & Array.prototype.at become Baseline on 2022-03-14 -> collapses into 'es2022'
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2022, includeDom: false }),
      {
        target: "es2021",
        lib: ["es2022"],
      },
    );

    // 2023: class static blocks (2023-03-27) & RegExp /v flag (2023-09-18) -> target: es2024
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2023, includeDom: false }),
      {
        target: "es2024",
        lib: ["es2022", "es2023.array", "es2024.regexp", "es2024.string"],
      },
    );

    // 2024: ES2024 arraybuffer/collection/object/promise & ES2025 Set methods
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2024, includeDom: false }),
      {
        target: "es2024",
        lib: [
          "es2022",
          "es2023.array",
          "es2024.arraybuffer",
          "es2024.collection",
          "es2024.object",
          "es2024.promise",
          "es2024.regexp",
          "es2024.string",
          "es2025.collection",
        ],
      },
    );

    // 2025: WeakMap symbol keys (es2023.collection, 2025-12-09) & Atomics.waitAsync (es2024.sharedmemory, 2025-11-11)
    // and all ES2025 libs are Baseline -> collapses es2023..es2025 into 'es2025'!
    assert.deepEqual(
      getCompatibleTsconfig({ targetYear: 2025, includeDom: false }),
      {
        target: "es2024",
        lib: ["es2025", "esnext.sharedmemory", "esnext.typedarrays"],
      },
    );
  });

  it("subtracts 30 months when widelyAvailableOnDate is passed", () => {
    // 2024-09-14 minus 30 months = 2022-03-14 (exact date es2022 umbrella lib became Newly Available)
    assert.deepEqual(
      getCompatibleTsconfig({
        widelyAvailableOnDate: "2024-09-14",
        includeDom: false,
      }),
      {
        target: "es2021",
        lib: ["es2022"],
      },
    );

    // 2025-09-27 minus 30 months = 2023-03-27 (exact date target: es2022 became Newly Available)
    assert.deepEqual(
      getCompatibleTsconfig({
        widelyAvailableOnDate: "2025-09-27",
        includeDom: false,
      }),
      {
        target: "es2022",
        lib: ["es2022"],
      },
    );
  });

  it("throws when both targetYear and widelyAvailableOnDate are provided", () => {
    assert.throws(
      () =>
        getCompatibleTsconfig({
          targetYear: 2022,
          widelyAvailableOnDate: "2024-01-01",
        }),
      /You cannot use targetYear and widelyAvailableOnDate at the same time/,
    );
  });

  it("warns when targeting a cutoff before 2015 and throws before 2002 or in the future", () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args);
    try {
      const res = getCompatibleTsconfig({
        targetYear: 2014,
        includeDom: false,
      });
      assert.deepEqual(res, { target: "es5", lib: ["es5"] });
      assert.equal(warnings.length, 1);

      assert.throws(
        () => getCompatibleTsconfig({ targetYear: 2001 }),
        /None of the browsers in the core set were released before 2002/,
      );

      assert.throws(
        () =>
          getCompatibleTsconfig({
            targetYear: new Date().getUTCFullYear() + 1,
          }),
        /There are no browser versions compatible with Baseline in the future/,
      );
    } finally {
      console.warn = origWarn;
    }
  });

  it("warns when data is over two months old for a recent cutoff unless suppressed", () => {
    const thirtyMonthsFromNow = new Date();
    thirtyMonthsFromNow.setUTCMonth(thirtyMonthsFromNow.getUTCMonth() + 30);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);

    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(" "));
    try {
      _resetHasWarned();
      getCompatibleTsconfig({
        widelyAvailableOnDate: thirtyMonthsFromNow.toISOString().slice(0, 10),
        overrideLastUpdated: ninetyDaysAgo.getTime(),
      });
      assert.equal(warnings.length, 1);
      assert.match(
        warnings[0],
        /\[baseline-tsconfig\] The data in this module is over two months old/,
      );

      // Should not warn when suppressWarnings: true
      warnings.length = 0;
      _resetHasWarned();
      getCompatibleTsconfig({
        widelyAvailableOnDate: thirtyMonthsFromNow.toISOString().slice(0, 10),
        overrideLastUpdated: ninetyDaysAgo.getTime(),
        suppressWarnings: true,
      });
      assert.equal(warnings.length, 0);

      // Should not warn when BROWSERSLIST_IGNORE_OLD_DATA is set
      process.env.BROWSERSLIST_IGNORE_OLD_DATA = "true";
      _resetHasWarned();
      getCompatibleTsconfig({
        widelyAvailableOnDate: thirtyMonthsFromNow.toISOString().slice(0, 10),
        overrideLastUpdated: ninetyDaysAgo.getTime(),
      });
      assert.equal(warnings.length, 0);
      delete process.env.BROWSERSLIST_IGNORE_OLD_DATA;
    } finally {
      console.warn = origWarn;
      delete process.env.BROWSERSLIST_IGNORE_OLD_DATA;
    }
  });
});

describe("getTimeline", () => {
  it("returns chronological timeline entries with valid dates, targets, and libs", () => {
    const timeline = getTimeline({ includeDom: false });
    assert.ok(Array.isArray(timeline));
    assert.equal(timeline.length, 30);
    assert.deepEqual(timeline[0], {
      date: "2015-07-29",
      target: "es5",
      lib: ["es5", "es2015.iterable", "es2015.promise"],
    });
    assert.deepEqual(timeline[timeline.length - 1], {
      date: "2025-12-09",
      target: "es2024",
      lib: ["es2025", "esnext.sharedmemory", "esnext.typedarrays"],
    });

    for (let i = 1; i < timeline.length; i++) {
      assert.ok(
        timeline[i].date > timeline[i - 1].date,
        `Expected ${timeline[i].date} > ${timeline[i - 1].date}`,
      );
    }
  });
});
