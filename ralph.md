# @hebcal/core

A perpetual Jewish Calendar API written in TypeScript, targeting both browser
and Node.js as an ESM-only package. It builds with Rollup, type-checks with
`tsc`, lints with Oxlint/Prettier, and tests with Vitest; it depends on
`@hebcal/hdate` and `@hebcal/noaa` and uses `temporal-polyfill` for date math.

## Setup

Install dependencies:

    npm install

## Verification

Type-check and lint with `npm run lint` (runs `oxlint`, `prettier --check .`,
then `tsc -p tsconfig.nodenext.json`). Build the distributable with
`npm run build`. Run the test suite with `npm test` (this also rebuilds first
via the `pretest` hook).

<!-- RALPH_CHECK_COMMANDS
npm run lint
RALPH_CHECK_COMMANDS_END -->

<!-- RALPH_BUILD_COMMANDS
npm run build
RALPH_BUILD_COMMANDS_END -->

<!-- RALPH_REGRESSION_COMMANDS
npm test
RALPH_REGRESSION_COMMANDS_END -->
