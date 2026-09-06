const { loadConfig } = require('../utils/config');
const verificationManager = require('../managers/verificationManager');
const logger = require('../utils/logger');

module.exports = (client) => {
  client.on('guildMemberRemove', async (member) => {
    const record = verificationManager.getVerification(member.guild.id, member.id);
    if (!record) return; // tidak ada verifikasi berjalan, tidak perlu cleanup

    logger.info(`Member ${member.id} keluar sebelum verifikasi selesai, membersihkan data...`);

    try {
      if (record.type === 'voice' && record.channelId) {
        const channel = member.guild.channels.cache.get(record.channelId);
        if (channel) await channel.delete('Member keluar server sebelum verifikasi selesai').catch(() => {});
      }

      if (record.type === 'voicenote' && record.threadId) {
        const thread = member.guild.channels.cache.get(record.threadId);
        if (thread) await thread.delete('Member keluar server sebelum verifikasi selesai').catch(() => {});

        // Bersihkan permission overwrite khusus member di forum kalau masih ada
        const config = loadConfig();
        if (config.ids.verificationForum) {
          const forum = member.guild.channels.cache.get(config.ids.verificationForum);
          if (forum) {
            await forum.permissionOverwrites.delete(member.id).catch(() => {});
          }
        }
      }
    } finally {
      verificationManager.deleteVerification(member.guild.id, member.id);
    }
  });
};
