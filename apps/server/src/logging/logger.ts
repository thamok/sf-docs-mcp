export type LogLevel = 'info' | 'warn' | 'error';

export type LogPayload = Record<string, unknown>;

export function log(level: LogLevel, message: string, payload: LogPayload = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...payload,
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export function child(context: LogPayload) {
  return {
    info: (message: string, payload: LogPayload = {}) => log('info', message, { ...context, ...payload }),
    warn: (message: string, payload: LogPayload = {}) => log('warn', message, { ...context, ...payload }),
    error: (message: string, payload: LogPayload = {}) => log('error', message, { ...context, ...payload }),
  };
}
