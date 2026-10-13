#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const TELEMETRY_YEARS = [2023, 2024, 2025];
const REQUEST_INTERVAL_MS = 2100;
const REQUEST_TIMEOUT_MS = 15000;
const fullTelemetryCheck = process.argv.includes('--full-telemetry');
const strictTelemetryCheck = process.argv.includes('--strict-telemetry');
const telemetryOnly = process.argv.includes('--telemetry-only');
const requestedTelemetryYear = process.argv.find((argument) => argument.startsWith('--telemetry-year='));
const telemetryYears = requestedTelemetryYear ? [Number(requestedTelemetryYear.split('=')[1])] : TELEMETRY_YEARS;
if (requestedTelemetryYear && !TELEMETRY_YEARS.includes(telemetryYears[0])) {
  throw new Error('Telemetry validation supports 2023, 2024, or 2025.');
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/grand prix/g, 'gp')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(' ')
    .filter((word) => word && !['gp', 'grand', 'prix', 'formula', 'one', '1', 'circuit', 'autodromo'].includes(word));
}

function scoreTrackMatch(trackHint, feature) {
  const normalizedHint = normalize(trackHint);
  const targetWords = tokens(trackHint);
  const fields = [feature.properties?.Name, feature.properties?.Location].filter(Boolean);

  return Math.max(
    0,
    ...fields.map((field) => {
      const normalizedField = normalize(field);
      if (normalizedField && normalizedHint.includes(normalizedField)) return 100;
      return targetWords.filter((word) => tokens(field).includes(word)).length;
    }),
  );
}

function hasRenderableGeometry(feature) {
  if (!['LineString', 'MultiLineString'].includes(feature.geometry?.type)) return false;

  const countPoints = (coordinates) => {
    if (!Array.isArray(coordinates)) return 0;
    if (coordinates.length >= 2 && coordinates.every((value) => typeof value === 'number')) return 1;
    return coordinates.reduce((count, value) => count + countPoints(value), 0);
  };

  return countPoints(feature.geometry?.coordinates) >= 3;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`timeout ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function validateTrackCoverage() {
  const trackDataPath = process.env.TRACK_GEOJSON_PATH ?? new URL('../frontend/public/track-data/f1-circuits.geojson', import.meta.url);
  const geoJson = JSON.parse(await readFile(trackDataPath, 'utf8'));
  const features = (geoJson.features ?? []).filter(hasRenderableGeometry);
  const fallbackPath = new URL('../backend/src/f1/data/f1db-2020-2025.json', import.meta.url);
  const fallbackData = JSON.parse(await readFile(fallbackPath, 'utf8'));
  const trackHintsPath = new URL('../frontend/app/standings/data/trackCircuitHints.json', import.meta.url);
  const raceCircuitHints = JSON.parse(await readFile(trackHintsPath, 'utf8'));
  const missing = [];
  const ambiguous = [];
  let raceCount = 0;

  for (const year of YEARS) {
    const races = fallbackData.seasons?.[String(year)]?.races ?? [];
    raceCount += races.length;

    for (const race of races) {
      const trackHint = `${race.raceName} ${raceCircuitHints[normalize(race.raceName)] ?? ''}`;
      const rankedMatches = features
        .map((feature) => ({ feature, score: scoreTrackMatch(trackHint, feature) }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score);
      const match = rankedMatches[0];

      if (!match) {
        missing.push(`${year} R${race.round} ${race.raceName}`);
        continue;
      }

      const tiedMatches = rankedMatches.filter((candidate) => candidate.score === match.score);
      if (tiedMatches.length > 1) {
        ambiguous.push(`${year} R${race.round} ${race.raceName}: ${tiedMatches.map((candidate) => candidate.feature.properties?.Name).join(' / ')}`);
      }
    }
  }

  return { raceCount, missing, ambiguous };
}

async function validateTelemetryCoverage() {
  const report = [];

  for (const year of telemetryYears) {
    console.log(`Telemetry ${year}: checking race sessions...`);
    const sessions = await fetchJson(`https://api.openf1.org/v1/sessions?year=${year}&session_name=Race`);
    const yearReport = { year, sessions: sessions.length, missingDrivers: [], missingStints: [], emptySessions: [], unavailableSessions: [], unavailableStints: [] };

    for (const session of sessions) {
      await sleep(REQUEST_INTERVAL_MS);
      let laps;

      try {
        laps = await fetchJson(`https://api.openf1.org/v1/laps?session_key=${session.session_key}`);
      } catch (error) {
        yearReport.unavailableSessions.push({
          meeting: session.meeting_name ?? session.circuit_short_name ?? 'unknown meeting',
          circuit: session.circuit_short_name ?? 'unknown circuit',
          date: session.date_start ?? 'unknown date',
          sessionKey: session.session_key,
          status: error instanceof Error ? error.message.split(' ')[0] : 'request failed',
        });
        continue;
      }

      const drivers = new Set(laps.map((lap) => lap.driver_number).filter((driverNumber) => driverNumber !== undefined));
      const timedDrivers = new Set(laps.filter((lap) => typeof lap.lap_duration === 'number').map((lap) => lap.driver_number));

      if (drivers.size === 0) {
        yearReport.emptySessions.push({
          circuit: session.circuit_short_name ?? 'unknown circuit',
          date: session.date_start ?? 'unknown date',
          sessionKey: session.session_key,
        });
      } else if (timedDrivers.size !== drivers.size) {
        const missingDriverNumbers = [...drivers].filter((driver) => !timedDrivers.has(driver));
        let driverNames = {};

        try {
          await sleep(REQUEST_INTERVAL_MS);
          const sessionDrivers = await fetchJson(`https://api.openf1.org/v1/drivers?session_key=${session.session_key}`);
          driverNames = Object.fromEntries(
            missingDriverNumbers.map((driverNumber) => {
              const driver = sessionDrivers.find((candidate) => candidate.driver_number === driverNumber);
              return [driverNumber, driver?.full_name ?? driver?.name_acronym ?? `#${driverNumber}`];
            }),
          );
        } catch {
          driverNames = Object.fromEntries(missingDriverNumbers.map((driverNumber) => [driverNumber, `#${driverNumber}`]));
        }

        yearReport.missingDrivers.push({
          circuit: session.circuit_short_name ?? 'unknown circuit',
          date: session.date_start ?? 'unknown date',
          sessionKey: session.session_key,
          drivers: missingDriverNumbers,
          driverNames,
        });
      }

      await sleep(REQUEST_INTERVAL_MS);
      let stints;

      try {
        stints = await fetchJson(`https://api.openf1.org/v1/stints?session_key=${session.session_key}`);
      } catch (error) {
        yearReport.unavailableStints.push({
          meeting: session.meeting_name ?? session.circuit_short_name ?? 'unknown meeting',
          circuit: session.circuit_short_name ?? 'unknown circuit',
          date: session.date_start ?? 'unknown date',
          sessionKey: session.session_key,
          status: error instanceof Error ? error.message.split(' ')[0] : 'request failed',
        });
        continue;
      }

      const driversWithStints = new Set(
        stints
          .filter((stint) => typeof stint.driver_number === 'number' && typeof stint.lap_start === 'number' && typeof stint.lap_end === 'number')
          .map((stint) => stint.driver_number),
      );
      const driversWithoutStints = [...timedDrivers].filter((driverNumber) => !driversWithStints.has(driverNumber));

      if (driversWithoutStints.length > 0) {
        yearReport.missingStints.push({
          circuit: session.circuit_short_name ?? 'unknown circuit',
          date: session.date_start ?? 'unknown date',
          sessionKey: session.session_key,
          drivers: driversWithoutStints,
        });
      }
    }

    report.push(yearReport);
  }

  return report;
}

