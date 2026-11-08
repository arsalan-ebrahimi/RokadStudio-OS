import app from '../app.js';
import { ensureSchemaUpdated } from '../config/autoMigrate.js';

// Pre-warm schema sync on Vercel cold-start
ensureSchemaUpdated().catch(() => {});

export default app;

