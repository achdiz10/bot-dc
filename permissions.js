const { PermissionFlagsBits } = require('discord.js');

/**
 * Member dianggap admin verifikasi jika punya permission Administrator
 * ATAU punya role admin yang di-set di config.ids.adminRole.
 */
function isVerificationAdmin(member, config) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const adminRoleId = config?.ids?.adminRole;
  if (adminRoleId && member.roles.cache.has(adminRoleId)) return true;
  return false;
}

module.exports = { isVerificationAdmin };
