export interface AppConfig {
  host: string;
  port: number;
  authToken?: string;
  searchServiceUrl: string;
  fetchServiceUrl: string;
  logLevel: string;
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

  return {
    host: getEnv('HOST') ?? '127.0.0.1',
    port,
    authToken: getEnv('AUTH_TOKEN'),
    searchServiceUrl: getEnv('SEARCH_SERVICE_URL') ?? 'http://localhost:4001/search',
    fetchServiceUrl: getEnv('FETCH_SERVICE_URL') ?? 'http://localhost:4002/fetch',
    logLevel: getEnv('LOG_LEVEL') ?? 'info'
  };
};
