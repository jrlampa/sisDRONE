import dotenv from 'dotenv';
dotenv.config();
import app from './app';
import { getDb } from './db';

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Initialize DB
    await getDb();
    console.log('Database initialized.');

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
