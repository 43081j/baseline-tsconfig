const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const {
  getCompatibleTsconfig,
  getBaselineTsconfig,
  getTimeline,
} = require("../dist/index.cjs");

describe("CommonJS and CLI support", () => {
  it("loads functions via CommonJS require()", () => {
    assert.equal(typeof getCompatibleTsconfig, "function");
    assert.equal(typeof getBaselineTsconfig, "function");
    assert.equal(typeof getTimeline, "function");

    const res = getCompatibleTsconfig({ targetYear: 2022, includeDom: false });
    assert.deepEqual(res, { target: "es2021", lib: ["es2022"] });
  });

  it("executes CLI with --target-year and --no-dom", () => {
    const cliPath = path.resolve(__dirname, "../dist/cli.cjs");
    const stdout = execFileSync(
      process.execPath,
      [cliPath, "--target-year", "2022", "--no-dom"],
      { encoding: "utf8" },
    );
    const parsed = JSON.parse(stdout);
    assert.deepEqual(parsed, { target: "es2021", lib: ["es2022"] });
  });

  it("executes CLI with --widely-available-on-date", () => {
    const cliPath = path.resolve(__dirname, "../dist/cli.cjs");
    const stdout = execFileSync(
      process.execPath,
      [cliPath, "--widely-available-on-date=2024-09-14"],
      { encoding: "utf8" },
    );
    const parsed = JSON.parse(stdout);
    assert.deepEqual(parsed, {
      target: "es2021",
      lib: ["es2022", "dom", "dom.iterable"],
    });
  });

  it("prints CLI help with --help", () => {
    const cliPath = path.resolve(__dirname, "../dist/cli.cjs");
    const stdout = execFileSync(process.execPath, [cliPath, "--help"], {
      encoding: "utf8",
    });
    assert.match(stdout, /Usage: baseline-tsconfig/);
  });
});
