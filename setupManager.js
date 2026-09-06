const { ChannelType, PermissionFlagsBits } = require('discord.js');

/**
 * Cari role berdasarkan id yang tersimpan di config, kalau tidak ada
 * cari berdasarkan nama (case-insensitive), kalau masih tidak ada buat baru.
 */
async function findOrCreateRole(guild, savedId, name, options = {}) {
  if (savedId) {
    const byId = guild.roles.cache.get(savedId);
    if (byId) return { role: byId, created: false };
  }

  const byName = guild.roles.cache.find(
    (r) => r.name.toLowerCase() === name.toLowerCase()
  );
  if (byName) return { role: byName, created: false };

  const role = await guild.roles.create({
    name,
    mentionable: false,
    ...options,
  });
  return { role, created: true };
}

/**
 * Cari channel berdasarkan id tersimpan, lalu nama, lalu buat baru kalau
 * belum ada. type = ChannelType.GuildText / GuildForum / GuildCategory.
 */
async function findOrCreateChannel(guild, savedId, name, type, extraOptions = {}) {
  if (savedId) {
    const byId = guild.channels.cache.get(savedId);
    if (byId) return { channel: byId, created: false };
  }

  const byName = guild.channels.cache.find(
    (c) => c.type === type && c.name.toLowerCase() === name.toLowerCase()
  );
  if (byName) return { channel: byName, created: false };

  const channel = await guild.channels.create({
    name,
    type,
    ...extraOptions,
  });
  return { channel, created: true };
}

/**
 * Setup lengkap: role gender, role unverified, role admin, category
 * verifikasi, channel welcome, channel pilih role, forum voice-note.
 * Mengembalikan objek ringkasan (apa yang dibuat / apa yang sudah ada)
 * supaya bisa ditampilkan ke admin yang menjalankan !setup.
 */
async function runFullSetup(guild, config) {
  const summary = [];
  const ids = config.ids;
  const names = config.names;

  // --- Roles ---
  const female = await findOrCreateRole(guild, ids.femaleRole, names.femaleRole, {
    color: 0xff70a6,
  });
  ids.femaleRole = female.role.id;
  summary.push(`Role Perempuan: ${female.role} ${female.created ? '(dibuat baru)' : '(sudah ada)'}`);

  const male = await findOrCreateRole(guild, ids.maleRole, names.maleRole, {
    color: 0x5aa9ff,
  });
  ids.maleRole = male.role.id;
  summary.push(`Role Laki-laki: ${male.role} ${male.created ? '(dibuat baru)' : '(sudah ada)'}`);

  const unverified = await findOrCreateRole(guild, ids.unverifiedRole, names.unverifiedRole, {
    color: 0x99aab5,
  });
  ids.unverifiedRole = unverified.role.id;
  summary.push(`Role Unverified: ${unverified.role} ${unverified.created ? '(dibuat baru)' : '(sudah ada)'}`);

  const admin = await findOrCreateRole(guild, ids.adminRole, names.adminRole, {
    color: 0xed4245,
  });
  ids.adminRole = admin.role.id;
  summary.push(`Role Admin verifikasi: ${admin.role} ${admin.created ? '(dibuat baru, atur permission moderasi secara manual jika perlu)' : '(sudah ada)'}`);

  // --- Category verifikasi ---
  const category = await findOrCreateChannel(
    guild,
    ids.verificationCategory,
    names.verificationCategory,
    ChannelType.GuildCategory,
    {
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: admin.role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageThreads,
          ],
        },
        {
          id: guild.members.me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageThreads,
          ],
        },
      ],
    }
  );
  ids.verificationCategory = category.channel.id;
  summary.push(`Category verifikasi: ${category.channel.name} ${category.created ? '(dibuat baru)' : '(sudah ada)'}`);

  // --- Welcome channel ---
  const welcome = await findOrCreateChannel(
    guild,
    ids.welcomeChannel,
    names.welcomeChannel,
    ChannelType.GuildText
  );
  ids.welcomeChannel = welcome.channel.id;
  summary.push(`Channel welcome: ${welcome.channel} ${welcome.created ? '(dibuat baru)' : '(sudah ada)'}`);

  // --- Gender selection channel ---
  const genderChannel = await findOrCreateChannel(
    guild,
    ids.genderChannel,
    names.genderChannel,
    ChannelType.GuildText
  );
  ids.genderChannel = genderChannel.channel.id;
  summary.push(`Channel pilih role: ${genderChannel.channel} ${genderChannel.created ? '(dibuat baru)' : '(sudah ada)'}`);

  // --- Forum voice-note verification ---
  const forum = await findOrCreateChannel(
    guild,
    ids.verificationForum,
    names.verificationForum,
    ChannelType.GuildForum,
    {
      parent: category.channel.id,
      topic: 'Kirim voice note di sini untuk proses verifikasi role Perempuan.',
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: admin.role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessagesInThreads,
            PermissionFlagsBits.ManageThreads,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: guild.members.me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessagesInThreads,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.ManageThreads,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.AttachFiles,
          ],
        },
      ],
    }
  );
  ids.verificationForum = forum.channel.id;
  summary.push(`Forum voice-note verifikasi: ${forum.channel} ${forum.created ? '(dibuat baru)' : '(sudah ada)'}`);

  return summary;
}

module.exports = { findOrCreateRole, findOrCreateChannel, runFullSetup };
