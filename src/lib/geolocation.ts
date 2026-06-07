// Browser geolocation wrapper that turns the callback-style API into a
// promise + readable error messages tied to GeolocationPositionError.code.

const DEFAULT_TIMEOUT_MS = 5000;

export interface BrowserLocation {
  lat: number;
  lng: number;
  accuracyM: number;
}

export class GeolocationError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly code?: number,
  ) {
    super(userMessage);
    this.name = 'GeolocationError';
  }
}

export async function getCurrentLocation(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<BrowserLocation> {
  if (!('geolocation' in navigator)) {
    throw new GeolocationError(
      'Your browser does not support location services.',
    );
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
      },
      (err) => {
        let msg = 'Could not get your location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Please allow location access to go available.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Could not determine your location. Try again outside.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Try again.';
        }
        reject(new GeolocationError(msg, err.code));
      },
      { timeout: timeoutMs, maximumAge: 60_000, enableHighAccuracy: false },
    );
  });
}
