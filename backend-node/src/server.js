import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT || 3000);
const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const storePath = path.resolve(__dirname, '..', 'data', 'store.json');

const app = createApp({
  port,
  aiServiceUrl,
  storePath,
});

app.listen(port, '0.0.0.0', () => {
  console.log(`[Dayout AI Node BFF] Listening on http://0.0.0.0:${port}`);
  console.log(`[Dayout AI Node BFF] AI upstream target: ${aiServiceUrl}`);
  console.log(`[Dayout AI Node BFF] Demo Share Card: http://localhost:${port}/s/demo`);
  console.log(`[Dayout AI Node BFF] Judge Stats Dashboard: http://localhost:${port}/admin/stats`);
});
