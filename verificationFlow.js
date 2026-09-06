const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const verificationManager = require('./verificationManager');
const roleManager = require('./roleManager');

/**
 * Membuat nama channel yang aman digunakan Discord.
 */
function sanitizeName(username) {
  return (
    username
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 20)
      .replace(/^-|-$/g, '') || 'member'
  );
}

/**
 * Tombol Accept / Reject untuk admin.
 */
function buildAdminButtons(guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_accept_${guildId}_${userId}`)
      .setLabel('Accept')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`admin_reject_${guildId}_${userId}`)
      .setLabel('Reject')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * Mengecek apakah bot memiliki permission yang diperlukan.
 */
function checkBotPermissions(guild, permissions) {
  const botMember = guild.members.me;

  if (!botMember) {
    throw new Error(
      'Data bot tidak ditemukan di server. Coba restart bot.'
    );
  }

  const missing = permissions.filter(
    (permission) => !botMember.permissions.has(permission)
  );

  if (missing.length > 0) {
    throw new Error(
      `Bot tidak memiliki permission yang diperlukan: ${missing.join(', ')}`
    );
  }

  return botMember;
}

/**
 * Membuat private voice channel untuk verifikasi.
 */
async function createVoiceVerification(member, config) {
  const guild = member.guild;

  console.log(
    `[VOICE VERIFY] Memulai pembuatan channel untuk ${member.user.tag}`
  );

  // ---------------------------------------------------------
  // Cek category
  // ---------------------------------------------------------

  if (!config.ids.verificationCategory) {
    throw new Error(
      'Verification Category ID belum diatur di config.json.'
    );
  }

  const category = guild.channels.cache.get(
    config.ids.verificationCategory
  );

  if (!category) {
    throw new Error(
      'Verification Category tidak ditemukan. Pastikan ID category benar.'
    );
  }

  if (category.type !== ChannelType.GuildCategory) {
    throw new Error(
      'verificationCategory bukan merupakan Category Discord.'
    );
  }

  // ---------------------------------------------------------
  // Cek permission bot
  // ---------------------------------------------------------

  const botMember = checkBotPermissions(guild, [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ManageChannels,
  ]);

  // ---------------------------------------------------------
  // Permission channel
  // ---------------------------------------------------------

  const everyoneId = guild.roles.everyone.id;

  const overwrites = [
    {
      id: everyoneId,
      deny: [
        PermissionFlagsBits.ViewChannel,
      ],
    },

    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    },

    {
      id: botMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  // ---------------------------------------------------------
  // Permission admin
  // ---------------------------------------------------------

  if (config.ids.adminRole) {
    const adminRole = guild.roles.cache.get(
      config.ids.adminRole
    );

    if (adminRole) {
      overwrites.push({
        id: adminRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      });
    }
  }

  // ---------------------------------------------------------
  // Buat channel
  // ---------------------------------------------------------

  let channel;

  try {
    console.log(
      '[VOICE VERIFY] Membuat voice channel...'
    );

    channel = await guild.channels.create({
      name: `🔊・verify-${sanitizeName(member.user.username)}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: overwrites,
    });

  } catch (error) {
    console.error(
      '[VOICE VERIFY] Gagal membuat channel:',
      error
    );

    throw new Error(
      `Gagal membuat voice channel: ${error.message}`
    );
  }

  console.log(
    `[VOICE VERIFY] Channel berhasil dibuat: ${channel.id}`
  );

  // ---------------------------------------------------------
  // Simpan data verifikasi
  // ---------------------------------------------------------

  const record = {
    userId: member.id,
    guildId: guild.id,
    type: 'voice',
    channelId: channel.id,
    createdAt: Date.now(),
  };

  verificationManager.setVerification(
    guild.id,
    member.id,
    record
  );

  // ---------------------------------------------------------
  // Buat embed admin
  // ---------------------------------------------------------

  const adminMention = config.ids.adminRole
    ? `<@&${config.ids.adminRole}>`
    : 'Admin';

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('🔊 Voice Verification')
    .setDescription(
      [
        `${member}, silakan join voice channel ini.`,
        '',
        `${adminMention}, silakan verifikasi member ini.`,
        '',
        'Setelah selesai, tekan tombol **Accept** atau **Reject**.',
      ].join('\n')
    );

  // ---------------------------------------------------------
  // Kirim pesan ke voice channel
  // ---------------------------------------------------------

  try {
    await channel.send({
      embeds: [embed],
      components: [
        buildAdminButtons(
          guild.id,
          member.id
        ),
      ],
    });

  } catch (error) {
    console.error(
      '[VOICE VERIFY] Gagal mengirim pesan:',
      error
    );

    // Kalau gagal kirim pesan, hapus channel
    await channel.delete().catch(() => {});

    verificationManager.deleteVerification(
      guild.id,
      member.id
    );

    throw new Error(
      `Channel berhasil dibuat tetapi bot gagal mengirim pesan: ${error.message}`
    );
  }

  console.log(
    `[VOICE VERIFY] Verifikasi voice selesai dibuat untuk ${member.user.tag}`
  );

  return channel;
}

