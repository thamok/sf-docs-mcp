export interface AppConfig {
  host: string;
  port: number;
  authToken?: string;
  logLevel: string;
  indexPath: string;
  corsAllowlist: string[];
}

const getEnv = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

export const loadConfig = (): AppConfig => {
  const portValue = getEnv('PORT');
  const port = portValue ? Number(portValue) : 3000;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${portValue}`);
  }

  const corsAllowlist = (getEnv('CORS_ALLOWLIST') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    host: getEnv('HOST') ?? '0.0.0.0',
    port,
    authToken: getEnv('AUTH_TOKEN'),
    logLevel: getEnv('LOG_LEVEL') ?? 'info',
    indexPath: getEnv('INDEX_PATH') ?? 'data/seed-index.json',
    corsAllowlist,
  };
};
