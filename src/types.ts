export type TsTarget =
  | "es5"
  | "es2015"
  | "es2016"
  | "es2017"
  | "es2018"
  | "es2019"
  | "es2020"
  | "es2021"
  | "es2022"
  | "es2023"
  | "es2024"
  | "es2025"
  | "esnext";

export interface Options {
  targetYear?: number;
  widelyAvailableOnDate?: string | number;
  includeDom?: boolean;
  suppressWarnings?: boolean;
  overrideLastUpdated?: number;
}

export type BaselineTsconfigOptions = Options;

export interface TsconfigResult {
  target: TsTarget;
  lib: string[];
}

export interface TimelineOptions {
  includeDom?: boolean;
}

export interface TimelineEntry {
  date: string;
  target: TsTarget;
  lib: string[];
}
