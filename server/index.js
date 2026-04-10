import { createAppServer } from './app.js';

const { httpServer } = createAppServer();
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`\nEphemeral Chat Server running on :${PORT}`);
  console.log('   Zero persistence - memory only\n');
});
