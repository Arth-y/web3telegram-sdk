const start = require('./sendTelegram');

start().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
