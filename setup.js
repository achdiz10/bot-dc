const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { loadConfig, saveConfig } = require('../utils/config');
const { runFullSetup } = require('../managers/setupManager');

function buildGenderPromptEmbed(guild) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎭 Pilih Role Gender')
    .setDescription(
      [
        'Silakan pilih role gender kamu dengan menekan salah satu tombol di bawah.',
        '',
        '👦 **Laki-laki** — role langsung diberikan.',
        '👧 **Perempuan** — kamu akan diminta melakukan verifikasi singkat (voice channel atau voice note) sebelum role diberikan. Ini untuk menjaga keamanan member perempuan di server.',
        '',
        'Kamu hanya bisa memiliki **satu** role gender pada satu waktu.',
      ].join('\n')
    )
    .setFooter({ text: guild.name });
}

function buildGenderPromptRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('gender_select_male')
      .setLabel('Laki-laki')
      .setEmoji('👦')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('gender_select_female')
      .setLabel('Perempuan')
      .setEmoji('👧')
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  name: 'setup',
  description: 'Menyiapkan seluruh channel, category, dan role yang dibutuhkan bot (admin only).',
  async execute(message) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Command ini hanya bisa dijalankan oleh member dengan permission **Administrator**.');
    }

    const botMember = message.guild.members.me;
    if (
      !botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
      !botMember.permissions.has(PermissionFlagsBits.ManageChannels)
    ) {
      return message.reply(
        '❌ Bot butuh permission **Manage Roles** dan **Manage Channels** untuk menjalankan setup.'
      );
    }

    const statusMsg = await message.reply('⏳ Menjalankan setup, mohon tunggu...');

    try {
      const config = loadConfig();
      const summary = await runFullSetup(message.guild, config);

      // Post / refresh pesan pilih gender role
      const genderChannel = await message.guild.channels.fetch(config.ids.genderChannel);
      let promptExists = false;

      if (config.ids.genderPromptMessageId) {
        try {
          await genderChannel.messages.fetch(config.ids.genderPromptMessageId);
          promptExists = true;
        } catch (err) {
          promptExists = false;
        }
      }

      if (!promptExists) {
        const promptMsg = await genderChannel.send({
          embeds: [buildGenderPromptEmbed(message.guild)],
          components: [buildGenderPromptRow()],
        });
        config.ids.genderPromptMessageId = promptMsg.id;
        summary.push(`Pesan pilih role gender dikirim ulang di ${genderChannel}.`);
      } else {
        summary.push(`Pesan pilih role gender sudah ada di ${genderChannel}, tidak dibuat ulang.`);
      }

      saveConfig(config);

      const resultEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Setup selesai')
        .setDescription(summary.join('\n'))
        .setFooter({ text: 'Jalankan !setup lagi kapan saja jika ada channel/role yang terhapus.' });

      await statusMsg.edit({ content: null, embeds: [resultEmbed] });
    } catch (err) {
      console.error(err);
      await statusMsg.edit(
        `❌ Setup gagal: ${err.message}\nPastikan bot punya permission **Administrator** atau minimal **Manage Roles** + **Manage Channels**, dan posisi role bot berada di atas role-role yang perlu dikelola.`
      );
    }
  },
  buildGenderPromptEmbed,
  buildGenderPromptRow,
};
