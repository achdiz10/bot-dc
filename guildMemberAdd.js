const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../utils/config');
const logger = require('../utils/logger');

module.exports = (client) => {
  client.on('guildMemberAdd', async (member) => {
    let config;
    try {
      config = loadConfig();
    } catch (err) {
      logger.error('Gagal membaca config.json', err);
      return;
    }

    // Berikan role unverified kalau sudah dikonfigurasi lewat !setup
    if (config.ids.unverifiedRole) {
      const role = member.guild.roles.cache.get(config.ids.unverifiedRole);
      if (role) {
        await member.roles.add(role).catch((err) => logger.warn('Gagal memberi role unverified:', err.message));
      }
    }

    if (!config.ids.welcomeChannel) return; // belum di-setup

    const welcomeChannel = member.guild.channels.cache.get(config.ids.welcomeChannel);
    if (!welcomeChannel) return;

    const genderChannelMention = config.ids.genderChannel ? `<#${config.ids.genderChannel}>` : '#pilih-role';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👋 Selamat datang, ${member.user.username}!`)
      .setDescription(
        [
          `Halo ${member}, selamat datang di **${member.guild.name}**!`,
          '',
          `Rules server ini bisa dibaca di ${config.messages?.rulesChannelMention || '#rules'}.`,
          `Ambil role gender kamu di ${genderChannelMention}.`,
          '',
          'Kalau ada pertanyaan, jangan ragu untuk bertanya ke admin/moderator ya!',
        ].join('\n')
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setImage(config.messages?.welcomeGifUrl || null)
      .setFooter({ text: `Member ke-${member.guild.memberCount}` })
      .setTimestamp();

    await welcomeChannel.send({ content: `${member}`, embeds: [embed] }).catch((err) => {
      logger.warn('Gagal mengirim pesan welcome:', err.message);
    });
  });
};
