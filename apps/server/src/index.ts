import { createApp } from './app.js';

const { app, config, logger } = createApp();

app.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port }, 'MCP server listening');
});
