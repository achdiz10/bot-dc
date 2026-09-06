const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../utils/config');

module.exports = {
  name: 'help',
  description: 'Menampilkan daftar command bot.',
  async execute(message, args, client) {
    const config = loadConfig();
    const prefix = config.prefix;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📖 Daftar Command')
      .setDescription(
        [...client.commands.values()]
          .map((cmd) => `\`${prefix}${cmd.name}\` — ${cmd.description}`)
          .join('\n')
      )
      .setFooter({ text: `Prefix saat ini: ${prefix}` });

    await message.reply({ embeds: [embed] });
  },
};
