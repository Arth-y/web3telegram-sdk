const { promises: fs } = require('fs');
const {
  IExecDataProtectorDeserializer,
} = require('@iexec/dataprotector-deserializer');
const sendTelegram = require('./telegramService');
const validateInputs = require('./validateInputs');
const {
  downloadEncryptedContent,
  decryptContent,
} = require('./decryptEmailContent');

async function writeTaskOutput(path, message) {
  try {
    await fs.writeFile(path, message);
    console.log(`File successfully written at path: ${path}`);
  } catch {
    console.error(`Failed to write Task Output`);
    process.exit(1);
  }
}

async function start() {
  // Parse the developer secret environment variable
  let developerSecret;
  console.log('starting now');
  try {
    console.log('devapp', process.env.IEXEC_APP_DEVELOPER_SECRET);
    developerSecret = JSON.parse(process.env.IEXEC_APP_DEVELOPER_SECRET);
    console.log('dev secret ok', developerSecret);
  } catch {
    throw Error('Failed to parse the developer secret');
  }
  let requesterSecret;
  try {
    requesterSecret = process.env.IEXEC_REQUESTER_SECRET_1
      ? JSON.parse(process.env.IEXEC_REQUESTER_SECRET_1)
      : {};
    console.log('req secret ok');
  } catch {
    throw Error('Failed to parse requester secret');
  }

  // const deserializer = new IExecDataProtectorDeserializer();
  // const chatId = await deserializer.getValue('telegram', 'string');

  console.log('serial ok');

  const unsafeEnvVars = {
    iexecOut: process.env.IEXEC_OUT,
    chatId: requesterSecret.chatId,
    telegramContent: requesterSecret.message,
    telegramContentEncryptionKey: requesterSecret.telegramContentEncryptionKey,
    botToken: developerSecret.TELEGRAM_BOT_TOKEN,
  };
  console.log('unsafevar');

  const envVars = validateInputs(unsafeEnvVars);
  console.log('validate ok', envVars);

  // const encryptedTelegramContent = await downloadEncryptedContent(
  //   envVars.telegramContentMultiAddr
  // );
  // const telegramContent = decryptContent(
  //   encryptedTelegramContent,
  //   envVars.telegramContentEncryptionKey
  // );
  console.log('message de sendtel', envVars.telegramContent);

  const response = await sendTelegram({
    chatId: envVars.chatId,
    message: envVars.telegramContent,
    botToken: envVars.botToken,
  });

  await writeTaskOutput(
    `${envVars.iexecOut}/result.txt`,
    JSON.stringify(response, null, 2)
  );
  await writeTaskOutput(
    `${envVars.iexecOut}/computed.json`,
    JSON.stringify({
      'deterministic-output-path': `${envVars.iexecOut}/result.txt`,
    })
  );
}

module.exports = start;
