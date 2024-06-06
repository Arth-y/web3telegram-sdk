const TelegramBot = require('node-telegram-bot-api');

async function sendTelegram({ chatId, message, botToken }) {
  const bot = new TelegramBot(botToken, {
    polling: true,
  });
  console.log('message de telegram service', message);
  return bot
    .sendMessage(chatId, message)
    .then(() => {
      console.log('Message envoyé avec succès sur Telegram!'); // eslint-disable-line no-console
    })
    .catch((error) => {
      console.error(
        // eslint-disable-line no-console
        "Erreur lors de l'envoi du message sur Telegram :"
        // error
      );
    });
}

module.exports = sendTelegram;
