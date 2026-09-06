const { loadConfig } = require('../utils/config');
const verificationManager = require('../managers/verificationManager');
const logger = require('../utils/logger');

module.exports = (client) => {
  client.on('voiceStateUpdate', async (oldState, newState) => {
    // Hanya peduli saat member BARU BERGABUNG ke sebuah voice channel
    if (!newState.channelId || oldState.channelId === newState.channelId) return;

    const found = verificationManager.findByChannelId(newState.channelId);
    if (!found || found.record.type !== 'voice') return;
    if (found.userId !== newState.member.id) return; // bukan pemilik channel verifikasi ini

    const config = loadConfig();
    const adminMention = config.ids.adminRole ? `<@&${config.ids.adminRole}>` : 'Admin';

    try {
      await newState.channel.send(
        `🔔 ${adminMention} — ${newState.member} sudah bergabung ke voice channel ini dan siap untuk diverifikasi.`
      );
    } catch (err) {
      logger.warn('Gagal mengirim notifikasi voice join:', err.message);
    }
  });
};