/**
 * Membuat thread di Forum untuk voice note.
 */
async function createVoiceNoteVerification(member, config) {
  const guild = member.guild;

  console.log(
    `[VOICENOTE VERIFY] Memulai verifikasi untuk ${member.user.tag}`
  );

  // ---------------------------------------------------------
  // Cek Forum ID
  // ---------------------------------------------------------

  if (!config.ids.verificationForum) {
    throw new Error(
      'Verification Forum ID belum diatur di config.json.'
    );
  }

  const forum = guild.channels.cache.get(
    config.ids.verificationForum
  );

  if (!forum) {
    throw new Error(
      'Forum voice-note verification tidak ditemukan.'
    );
  }

  if (forum.type !== ChannelType.GuildForum) {
    throw new Error(
      'verificationForum bukan merupakan Forum Channel.'
    );
  }

  // ---------------------------------------------------------
  // Cek permission bot
  // ---------------------------------------------------------

  checkBotPermissions(guild, [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ManageChannels,
  ]);

  // ---------------------------------------------------------
  // Berikan akses sementara kepada member
  // ---------------------------------------------------------

  try {
    await forum.permissionOverwrites.edit(
      member.id,
      {
        ViewChannel: true,
        SendMessages: true,
        SendMessagesInThreads: true,
        AttachFiles: true,
        ReadMessageHistory: true,
      }
    );

  } catch (error) {
    console.error(
      '[VOICENOTE VERIFY] Gagal memberikan permission:',
      error
    );

    throw new Error(
      `Gagal memberikan akses ke forum: ${error.message}`
    );
  }

  // ---------------------------------------------------------
  // Buat thread
  // ---------------------------------------------------------

  let thread;

  try {
    console.log(
      '[VOICENOTE VERIFY] Membuat thread...'
    );

    thread = await forum.threads.create({
      name: `🎤・verify-${sanitizeName(member.user.username)}`,

      message: {
        content: [
          `${member}, silakan kirim voice note kamu di thread ini.`,
          '',
          'Admin/moderator akan meninjau voice note tersebut.',
          '',
          'Setelah selesai, admin akan menekan tombol **Accept** atau **Reject**.',
        ].join('\n'),
      },
    });

  } catch (error) {
    console.error(
      '[VOICENOTE VERIFY] Gagal membuat thread:',
      error
    );

    // Hapus permission member kalau thread gagal dibuat
    await forum.permissionOverwrites
      .delete(member.id)
      .catch(() => {});

    throw new Error(
      `Gagal membuat thread forum: ${error.message}`
    );
  }

  console.log(
    `[VOICENOTE VERIFY] Thread berhasil dibuat: ${thread.id}`
  );

  // ---------------------------------------------------------
  // Tambahkan member ke thread
  // ---------------------------------------------------------

  await thread.members
    .add(member.id)
    .catch((error) => {
      console.error(
        '[VOICENOTE VERIFY] Gagal menambahkan member ke thread:',
        error
      );
    });

  // ---------------------------------------------------------
  // Simpan record
  // ---------------------------------------------------------

  const record = {
    userId: member.id,
    guildId: guild.id,
    type: 'voicenote',
    channelId: forum.id,
    threadId: thread.id,
    createdAt: Date.now(),
  };

  verificationManager.setVerification(
    guild.id,
    member.id,
    record
  );

  // ---------------------------------------------------------
  // Embed admin
  // ---------------------------------------------------------

  const adminMention = config.ids.adminRole
    ? `<@&${config.ids.adminRole}>`
    : 'Admin';

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('🎤 Voice Note Verification')
    .setDescription(
      [
        `${adminMention}, silakan tinjau voice note dari ${member}.`,
        '',
        'Setelah selesai, tekan tombol **Accept** atau **Reject**.',
      ].join('\n')
    );

  // ---------------------------------------------------------
  // Kirim embed + tombol
  // ---------------------------------------------------------

  try {
    await thread.send({
      embeds: [embed],
      components: [
        buildAdminButtons(
          guild.id,
          member.id
        ),
      ],
    });

  } catch (error) {
    console.error(
      '[VOICENOTE VERIFY] Gagal mengirim embed:',
      error
    );

    await thread.delete().catch(() => {});

    await forum.permissionOverwrites
      .delete(member.id)
      .catch(() => {});

    verificationManager.deleteVerification(
      guild.id,
      member.id
    );

    throw new Error(
      `Thread berhasil dibuat tetapi gagal mengirim pesan: ${error.message}`
    );
  }

  console.log(
    `[VOICENOTE VERIFY] Verifikasi voice note selesai dibuat untuk ${member.user.tag}`
  );

  return thread;
}

