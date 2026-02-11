/**
 * UTM conversion for WGS84
 */
export function degreesToUtm(lat: number, lng: number) {
  const a = 6378137;
  const k0 = 0.9996;
  const eSq = 0.00669437999013;

  const zone = Math.floor((lng + 180) / 6) + 1;
  const lonOrigin = (zone - 1) * 6 - 180 + 3;
  const lonOriginRad = (lonOrigin * Math.PI) / 180;

  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lng * Math.PI) / 180;

  const N = a / Math.sqrt(1 - eSq * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = eSq * Math.cos(latRad) * Math.cos(latRad) / (1 - eSq);
  const A = (lonRad - lonOriginRad) * Math.cos(latRad);

  const M = a * (
    (1 - eSq / 4 - 3 * eSq * eSq / 64 - 5 * eSq * eSq * eSq / 256) * latRad -
    (3 * eSq / 8 + 3 * eSq * eSq / 32 + 45 * eSq * eSq * eSq / 1024) * Math.sin(2 * latRad) +
    (15 * eSq * eSq / 256 + 45 * eSq * eSq * eSq / 1024) * Math.sin(4 * latRad) -
    (35 * eSq * eSq * eSq / 3072) * Math.sin(6 * latRad)
  );

  const utmEasting = k0 * N * (A + (1 - T + C) * A * A * A / 6 + (5 - 18 * T + T * T + 72 * C - 58 * eSq) * A * A * A * A * A / 120) + 500000;
  let utmNorthing = k0 * (M + N * Math.tan(latRad) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24 + (61 - 58 * T + T * T + 600 * C - 330 * eSq) * A * A * A * A * A * A / 720));

  if (lat < 0) {
    utmNorthing += 10000000;
  }

  return {
    x: parseFloat(utmEasting.toFixed(2)),
    y: parseFloat(utmNorthing.toFixed(2)),
    zone: `${zone}${lat >= 0 ? 'N' : 'S'}`
  };
}