try {
  const tracks = telemetryOnly ? { raceCount: 0, missing: [], ambiguous: [] } : await validateTrackCoverage();

  if (!telemetryOnly) {
    console.log(`Track coverage: ${tracks.raceCount} races checked, ${tracks.missing.length} missing GeoJSON matches, ${tracks.ambiguous.length} ambiguous matches.`);
    for (const missing of tracks.missing) console.log(`  MISSING TRACK: ${missing}`);
    for (const ambiguous of tracks.ambiguous) console.log(`  AMBIGUOUS TRACK: ${ambiguous}`);
  }

  if (!fullTelemetryCheck) {
    console.log('Telemetry coverage was not requested. Run with --full-telemetry for the rate-limited 2023-2025 race and driver check.');
    process.exit(tracks.missing.length > 0 ? 1 : 0);
  }

  const telemetry = await validateTelemetryCoverage();
  for (const year of telemetry) {
    console.log(`Telemetry ${year.year}: ${year.sessions} race sessions, ${year.unavailableSessions.length} unavailable, ${year.emptySessions.length} empty, ${year.missingDrivers.length} sessions with drivers lacking timed laps, ${year.unavailableStints.length} unavailable stint responses, ${year.missingStints.length} sessions with drivers lacking stints.`);
    for (const unavailable of year.unavailableSessions) {
      console.log(`  UNAVAILABLE: ${unavailable.meeting} / ${unavailable.circuit} / ${unavailable.date} (session ${unavailable.sessionKey}, ${unavailable.status})`);
    }
    for (const empty of year.emptySessions) {
      console.log(`  EMPTY SESSION: ${empty.circuit} / ${empty.date} (session ${empty.sessionKey})`);
    }
    for (const missing of year.missingDrivers) {
      const drivers = missing.drivers.map((driver) => `${missing.driverNames[driver]} (#${driver})`).join(', ');
      console.log(`  NO TIMED LAP: ${missing.circuit} / ${missing.date} (session ${missing.sessionKey}), drivers ${drivers}`);
    }
    for (const unavailable of year.unavailableStints) {
      console.log(`  STINT UNAVAILABLE: ${unavailable.meeting} / ${unavailable.circuit} / ${unavailable.date} (session ${unavailable.sessionKey}, ${unavailable.status})`);
    }
    for (const missing of year.missingStints) {
      console.log(`  NO STINT: ${missing.circuit} / ${missing.date} (session ${missing.sessionKey}), drivers ${missing.drivers.map((driver) => `#${driver}`).join(', ')}`);
    }
  }

  const hasTelemetryGaps = telemetry.some(
    (year) =>
      year.unavailableSessions.length > 0 ||
      year.emptySessions.length > 0 ||
      year.missingDrivers.length > 0 ||
      year.unavailableStints.length > 0 ||
      year.missingStints.length > 0,
  );
  if (hasTelemetryGaps) {
    console.log('Telemetry gaps were reported. Use --strict-telemetry to treat these source-data gaps as a failing validation.');
  }

  process.exit(tracks.missing.length > 0 || (strictTelemetryCheck && hasTelemetryGaps) ? 1 : 0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
