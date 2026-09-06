const { loadConfig } = require('../utils/config');
const logger = require('../utils/logger');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return; // abaikan DM

    let config;
    try {
      config = loadConfig();
    } catch (err) {
      logger.error('Gagal membaca config.json', err);
      return;
    }

    const prefix = config.prefix || '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(message, args, client);
    } catch (err) {
      logger.error(`Error menjalankan command "${commandName}"`, err);
      message.reply('❌ Terjadi kesalahan saat menjalankan command ini.').catch(() => {});
    }
  });
};
