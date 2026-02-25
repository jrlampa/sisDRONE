/**
 * geocodeService.ts — Phase 46: Geocodificação Reversa via Nominatim (OpenStreetMap)
 * Gratuito, sem chave de API. Respeita política de 1 req/s (Nominatim TOS).
 * Retry exponencial em caso de erro transitório.
 */
import axios from 'axios';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'sisDRONE/1.0 (digital-twin-redes-eletricas; contact: admin@sisdrone.local)';
export const MAX_RETRIES = 2;
const MIN_INTERVAL_MS = 1_000; // 1 req/s — Nominatim policy
const RETRY_DELAY_MS = 500;

let lastRequestAt = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Enforce ≥1 s between successive Nominatim requests (policy compliance). */
async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - elapsed);
  lastRequestAt = Date.now();
}

export interface GeoAddress {
  display_name: string;
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

/** Reset throttle timer — only used in tests to avoid inter-test delays. */
export function _resetThrottleForTest(): void {
  lastRequestAt = 0;
}

/**
 * Reverse geocode a lat/lng pair using Nominatim.
 * Retries up to MAX_RETRIES times on transient errors.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoAddress> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await throttle();
      const { data } = await axios.get(NOMINATIM_URL, {
        params: { lat, lon: lng, format: 'json' },
        headers: { 'User-Agent': USER_AGENT },
        timeout: 5_000,
      });
      const nominatimData = data as { display_name?: string; address?: Record<string, string | undefined> };
      if (!nominatimData?.display_name) throw new Error('Resposta Nominatim inválida');
      const addr = (nominatimData.address ?? {}) as Record<string, string | undefined>;
      return {
        display_name: String(nominatimData.display_name),
        road: addr.road,
        suburb: addr.suburb ?? addr.neighbourhood ?? addr.quarter,
        city: addr.city ?? addr.town ?? addr.village,
        state: addr.state,
        postcode: addr.postcode,
        country: addr.country,
      };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}
