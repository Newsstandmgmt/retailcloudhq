const DEFAULT_API_URL = 'https://retailcloudhq-production.up.railway.app';

declare global {
  // eslint-disable-next-line no-var
  var RETAILCLOUDHQ_API_URL: string | undefined;
}

const resolveRuntimeApiUrl = () => {
  const override =
    typeof globalThis !== 'undefined'
      ? globalThis.RETAILCLOUDHQ_API_URL || (globalThis as any)?.RETAILCLOUDHQ_API_URL
      : undefined;

  const envFallback =
    typeof process !== 'undefined' && process?.env
      ? process.env.RETAILCLOUDHQ_API_URL || process.env.API_URL
      : undefined;

  const candidate = override || envFallback;

  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.replace(/\/$/, '');
  }

  return DEFAULT_API_URL;
};

export const getApiBaseUrl = (): string => resolveRuntimeApiUrl();

export const getApiBaseApiUrl = (): string => `${getApiBaseUrl()}/api`;

export const RETAILCLOUDHQ_PRODUCTION_URL = DEFAULT_API_URL;


