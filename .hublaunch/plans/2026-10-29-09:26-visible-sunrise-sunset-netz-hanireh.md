# Add visible sunrise / visible sunset (netz ha-nireh) to `@hebcal/core`

## Plan Summary

- **What / why:** Add `Zmanim.visibleSunrise()` / `visibleSunset()` (plus aliases `neitzHaNireh` / `shkiahNireit`) that compute the moment the sun's upper limb first appears over (or last disappears behind) the real terrain horizon described by a caller-supplied **horizon profile**, resolving upstream issue "Netz HaNireh". This is a purely additive change — no existing result changes.
- **Key decisions:** The caller supplies the horizon profile (constant / sample list / function); the library never fetches or parses terrain data (out of scope). Refraction is Sinclair below 15° and Bennett at/above 15° at standard atmosphere (1010 hPa / 10 °C), matching the Chai Tables. `useElevation` is deliberately ignored (the profile is measured from the observer's eye position). No cushion/safety margin is added. The algorithm relies on two existing `@hebcal/noaa` behaviors that are robustly handled by normalisation + a tiny guard (decision confirmed: proceed as specified — see Assumptions).
- **Most important files:** new `src/horizon.ts` (helpers), `src/zmanim.ts` (four new methods), `src/index.ts` (two type-only exports), new `test/horizon.spec.ts`, appended cases in `test/zmanim.spec.js`, `test/docexamples.spec.ts`, and one `README.md` paragraph.
- **Priority / complexity:** Medium complexity (the solar/refraction/search arithmetic is subtle), low risk (additive only; a large set of exact reference values pins correctness).

## Problem Statement

`@hebcal/core`'s `sunrise()` / `sunset()` compute the instant the sun's upper edge crosses the **flat sea-level horizon** (geometric zenith 90°, i.e. the standard 0.833° refraction+semidiameter model). In mountainous locations — most of Israel — the sun is actually first *seen* (netz ha-nireh, הנץ הנראה) noticeably later, when its upper limb clears the real terrain ridge line to the east, and is last seen earlier in the west. Many printed Israeli calendars list this "visible" time alongside the standard one. Upstream issue #420 asks for it; the KosherJava maintainer noted the calculation is complex and requires terrain data, and invited a contribution.

This change adds the solar/refraction/search arithmetic to the library while keeping terrain data *out* of the library: the caller passes a **horizon profile** (the apparent angular altitude of the skyline as a function of compass azimuth), and the library returns the visible sunrise/sunset time. Building a profile from a digital elevation model is a separate tool and is explicitly out of scope.

#### Planning Context

**Key requirements**

- New module `src/horizon.ts` with unit-testable exported helpers: `HorizonSample`, `HorizonProfile`, `horizonElevation()`, `refractionAtApparentAltitude()`, `SOLAR_SEMIDIAMETER`, `upperLimbApparentAltitude()`.
- Four new methods on `Zmanim` beside `sunrise()`/`sunset()`/`neitzHaChama()`/`shkiah()`: `visibleSunrise(horizon)`, `visibleSunset(horizon)`, and the aliases `neitzHaNireh(horizon)` / `shkiahNireit(horizon)`.
- Type-only exports of `HorizonProfile` and `HorizonSample` from `src/index.ts` (not the helper functions).
- New `test/horizon.spec.ts`; reference-value cases appended to `test/zmanim.spec.js`; a `docexamples` entry only if an `@example` is actually written and executed.
- One short README paragraph after the `useElevation` paragraph.

**Decisions made (with rationale)**

- **Caller supplies the profile; no terrain code.** The library targets browser and Node and cannot bundle a DEM. Keeping the profile as an input (constant | samples | function) makes the feature usable everywhere and keeps the change small. (Rationale from the binding spec, `input.md:89-91`.)
- **Refraction model = Sinclair (a < 15°) + Bennett (a ≥ 15°) at 1010 hPa / 10 °C.** This is what the Chai Tables (chaitables.com; Keller & Hall 2000/2022) use, so results match the de-facto reference most Israeli calendars follow. (`input.md:101-104`.)
- **`useElevation` is ignored by the new methods.** The profile is measured from the observer's actual eye position, so the observer's height is already baked into the profile angles; applying the library's sea-level-vs-elevation adjustment on top would double-count. Documented in the doc comment. (`input.md:114`.)
- **No cushion / safety margin.** Calendars add their own (the Chai Tables add 15–20 s and round up to 5 s). The library returns the raw computed instant and says so in one sentence of doc comment. (`input.md:138`.)
- **Proceed as specified on the two `@hebcal/noaa` dependencies** (Q1 answer = A): (1) the azimuth normalisation `az = ((raw % 180) + 180) % 180; if (!rising) az += 180` yields the same value whether `getSolarAzimuth` is correct only modulo-180 (today) or fully correct (a future release), because a correct morning azimuth is already in (0°,180°) and a correct evening azimuth in (180°,360°) maps to itself; a helper unit test asserts this normalisation is a no-op for already-correct inputs. (2) The `zenith === 90 ? 90 + 1e-9` guard only matters when the scan lands on a centre altitude of exactly 0°, and 1e-9° is far below the 0.0005° bisection tolerance, so it is harmless if a future noaa stops auto-adjusting at exactly 90°. Both keep the explanatory comments the spec asks for. Do **not** reimplement solar position or add a dependency. (`input.md:258-270`.)

**Out of scope**

- Any DEM/terrain fetching or parsing; any CLI; any network code.
- Changes to `Location`, `CalOptions`, `HebrewCalendar.calendar()`, candle-lighting, or `@hebcal/noaa`.
- Changing any existing result or any existing method (`sunrise()`, `seaLevelSunrise()`, `sunset()`, `neitzHaChama()`, `shkiah()`, etc. stay untouched).
- Creating `.hublaunch/goals.md` or any file outside the change (Q2 answer = C).
- Writing the upstream issue/PR number (`#420`, "Closes #420", etc.) in any commit message, branch name, or PR text on this fork.

## Detailed Requirements

### Functional

1. `visibleSunrise(horizon)` returns the `Date` (seconds precision, ms discarded) at which the sun's upper limb, with refraction, first rises above the terrain profile in the morning; `Invalid Date` when there is no crossing that day (polar night/day, or the sun never clears the profile).
2. `visibleSunset(horizon)` returns the symmetric evening time (last moment the limb is visible); `Invalid Date` on no crossing.
3. `neitzHaNireh(horizon)` is an alias of `visibleSunrise`; `shkiahNireit(horizon)` is an alias of `visibleSunset` — mirroring `neitzHaChama()`→`sunrise()` and `shkiah()`→`sunset()` at `src/zmanim.ts:534,540`.
4. A `HorizonProfile` may be a constant number (same elevation in every direction), a non-empty list of `{azimuth, elevation}` samples in any order/spacing with azimuths in [0, 360), or a function `(azimuth: number) => number`.
5. `horizonElevation(profile, azimuth)` resolves the profile at one azimuth: constant → itself; function → `profile(azimuth)`; samples → linear interpolation between the two neighbouring samples by azimuth, wrapping around 360°/0°; a single sample behaves as a constant. Throws `TypeError` for an empty sample array or a non-finite constant.
6. `refractionAtApparentAltitude(a)`, `SOLAR_SEMIDIAMETER`, and `upperLimbApparentAltitude(a)` behave exactly as the formulas below specify.
7. `useElevation` has no effect on any of the four new methods.

### Technical

- Use only the public `NOAACalculator` API already wrapped by `Zmanim` (`this.noaa`, `this.gloc`): `getUTCSeaLevelSunrise`/`getUTCSeaLevelSunset`, `getEpochMillisFromTime`, `getSolarAzimuth`. No new dependency; no reimplementation of solar position.
- ESM only; every relative import carries an explicit `.js` extension (CLAUDE.md). `src/horizon.ts` imports nothing from noaa directly — it is pure arithmetic; `src/zmanim.ts` imports the helpers it needs from `./horizon.js`.
- Prettier/oxlint conventions: no bracket spacing, single quotes, es5 trailing commas, no parens on single-arg arrows.
- `TypeError` for bad arguments is the repo idiom (`src/getStartAndEnd.ts:13`, `src/sedra.ts:193`, `src/event.ts:149`). Use it; do **not** use `RangeError` (that is reserved for out-of-range values, `src/location.ts:157`).

### Non-Functional

- ~250 evaluations of `getUTCSeaLevelSunrise` + `getSolarAzimuth` per call is acceptable; do **not** cache.
- No `@example` output may be stated unless executed and mirrored in `test/docexamples.spec.ts` (CLAUDE.md). Keep the typedoc warning baseline at 7 — no new `src/` warnings, valid `{@link}` targets.
- The full existing vitest suite must still pass unchanged; `npm run lint` and `npm run check:types` must pass.

## Proposed Solution

`src/horizon.ts` holds the pure arithmetic (profile resolution, refraction, upper-limb apparent altitude). `Zmanim` gains four thin methods that drive a monotonic scan over the sun's geometric centre altitude, using noaa for the time-of-altitude and azimuth-at-time mappings, and the horizon helpers for the "is it visible yet" test.

```
visibleSunrise(profile) / visibleSunset(profile)
        │
        ├─ scan a (geometric centre altitude) from −2.5° to +10° step 0.05°
        │        │
        │        ├─ timeAt(a):  zenith = 90 − a  (guard: 90 → 90+1e-9)
        │        │              noaa.getUTCSeaLevelSunrise/Sunset(zenith)
        │        │              → noaa.getEpochMillisFromTime(utc, rising)   [NaN ⇒ Invalid Date]
        │        ├─ azimuthAt(t): noaa.getSolarAzimuth(UTC ZonedDateTime,lat,lon)
        │        │               → normalise mod 180, +180 if !rising
        │        └─ g(a) = upperLimbApparentAltitude(a)            (src/horizon.ts)
        │                 − horizonElevation(profile, azimuthAt(timeAt(a)))  (src/horizon.ts)
        │
        └─ first step where g crosses <0 → ≥0, bisect to 0.0005°, return timeAt(hi)
```

The sun is visible when `g ≥ 0`. Altitude is monotonic in time near rise/set, so scanning altitude upward from −2.5° and taking the **first** `g ≥ 0` crossing gives, for sunrise, the first moment the limb is seen, and for sunset (same upward scan with `rising = false`, which makes `timeAt` return the afternoon crossing and azimuths fall in the west), the last moment the limb is seen.

<details><summary><b>Implementation Detail</b></summary>

### Edge Cases

- **No crossing by `aHi` (10°):** sun never clears the profile that day → `Invalid Date`.
- **`timeAt` returns `NaN` anywhere (polar day/night):** → `Invalid Date`. Evaluate `g(aLo)` first so this is caught immediately; the Tromsø cases exercise it.
- **`g(aLo) ≥ 0` already** (profile effectively below −2.5°, essentially impossible for a real horizon): return `timeAt(aLo)`.
- **`zenith === 90` exactly** (scan lands on centre altitude 0°): use `90 + 1e-9`, because `NOAACalculator.adjustZenith` silently adds refraction+semidiameter when the zenith is exactly 90°, which would corrupt the geometric-altitude mapping. 1e-9° is far below the 0.0005° tolerance, so it is harmless and future-proof. Keep the explanatory comment.
- **`getSolarAzimuth` quadrant:** its result is only correct modulo 180° (it uses `atan` without quadrant resolution). Normalise `az = ((raw % 180) + 180) % 180; if (!rising) az += 180;` so morning azimuths lie in (0°,180°) and evening in (180°,360°). Keep the explanatory comment. This normalisation is a no-op for already-correct inputs (unit-tested), so it is robust to a future noaa fix.
- **Empty sample array / non-finite constant:** `horizonElevation` throws `TypeError`.
- **Single sample / wrap-around:** a single sample is a constant; interpolation wraps across 360°/0° (e.g. samples at 350° and 10°, query 0° → midpoint).

### `src/horizon.ts` — exact contents

Module comment (typedoc markdown, no HTML, `°` not `&deg;`): cite the method — "Keller & Hall, _Using a digital terrain model to calculate visual sunrise and sunset times_, Computers & Geosciences 26 (2000); the Chai Tables, chaitables.com" — note refraction is Sinclair/Bennett at standard atmosphere, the upper-limb convention, and that no cushion is added.

```ts
export interface HorizonSample {
  azimuth: number;   // degrees clockwise from true north: 0=N, 90=E, 180=S, 270=W
  elevation: number; // apparent angular altitude of the highest obstruction in that
                     // direction, degrees above the observer's astronomical horizon
                     // (negative where the horizon is below it, e.g. sea dip from a height)
}

export type HorizonProfile =
  | number
  | readonly HorizonSample[]
  | ((azimuth: number) => number);

export function horizonElevation(profile: HorizonProfile, azimuth: number): number;
export function refractionAtApparentAltitude(apparentAltitude: number): number;
export const SOLAR_SEMIDIAMETER = 16 / 60; // degrees; matches @hebcal/noaa
export function upperLimbApparentAltitude(centerGeometricAltitude: number): number;
```

- `horizonElevation`: constant → itself (throw `TypeError` if non-finite); function → `profile(azimuth)`; samples → throw `TypeError` if empty; single sample → that sample's elevation; otherwise sort a *copy* by azimuth once and linearly interpolate between the two neighbouring samples by azimuth, wrapping around 360°/0°.
- `refractionAtApparentAltitude(a)` with `P = 1010`, `T = 10`:
  - `a < 15`: `R = (P / (T + 273)) * (0.1594 + 0.0196*a + 0.00002*a*a) / (1 + 0.505*a + 0.0845*a*a)` degrees. Sanity: a=0 → 0.5689°, a=1 → 0.4020°, a=3 → 0.2379°.
  - `a ≥ 15`: `R = (1/60) * (P/1010) * (283/(273+T)) / tan((a + 7.31/(a + 4.4)) * π/180)` degrees. = 0.0607° at a=15.
- `upperLimbApparentAltitude(a)`: solve `β = a + SOLAR_SEMIDIAMETER + refractionAtApparentAltitude(β)` by fixed-point iteration — start `β = a + SOLAR_SEMIDIAMETER + R(a + SOLAR_SEMIDIAMETER)`, then iterate 4 times. `upperLimbApparentAltitude(-0.8333) ≈ 0` (the sea-level sunrise definition).

### `src/zmanim.ts` — the four methods

Place beside `sunrise()`/`sunset()`/`neitzHaChama()`/`shkiah()`. Import the helpers from `./horizon.js` at the top of the file alongside the existing `./zenith.js` import.

```ts
visibleSunrise(horizon: HorizonProfile): Date { return this.visibleSunMillis(horizon, true); }
visibleSunset(horizon: HorizonProfile): Date  { return this.visibleSunMillis(horizon, false); }
neitzHaNireh(horizon: HorizonProfile): Date   { return this.visibleSunrise(horizon); }  // alias
shkiahNireit(horizon: HorizonProfile): Date   { return this.visibleSunset(horizon); }   // alias
```

Implement the shared search in a private helper (name it in the surrounding style, e.g. `visibleSunMillis`, returning a `Date` via `millisToDate()` or an `Invalid Date` — mirror `beinHaShmashos()`'s NaN-date return at `src/zmanim.ts:551-558`). The helper encodes:

- `timeAt(a)`: `let zenith = 90 - a; if (zenith === 90) zenith = 90 + 1e-9;` then `const utc = rising ? this.noaa.getUTCSeaLevelSunrise(zenith) : this.noaa.getUTCSeaLevelSunset(zenith); return this.noaa.getEpochMillisFromTime(utc, rising);` — the same path `sunriseMillis()`/`sunsetMillis()` use (`src/zmanim.ts:157-171`), so results stay consistent with `seaLevelSunrise()`. `NaN` ⇒ no such altitude that day.
- `azimuthAt(t)`: `const zdt = Temporal.Instant.fromEpochMilliseconds(t).toZonedDateTimeISO('UTC'); let az = NOAACalculator.getSolarAzimuth(zdt, lat, lon);` — the zone **must** be `'UTC'` because the helper reads `.hour/.minute/.second` as UTC. Then `az = ((az % 180) + 180) % 180; if (!rising) az += 180;` with the quadrant comment. (`lat`/`lon` from `this.gloc`.)
- `g(a) = upperLimbApparentAltitude(a) - horizonElevation(horizon, azimuthAt(timeAt(a)))`.
- Scan `a` from `aLo = -2.5` to `aHi = 10` in steps of `0.05`. Evaluate `g(aLo)` first; if any `timeAt` is `NaN`, return `Invalid Date`. If `g(aLo) >= 0`, return `millisToDate(timeAt(aLo))`. Otherwise advance until `g` goes `< 0 → ≥ 0`; bisect that altitude bracket until its width is below `0.0005°`, and return `millisToDate(timeAt(hi))` of the bracket. If no crossing by `aHi`, return `Invalid Date`.

Doc comments (typedoc markdown): mention Keller & Hall + the Chai Tables, Sinclair/Bennett refraction at standard atmosphere, the upper-limb convention, that `useElevation` is ignored and *why* (profile measured from the observer's eye position, including terrestrial refraction and Earth curvature; a sea horizon seen from a height is a negative angle), and that no cushion is added. On the aliases use the short "Alias for …" style of `neitzHaChama()`/`shkiah()` (`src/zmanim.ts:531-542`).

An `@example` on `visibleSunrise` (a few Tiberias samples) is optional — include it **only** if executed and added to `test/docexamples.spec.ts`; otherwise write none.

### `src/index.ts`

Add, in the existing type-only style (`export {type CalOptions, type DailyLearningValue} from './CalOptions.js';` at `src/index.ts:14`):

```ts
export {type HorizonProfile, type HorizonSample} from './horizon.js';
```

Do not export the helper functions.

### Testing Strategy

**`test/horizon.spec.ts` (new, `.ts`)** — unit tests for the helpers:
- `horizonElevation`: constant; function; interpolation midway between two samples; wrap-around (samples at 350° and 10°, query 0° → midpoint); unsorted input; single sample; empty array throws `TypeError`.
- `refractionAtApparentAltitude`: `(0)` ≈ 0.5689, `(1)` ≈ 0.4020, `(15)` ≈ 0.0607 (`toBeCloseTo`, 4 places); continuity: `(14.999)` and `(15)` within 0.002.
- `upperLimbApparentAltitude(-0.8333)` ≈ 0 ± 0.01.
- Azimuth-normalisation no-op: assert `((az % 180) + 180) % 180` (plus the `+180` evening branch) returns already-correct morning/evening azimuths unchanged — the robustness check Q1 asked for. (If the normalisation is inlined in `zmanim.ts` rather than a named helper, assert the arithmetic identity directly in this spec with a short local function so the invariant is still pinned.)

**`test/zmanim.spec.js` (append cases; it is `.js`, not `.ts`)** — format with `Zmanim.formatISOWithTimeZone` like the existing suite. Define `TIBERIAS_EAST` and `RECHOVOT_EAST` as constants (map the `[az,el]` pairs to `{azimuth, elevation}` objects). Expected values to assert to the second (a 1–2 s bisection/rounding difference is acceptable — then assert the actually-computed value and note which differed in the PR body; anything larger is a bug):

- Tiberias `new GeoLocation(null, 32.79, 35.53, 0, 'Asia/Jerusalem')`, `TIBERIAS_EAST`, `visibleSunrise`:
  - 2026-11-24 → `2026-11-24T06:27:32+02:00`
  - 2027-06-09 → `2027-06-09T05:37:29+03:00`
  - 2027-03-26 → `2027-03-26T06:43:29+03:00`
- Rechovot `new GeoLocation(null, 31.8928, 34.8113, 0, 'Asia/Jerusalem')`, `RECHOVOT_EAST`:
  - 2019-11-24 → `2019-11-24T06:24:15+02:00`
- Chicago (`makeZman()` fixture, 2020-06-05):
  - constant `0` → sunrise `2020-06-05T05:16:17-05:00`, sunset `2020-06-05T20:22:30-05:00`
  - constant `1` → sunrise `05:23:37-05:00`, sunset `20:15:09-05:00`
  - constant `-0.5` → sunrise `05:12:18-05:00`
  - `az => az < 90 ? 2 : 0.5` → sunrise `05:30:27-05:00`; `az => az < 270 ? 2 : 0.5` → sunset `20:18:44-05:00`
- Tromsø `new GeoLocation(null, 69.65, 18.96, 0, 'Europe/Oslo')`, constant 0, 2020-12-21 and 2020-06-21 → `Invalid Date` (assert `Number.isNaN(date.getTime())`).
- Denver (`makeZmanWithElevation()` fixture, `useElevation=true`, elevation 1636), constant 0, 2020-06-05 → sunrise `2020-06-05T05:32:25-06:00`, i.e. equal (±1 s) to `seaLevelSunrise()` and **not** to `sunrise()` — proves `useElevation` is ignored.

**`test/docexamples.spec.ts`** — add a case only if a `visibleSunrise` `@example` is written; it already imports `Zmanim` and `GeoLocation` (`test/docexamples.spec.ts:14,23`).

**Manual / commands:** `npm run build` (generates `src/*.json.ts`, version, rollup), `npm test` (pretest builds, then vitest), `npm run lint` (`oxlint`, `prettier --check`, `tsc -p tsconfig.nodenext.json`). Spot-check `npm run docs` stays at 7 warnings with none naming `src/horizon.ts` or `src/zmanim.ts`.

### Documentation Updates

- `README.md`: after the paragraph beginning "Set `options.useElevation = true`" (`README.md:239-242`), insert one 3–5 sentence paragraph introducing `visibleSunrise()`/`visibleSunset()`: they take a horizon profile (constant angle, list of azimuth/elevation samples, or a function of azimuth) giving the apparent altitude of the skyline in each direction; they return when the sun's upper limb clears that real horizon rather than the flat sea-level one; building a profile from terrain/DEM data is outside the library. No marketing, no links beyond the typedoc-page pattern already used in that section (`README.md:244-245`).
- Doc comments on the new module and methods as specified above.

### Technical Considerations

- **Dependencies:** none added. `@hebcal/noaa ^0.12.4` (`package.json:94`) already provides every method used. `node_modules` is not installed in this sandbox — see Assumptions; the dependency surface is taken as authoritative from the spec.
- **Config/security:** no CI, release, licence, funding, or security file is touched. No new runtime config.
- **Build:** `src/horizon.ts` is an ordinary source module; rollup and the `.d.ts` emit pick it up automatically. The two new type exports flow through `src/index.ts`.
- **`@hebcal/noaa` behavior reliance:** handled robustly (modulo-180 normalisation + 1e-9 guard) per the Q1 decision; comments explain both. Do not reimplement solar position.

### Acceptance Criteria

1. `src/horizon.ts` exists and exports `HorizonSample`, `HorizonProfile`, `horizonElevation`, `refractionAtApparentAltitude`, `SOLAR_SEMIDIAMETER`, `upperLimbApparentAltitude` with the documented behavior, including `TypeError` on empty array / non-finite constant.
2. `Zmanim` has `visibleSunrise`, `visibleSunset`, `neitzHaNireh`, `shkiahNireit`; the aliases delegate; `useElevation` has no effect (Denver case proves it).
3. `src/index.ts` type-exports `HorizonProfile` and `HorizonSample` only.
4. All reference values above reproduce to the second (or within 1–2 s with the computed value asserted and noted in the PR body).
5. Tromsø polar cases return `Invalid Date`.
6. `test/horizon.spec.ts` covers every helper case listed, including the azimuth-normalisation no-op.
7. README paragraph added in the right place; doc comments cite Keller & Hall / Chai Tables, Sinclair/Bennett, upper limb, `useElevation` ignored, no cushion.
8. `npm run lint`, `npm run check:types`, and `npm test` all pass; no existing result changed; typedoc warnings stay at 7 with none naming `src/`.
9. No `@example` output is stated that is not executed and mirrored in `test/docexamples.spec.ts`.
10. No upstream issue/PR number appears in any commit message, branch name, or PR text; no file outside the change is created or modified.

### Dependencies & Related Work

- Branch from `main`; the PR targets `main`; one logical change.
- Upstream issue #420 ("Netz HaNireh"); Keller & Hall, _Computers & Geosciences_ 26 (2000) and 2022; the Chai Tables (chaitables.com). These are cited in doc comments but the issue number is never written on the fork.

</details>

## Assumptions

- **Current checkout matches the snapshot commit `4a927a06fb6459339dad4af5fb55d8e22840183d` exactly** — verified during planning (`git rev-parse HEAD`). All cited `file:line` references (`src/zmanim.ts:23,157-171,176-199,531-542,551-558`, `src/index.ts:14`, `test/zmanim.spec.js:6-25`, `test/docexamples.spec.ts:14,23`, `README.md:239-245`, `package.json:94`) were re-read and confirmed. No drift to flag.
- **`@hebcal/noaa` methods behave as the spec describes** (`getUTCSeaLevelSunrise`/`getUTCSeaLevelSunset`, `getEpochMillisFromTime`, `getSolarAzimuth`, and `adjustZenith`'s exact-90° auto-adjustment). `node_modules` is not installed in this sandbox, so the dependency surface could not be exercised directly; `package.json:94` pins `^0.12.4` and the spec is authoritative. The implementer should confirm against the installed package when building.
- **Reference-value cases are appended to the existing `test/zmanim.spec.js` (JS)**, matching the spec's explicit `test/zmanim.spec.js` reference, rather than creating a new `.ts` file. `test/horizon.spec.ts` is new and `.ts` per the repo's `.spec.ts` convention.
- **An `@example` on `visibleSunrise` is written only if executed and mirrored in `test/docexamples.spec.ts`;** otherwise none is written (the spec makes it optional).
- **Reference values are asserted as given;** where bisection/rounding yields a 1–2 s difference, the implementer asserts the actually-computed value and notes which values differed in the PR body (`input.md:144`).
- **Only the two types** (`HorizonProfile`, `HorizonSample`) are exported from the package index; the helper functions stay module-internal, exported from `src/horizon.ts` only for unit tests (`input.md:116`).
- **Proceed as specified on the two noaa behaviors** (Q1 = A): keep the modulo-180 azimuth normalisation and the `90 + 1e-9` guard with their explanatory comments, add the normalisation no-op unit test, do not reimplement solar position, do not add a dependency.
- **Do not create `.hublaunch/goals.md`** or any file outside the change (Q2 = C).
- **No new dependency; no CI/release/licence/funding/security edits; no changes to `Location`/`CalOptions`/`HebrewCalendar.calendar()`/candle-lighting/`@hebcal/noaa`;** branch from and target `main`; one logical change; no upstream issue/PR number anywhere on the fork (binding fork rules, `input.md:9-22,178-182`).
- **No `CONTRIBUTING.md` or PR template exists** (`.github/` holds only `dependabot.yml` and workflows), so default to the repo conventions captured in CLAUDE.md.
- **No new user-facing Hebrew strings** are needed (`po/he.po` unchanged): the additions are API methods, not event labels.
