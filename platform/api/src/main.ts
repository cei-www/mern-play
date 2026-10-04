import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig();
createServer(config).listen(config.port, '0.0.0.0', () => {
  console.log(`platform listening on :${config.port} (course: ${config.courseDir}, ui: ${config.uiDir})`);
});