/**
 * Membersihkan channel/thread setelah verifikasi selesai.
 */
async function cleanupVerificationChannels(
  guild,
  record
) {
  if (!record) return;

  // ---------------------------------------------------------
  // Voice
  // ---------------------------------------------------------

  if (
    record.type === 'voice' &&
    record.channelId
  ) {
    const channel =
      guild.channels.cache.get(
        record.channelId
      );

    if (channel) {
      await channel
        .delete('Verifikasi selesai')
        .catch(() => {});
    }
  }

  // ---------------------------------------------------------
  // Voice Note
  // ---------------------------------------------------------

  if (
    record.type === 'voicenote'
  ) {

    if (record.threadId) {
      const thread =
        guild.channels.cache.get(
          record.threadId
        );

      if (thread) {
        await thread
          .delete('Verifikasi selesai')
          .catch(() => {});
      }
    }

    if (record.channelId) {
      const forum =
        guild.channels.cache.get(
          record.channelId
        );

      if (forum) {
        await forum.permissionOverwrites
          .delete(record.userId)
          .catch(() => {});
      }
    }
  }
}

/**
 * Admin ACCEPT verification.
 */
async function acceptVerification(
  guild,
  record,
  config
) {
  console.log(
    `[VERIFY] Accept user ${record.userId}`
  );

  const member =
    await guild.members
      .fetch(record.userId)
      .catch(() => null);

  if (member) {
    await roleManager.assignGenderRole(
      member,
      config.ids.femaleRole,
      config
    );
  }

  await cleanupVerificationChannels(
    guild,
    record
  );

  verificationManager.deleteVerification(
    guild.id,
    record.userId
  );

  return member;
}

/**
 * Admin REJECT verification.
 */
async function rejectVerification(
  guild,
  record
) {
  console.log(
    `[VERIFY] Reject user ${record.userId}`
  );

  await cleanupVerificationChannels(
    guild,
    record
  );

  verificationManager.deleteVerification(
    guild.id,
    record.userId
  );
}

module.exports = {
  createVoiceVerification,
  createVoiceNoteVerification,
  acceptVerification,
  rejectVerification,
  cleanupVerificationChannels,
};