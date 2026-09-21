import { app } from './app.js';
import { PORT } from './config.js';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`Referral API running on http://localhost:${PORT}`);
});
