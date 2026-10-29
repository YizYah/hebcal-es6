/**
 * Pure arithmetic for the "visible" sunrise/sunset (_netz ha-nireh_,
 * הנץ הנראה): resolving a caller-supplied terrain horizon profile, atmospheric
 * refraction, and the apparent altitude of the sun's upper limb.
 *
 * The method follows Keller & Hall, _Using a digital terrain model to
 * calculate visual sunrise and sunset times_, Computers & Geosciences 26
 * (2000), and the convention of the Chai Tables (chaitables.com; Keller &
 * Hall). Refraction uses the Sinclair model below 15° and the Bennett model
 * at or above 15°, both at standard atmosphere (1010 hPa, 10 °C), matching the
 * Chai Tables. "Visible" means the moment the sun's _upper limb_, bent up by
 * refraction, first clears (sunrise) or last touches (sunset) the real
 * skyline. No cushion or safety margin is added — the raw computed instant is
 * returned.
 *
 * This module is pure: it depends on nothing from `@hebcal/noaa` and performs
 * no I/O. The horizon profile is always supplied by the caller; building one
 * from terrain / digital-elevation-model data is outside this library.
 */

/**
 * One measured point of a horizon profile: the apparent angular altitude of
 * the skyline in a single compass direction.
 */
export interface HorizonSample {
  /**
   * Degrees clockwise from true north: 0 = N, 90 = E, 180 = S, 270 = W.
   */
  azimuth: number;
  /**
   * Apparent angular altitude of the highest obstruction in that direction,
   * in degrees above the observer's astronomical horizon (negative where the
   * horizon dips below it, e.g. the sea seen from a height).
   */
  elevation: number;
}

/**
 * The apparent altitude of the skyline as a function of compass azimuth. May
 * be one of:
 *
 * - a constant `number` — the same elevation in every direction;
 * - a non-empty list of {@link HorizonSample}s in any order or spacing, with
 *   azimuths in `[0, 360)`, linearly interpolated (wrapping past 360°/0°);
 * - a function `(azimuth: number) => number` returning the elevation in
 *   degrees for a given azimuth.
 */
export type HorizonProfile =
  number | readonly HorizonSample[] | ((azimuth: number) => number);

/**
 * The sun's angular semidiameter in degrees (16 arcminutes), matching the
 * value `@hebcal/noaa` folds into its `GEOMETRIC_ZENITH` adjustment.
 */
export const SOLAR_SEMIDIAMETER = 16 / 60;

/**
 * Resolves a {@link HorizonProfile} at a single azimuth.
 *
 * A constant returns itself; a function is invoked; a sample list is linearly
 * interpolated between its two neighbouring samples by azimuth, wrapping
 * around 360°/0°. A single sample behaves as a constant.
 * @param profile the horizon profile
 * @param azimuth degrees clockwise from true north
 * @throws {TypeError} for an empty sample array or a non-finite constant
 */
export function horizonElevation(profile: HorizonProfile, azimuth: number): number {
  if (typeof profile === 'number') {
    if (!Number.isFinite(profile)) {
      throw new TypeError(`invalid horizon elevation: ${profile}`);
    }
    return profile;
  }
  if (typeof profile === 'function') {
    return profile(azimuth);
  }
  const n = profile.length;
  if (n === 0) {
    throw new TypeError('horizon profile has no samples');
  }
  if (n === 1) {
    return profile[0].elevation;
  }
  const sorted = [...profile].sort((a, b) => a.azimuth - b.azimuth);
  let az = azimuth % 360;
  if (az < 0) {
    az += 360;
  }
  // Largest sample azimuth that is still <= the query azimuth.
  let loIdx = -1;
  for (let i = 0; i < n; i++) {
    if (sorted[i].azimuth <= az) {
      loIdx = i;
    } else {
      break;
    }
  }
  let lo: HorizonSample;
  let hi: HorizonSample;
  let loAz: number;
  let hiAz: number;
  if (loIdx === -1) {
    // Below the smallest azimuth: wrap, previous neighbour is the last sample.
    lo = sorted[n - 1];
    loAz = lo.azimuth - 360;
    hi = sorted[0];
    hiAz = hi.azimuth;
  } else if (loIdx === n - 1) {
    // At or above the largest azimuth: wrap, next neighbour is the first.
    lo = sorted[n - 1];
    loAz = lo.azimuth;
    hi = sorted[0];
    hiAz = hi.azimuth + 360;
  } else {
    lo = sorted[loIdx];
    loAz = lo.azimuth;
    hi = sorted[loIdx + 1];
    hiAz = hi.azimuth;
  }
  const t = hiAz === loAz ? 0 : (az - loAz) / (hiAz - loAz);
  return lo.elevation + t * (hi.elevation - lo.elevation);
}

/**
 * Atmospheric refraction at a given apparent altitude, in degrees, at standard
 * atmosphere (1010 hPa, 10 °C). Sinclair's formula below 15°, Bennett's at or
 * above 15° — the pairing the Chai Tables use.
 * @param apparentAltitude apparent altitude of the body above the horizon, in degrees
 */
export function refractionAtApparentAltitude(apparentAltitude: number): number {
  const P = 1010;
  const T = 10;
  const a = apparentAltitude;
  if (a < 15) {
    return (
      ((P / (T + 273)) * (0.1594 + 0.0196 * a + 0.00002 * a * a)) /
      (1 + 0.505 * a + 0.0845 * a * a)
    );
  }
  return (
    ((1 / 60) * (P / 1010) * (283 / (273 + T))) /
    Math.tan(((a + 7.31 / (a + 4.4)) * Math.PI) / 180)
  );
}

/**
 * Given the sun's geometric centre altitude, returns the apparent altitude of
 * its upper limb — adding the semidiameter and solving the implicit
 * refraction equation `β = a + SD + R(β)` by fixed-point iteration.
 *
 * `upperLimbApparentAltitude(-0.8333)` is ≈ 0, i.e. the standard sea-level
 * sunrise/sunset definition (upper limb on the astronomical horizon).
 * @param centerGeometricAltitude geometric altitude of the sun's centre, in degrees
 */
export function upperLimbApparentAltitude(centerGeometricAltitude: number): number {
  const base = centerGeometricAltitude + SOLAR_SEMIDIAMETER;
  let beta = base + refractionAtApparentAltitude(base);
  for (let i = 0; i < 4; i++) {
    beta = base + refractionAtApparentAltitude(beta);
  }
  return beta;
}
