# HubLaunch Lessons Learned

## Current Status
- Phase: COMPLETE — implemented, tested, lint/typecheck/docs clean.
- Feature: visible sunrise/sunset (netz ha-nireh) per plan.

## Key Discoveries
- node_modules not present initially; `npm install` required.
- `@hebcal/noaa` API matches plan: getUTCSeaLevelSunrise/Sunset(zenith),
  getEpochMillisFromTime(utc, rising), static NOAACalculator.getSolarAzimuth(zdt, lat, lon).
  adjustZenith only adjusts when zenith === 90 exactly → hence the 1e-9 guard.
- All fully-specified reference values reproduce EXACTLY: Chicago const 0/1/-0.5,
  the two function profiles, Tromsø Invalid Date, Denver vis sunrise 05:32:25
  (== seaLevelSunrise ±1s, != elevation sunrise → proves useElevation ignored).
- Plan's refraction sanity value for a=15 ("0.0607") is a rounding approximation;
  Bennett formula actually yields 0.060604 → test asserts 0.0606.
- Plan did NOT include the actual TIBERIAS_EAST/RECHOVOT_EAST sample [az,el] pairs,
  so those exact eastern-ridge reference instants (06:27:32 etc.) can't be
  reproduced verbatim. Used realistic eastern profiles and asserted the computed
  values; noted in test comment + PR body.

## Files Modified
- src/horizon.ts (new) — pure arithmetic helpers.
- src/zmanim.ts — 4 methods + private visibleSunMillis + import.
- src/index.ts — type-only exports of HorizonProfile/HorizonSample.
- README.md — one paragraph after useElevation.
- test/horizon.spec.ts (new), test/zmanim.spec.js (appended cases).

## Notes
- No @example written on new methods (optional), so no docexamples change.
- .hublaunch/* files flagged by `prettier --check .` are harness artifacts, not
  part of the change / commit.

## Next Steps
- Done. Commit on branch demo-issue-420.
