import 'dotenv/config';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

const port = Number(process.env.PORT) || 5001;
let server;
try {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  await connectDatabase();
  server = app.listen(port, () => console.log(`API listening on port ${port}`));
  server.on('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the other process or set a different PORT in backend/.env.`);
    } else {
      console.error(`API server error: ${error.message}`);
    }
    await disconnectDatabase();
    process.exitCode = 1;
  });
} catch (error) {
  console.error(`API startup failed: ${error.message}`);
  process.exitCode = 1;
}

async function shutdown(signal) {
  console.log(`${signal} received. Closing API.`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
