const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const { loadConfig } = require('../utils/config');
const { isVerificationAdmin } = require('../utils/permissions');
const verificationManager = require('../managers/verificationManager');
const roleManager = require('../managers/roleManager');
const flow = require('../managers/verificationFlow');
const logger = require('../utils/logger');

function methodChooserRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_method_voice')
      .setLabel('Voice Verification')
      .setEmoji('🔊')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('verify_method_voicenote')
      .setLabel('Voice Note Verification')
      .setEmoji('🎤')
      .setStyle(ButtonStyle.Secondary)
  );
}

async function disableComponents(message) {
  if (!message?.components?.length) return;

  const disabledRows = message.components.map((row) => {
    const newRow = new ActionRowBuilder();

    row.components.forEach((component) => {
      try {
        if (component.type === 2) {
          newRow.addComponents(
            ButtonBuilder.from(component).setDisabled(true)
          );
        }
      } catch (err) {
        logger.error('Gagal disable button:', err);
      }
    });

    return newRow;
  });

  await message.edit({
    components: disabledRows,
  }).catch((err) => {
    logger.error('Gagal edit message:', err);
  });
}

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {

    // =========================================================
    // HANYA BUTTON
    // =========================================================
    if (!interaction.isButton()) return;

    // =========================================================
    // HANYA INTERACTION DARI SERVER
    // =========================================================
    if (!interaction.guild) {
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Interaction ini hanya bisa digunakan di server.',
            ephemeral: true,
          });
        }
      } catch (err) {
        logger.error('Gagal membalas interaction DM:', err);
      }

      return;
    }

    // =========================================================
    // DEBUG
    // =========================================================
    const { customId } = interaction;

    console.log(
      `[INTERACTION] ${interaction.user.tag} menekan tombol: ${customId}`
    );

    // =========================================================
    // LOAD CONFIG
    // =========================================================
    let config;

    try {
      config = loadConfig();
    } catch (err) {
      logger.error('Gagal membaca config.json:', err);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content:
              '❌ Terjadi masalah saat membaca konfigurasi bot. Hubungi admin.',
            ephemeral: true,
          });
        }
      } catch (replyError) {
        logger.error(
          'Gagal mengirim pesan error config:',
          replyError
        );
      }

      return;
    }

    // =========================================================
    // MAIN HANDLER
    // =========================================================
    try {

      // =======================================================
      // LAKI-LAKI
      // =======================================================
      if (customId === 'gender_select_male') {

        console.log(
          `[GENDER] ${interaction.user.tag} memilih Laki-laki`
        );

        const existing = verificationManager.getVerification(
          interaction.guild.id,
          interaction.user.id
        );

        if (existing) {
          try {
            await flow.cleanupVerificationChannels(
              interaction.guild,
              existing
            );
          } catch (err) {
            logger.error(
              'Gagal membersihkan channel verifikasi:',
              err
            );
          }

          verificationManager.deleteVerification(
            interaction.guild.id,
            interaction.user.id
          );
        }

        // Pastikan member tersedia
        if (!interaction.member) {
          await interaction.reply({
            content: '❌ Data member tidak ditemukan.',
            ephemeral: true,
          });

          return;
        }

        // Berikan role laki-laki
        await roleManager.assignGenderRole(
          interaction.member,
          config.ids.maleRole,
          config
        );

        await interaction.reply({
          content: '✅ Role **Laki-laki** berhasil diberikan!',
          ephemeral: true,
        });

        return;
      }

      // =======================================================
      // PEREMPUAN
      // =======================================================
      if (customId === 'gender_select_female') {

        console.log(
          `[GENDER] ${interaction.user.tag} memilih Perempuan`
        );

        const femaleRoleId = config.ids.femaleRole;

        // Sudah punya role perempuan
        if (
          femaleRoleId &&
          interaction.member.roles.cache.has(femaleRoleId)
        ) {
          await interaction.reply({
            content:
              'ℹ️ Kamu sudah terverifikasi sebagai **Perempuan**.',
            ephemeral: true,
          });

          return;
        }

        // Cek apakah sedang melakukan verifikasi
        const existing = verificationManager.getVerification(
          interaction.guild.id,
          interaction.user.id
        );

        if (existing) {
          await interaction.reply({
            content:
              '⏳ Kamu masih memiliki proses verifikasi yang berjalan.\n\n' +
              'Selesaikan proses tersebut terlebih dahulu atau hubungi admin jika mengalami masalah.',
            ephemeral: true,
          });

          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🌸 Pilih Metode Verifikasi')
          .setDescription(
            [
              'Silakan pilih salah satu metode verifikasi di bawah ini.',
              '',
              '🔊 **Voice Verification**',
              'Bot akan membuat voice channel privat untuk kamu dan admin.',
              '',
              '🎤 **Voice Note Verification**',
              'Bot akan membuat thread privat di forum untuk mengirim voice note.',
            ].join('\n')
          )
          .setFooter({
            text: 'Pilih metode yang ingin kamu gunakan.',
          });

        await interaction.reply({
          embeds: [embed],
          components: [methodChooserRow()],
          ephemeral: true,
        });

        return;
      }

      // =======================================================
      // VOICE VERIFICATION
      // =======================================================
      if (customId === 'verify_method_voice') {

        console.log(
          `[VERIFY VOICE] ${interaction.user.tag} memulai verifikasi voice`
        );

        // Cek category
        if (!config.ids.verificationCategory) {
          await interaction.reply({
            content:
              '❌ Category verifikasi belum diatur.\n' +
              'Hubungi administrator server.',
            ephemeral: true,
          });

          return;
        }

        // WAJIB defer SEBELUM proses membuat channel
        await interaction.deferReply({
          ephemeral: true,
        });

        try {

          console.log('[VERIFY VOICE] Membuat voice channel...');

          const channel =
            await flow.createVoiceVerification(
              interaction.member,
              config
            );

          console.log(
            `[VERIFY VOICE] Voice channel berhasil dibuat: ${channel.id}`
          );

          await interaction.editReply({
            content:
              `✅ **Voice channel verifikasi berhasil dibuat!**\n\n` +
              `${channel}\n\n` +
              `Silakan masuk ke voice channel tersebut dan tunggu admin melakukan verifikasi.`,
          });

        } catch (err) {

          logger.error(
            'Gagal membuat voice verification:',
            err
          );

          await interaction.editReply({
            content:
              `❌ **Gagal membuat voice channel verifikasi.**\n\n` +
              `Error: \`${err.message}\`\n\n` +
              `Silakan hubungi administrator.`,
          }).catch(() => {});

        }

        return;
      }

      // =======================================================
      // VOICE NOTE VERIFICATION
      // =======================================================
      if (customId === 'verify_method_voicenote') {

        console.log(
          `[VERIFY VOICENOTE] ${interaction.user.tag} memulai verifikasi voice note`
        );

        // Cek forum
        if (!config.ids.verificationForum) {
          await interaction.reply({
            content:
              '❌ Forum verifikasi belum diatur.\n' +
              'Hubungi administrator server.',
            ephemeral: true,
          });

          return;
        }

        // WAJIB defer
        await interaction.deferReply({
          ephemeral: true,
        });

        try {

          console.log(
            '[VERIFY VOICENOTE] Membuat thread verifikasi...'
          );

          const thread =
            await flow.createVoiceNoteVerification(
              interaction.member,
              config
            );

          console.log(
            `[VERIFY VOICENOTE] Thread berhasil dibuat: ${thread.id}`
          );

          await interaction.editReply({
            content:
              `✅ **Thread verifikasi berhasil dibuat!**\n\n` +
              `${thread}\n\n` +
              `Silakan buka thread tersebut dan kirim voice note kamu di sana.`,
          });

        } catch (err) {

          logger.error(
            'Gagal membuat voice note verification:',
            err
          );

          await interaction.editReply({
            content:
              `❌ **Gagal membuat thread verifikasi.**\n\n` +
              `Error: \`${err.message}\`\n\n` +
              `Silakan hubungi administrator.`,
          }).catch(() => {});

        }

        return;
      }

      // =======================================================
      // ADMIN ACCEPT / REJECT
      // =======================================================
      if (
        customId.startsWith('admin_accept_') ||
        customId.startsWith('admin_reject_')
      ) {

        console.log(
          `[ADMIN VERIFY] ${interaction.user.tag} menekan ${customId}`
        );

        // Cek admin
        if (
          !isVerificationAdmin(
            interaction.member,
            config
          )
        ) {
          await interaction.reply({
            content:
              '❌ Hanya **Admin/Moderator** yang dapat melakukan verifikasi.',
            ephemeral: true,
          });

          return;
        }

        const isAccept =
          customId.startsWith('admin_accept_');

        const prefix = isAccept
          ? 'admin_accept_'
          : 'admin_reject_';

        const rest = customId.replace(prefix, '');

        const parts = rest.split('_');

        const guildId = parts[0];
        const userId = parts[1];

        if (!guildId || !userId) {
          await interaction.reply({
            content:
              '❌ Data verifikasi tidak valid.',
            ephemeral: true,
          });

          return;
        }

        const found =
          verificationManager.findByChannelId(
            interaction.channelId
          );

        if (
          !found ||
          found.guildId !== guildId ||
          found.userId !== userId
        ) {

          await interaction.reply({
            content:
              '❌ Data verifikasi ini sudah tidak berlaku atau sudah diproses sebelumnya.',
            ephemeral: true,
          });

          await disableComponents(
            interaction.message
          );

          return;
        }

        // WAJIB defer karena proses accept/reject
        // bisa membutuhkan waktu
        await interaction.deferReply({
          ephemeral: true,
        });

        // =====================================================
        // ACCEPT
        // =====================================================
        if (isAccept) {

          try {

            console.log(
              `[ADMIN VERIFY] Menerima verifikasi ${userId}`
            );

            const member =
              await flow.acceptVerification(
                interaction.guild,
                found.record,
                config
              );

            if (member) {

              await interaction.editReply({
                content:
                  `✅ **Verifikasi diterima!**\n\n` +
                  `${member} sekarang memiliki role **Perempuan**.`,
              });

            } else {

              await interaction.editReply({
                content:
                  '✅ Verifikasi diterima, tetapi member sudah tidak berada di server sehingga role tidak dapat diberikan.',
              });

            }

          } catch (err) {

            logger.error(
              'Gagal accept verifikasi:',
              err
            );

            await interaction.editReply({
              content:
                `❌ **Gagal memberikan role.**\n\n` +
                `Error: \`${err.message}\``,
            }).catch(() => {});

            return;
          }

        }

        // =====================================================
        // REJECT
        // =====================================================
        else {

          try {

            console.log(
              `[ADMIN VERIFY] Menolak verifikasi ${userId}`
            );

            await flow.rejectVerification(
              interaction.guild,
              found.record
            );

            await interaction.editReply({
              content:
                '❌ **Verifikasi ditolak.**\n\n' +
                'Member dapat melakukan verifikasi ulang kapan saja.',
            });

          } catch (err) {

            logger.error(
              'Gagal reject verifikasi:',
              err
            );

            await interaction.editReply({
              content:
                `❌ **Gagal menolak verifikasi.**\n\n` +
                `Error: \`${err.message}\``,
            }).catch(() => {});

            return;
          }
        }

        // Disable tombol admin
        await disableComponents(
          interaction.message
        ).catch(() => {});

        return;
      }

      // =======================================================
      // TOMBOL TIDAK DIKENAL
      // =======================================================
      console.log(
        `[INTERACTION] Tombol tidak dikenali: ${customId}`
      );

      // Ini penting!
      // Sebelumnya tombol yang tidak cocok dengan kondisi
      // akan dibiarkan tanpa response sehingga Discord
      // menampilkan "didn't respond in time".
      await interaction.reply({
        content:
          `❌ Tombol tidak dikenali.\n\n` +
          `Custom ID: \`${customId}\``,
        ephemeral: true,
      });

    } catch (err) {

      // =======================================================
      // GLOBAL ERROR HANDLER
      // =======================================================
      logger.error(
        'Error di interactionCreate:',
        err
      );

      try {

        const payload = {
          content:
            `❌ Terjadi kesalahan pada bot.\n\n` +
            `Error: \`${err.message}\``,
          ephemeral: true,
        };

        if (
          interaction.deferred ||
          interaction.replied
        ) {

          await interaction.editReply(
            payload
          ).catch(() => {});

        } else {

          await interaction.reply(
            payload
          ).catch(() => {});

        }

      } catch (replyError) {

        logger.error(
          'Gagal mengirim error response:',
          replyError
        );

      }
    }
  });
};