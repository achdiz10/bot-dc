const { PermissionFlagsBits } = require('discord.js');

/**
 * Resolve role dari cache, fallback ke fetch API kalau belum ada di cache.
 */
async function resolveRole(guild, roleId) {
  if (!roleId) return null;
  const cached = guild.roles.cache.get(roleId);
  if (cached) return cached;
  try {
    return await guild.roles.fetch(roleId);
  } catch (err) {
    return null;
  }
}

/**
 * Cek apakah bot punya permission ManageRoles DAN posisi role bot
 * lebih tinggi dari role target. Ini WAJIB dicek supaya bot tidak
 * mencoba memberi/menghapus role yang posisinya lebih tinggi dari bot,
 * karena Discord API akan menolak dan bot butuh guard sebelum call API.
 */
function botCanManageRole(guild, role) {
  const botMember = guild.members.me;
  if (!botMember || !role) return false;
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) return false;
  return botMember.roles.highest.position > role.position;
}

/**
 * Melepas semua role gender (male & female) dari member.
 * Dipakai untuk mencegah member memiliki lebih dari satu role gender.
 */
async function clearGenderRoles(member, config) {
  const ids = config.ids;
  const genderRoleIds = [ids.femaleRole, ids.maleRole].filter(Boolean);
  for (const roleId of genderRoleIds) {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId).catch(() => {});
    }
  }
}

/**
 * Memberikan role gender ke member, otomatis melepas role gender lain
 * dan role unverified. Melempar Error dengan pesan yang bisa langsung
 * ditampilkan ke user kalau gagal (role tidak ada / posisi bot terlalu rendah).
 */
async function assignGenderRole(member, roleId, config) {
  const guild = member.guild;
  const role = await resolveRole(guild, roleId);
  if (!role) {
    throw new Error('Role tujuan tidak ditemukan di server. Jalankan `!setup` ulang.');
  }
  if (!botCanManageRole(guild, role)) {
    throw new Error(
      `Bot tidak bisa memberikan role **${role.name}** karena posisi role bot lebih rendah atau bot tidak punya permission "Manage Roles". Pindahkan role bot ke atas role tersebut di Server Settings > Roles.`
    );
  }

  await clearGenderRoles(member, config);
  await member.roles.add(role);

  const unverifiedRoleId = config.ids.unverifiedRole;
  if (unverifiedRoleId && member.roles.cache.has(unverifiedRoleId)) {
    await member.roles.remove(unverifiedRoleId).catch(() => {});
  }
}

async function removeUnverifiedRole(member, config) {
  const unverifiedRoleId = config.ids.unverifiedRole;
  if (unverifiedRoleId && member.roles.cache.has(unverifiedRoleId)) {
    await member.roles.remove(unverifiedRoleId).catch(() => {});
  }
}

module.exports = {
  resolveRole,
  botCanManageRole,
  clearGenderRoles,
  assignGenderRole,
  removeUnverifiedRole,
};
