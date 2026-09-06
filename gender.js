const { PermissionFlagsBits } = require('discord.js');
const { loadConfig, saveConfig } = require('../utils/config');
const { buildGenderPromptEmbed, buildGenderPromptRow } = require('./setup');

module.exports = {
  name: 'gender',
  description: 'Mengirim ulang pesan pilihan role gender di channel yang sudah dikonfigurasi (admin only).',
  async execute(message) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Command ini hanya bisa dijalankan oleh member dengan permission **Administrator**.');
    }

    const config = loadConfig();
    if (!config.ids.genderChannel) {
      return message.reply('❌ Channel pilih role belum ada. Jalankan `!setup` terlebih dahulu.');
    }

    const genderChannel = await message.guild.channels.fetch(config.ids.genderChannel).catch(() => null);
    if (!genderChannel) {
      return message.reply('❌ Channel pilih role tidak ditemukan. Jalankan `!setup` untuk membuat ulang.');
    }

    // Hapus pesan lama kalau ada supaya tidak duplikat
    if (config.ids.genderPromptMessageId) {
      const oldMsg = await genderChannel.messages.fetch(config.ids.genderPromptMessageId).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});
    }

    const promptMsg = await genderChannel.send({
      embeds: [buildGenderPromptEmbed(message.guild)],
      components: [buildGenderPromptRow()],
    });

    config.ids.genderPromptMessageId = promptMsg.id;
    saveConfig(config);

    await message.reply(`✅ Pesan pilih role gender sudah dikirim ulang di ${genderChannel}.`);
  },
};
