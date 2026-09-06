const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'verification.json');

function ensureFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2), 'utf8');
  }
}

function loadData() {
  ensureFile();
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch (err) {
    return {};
  }
}

function saveData(data) {
  ensureFile();
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function makeKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

/**
 * Mengambil data verifikasi yang sedang berjalan untuk seorang member.
 */
function getVerification(guildId, userId) {
  const data = loadData();
  return data[makeKey(guildId, userId)] || null;
}

/**
 * record contoh:
 * {
 *   userId, guildId, type: 'voice' | 'voicenote',
 *   channelId,      // id voice channel (type voice) ATAU forum channel id (type voicenote)
 *   threadId,       // hanya untuk type voicenote
 *   adminMessageChannelId, // channel tempat tombol accept/reject dikirim
 *   adminMessageId,
 *   createdAt
 * }
 */
function setVerification(guildId, userId, record) {
  const data = loadData();
  data[makeKey(guildId, userId)] = record;
  saveData(data);
}

function deleteVerification(guildId, userId) {
  const data = loadData();
  const key = makeKey(guildId, userId);
  if (data[key]) {
    delete data[key];
    saveData(data);
    return true;
  }
  return false;
}

/**
 * Mencari record verifikasi berdasarkan channel/thread id.
 * Berguna saat tombol accept/reject ditekan di dalam voice channel
 * atau thread forum, supaya kita tahu ini verifikasi milik siapa.
 */
function findByChannelId(channelId) {
  const data = loadData();
  for (const key of Object.keys(data)) {
    const record = data[key];
    if (record.channelId === channelId || record.threadId === channelId) {
      const [guildId, userId] = key.split(':');
      return { guildId, userId, record };
    }
  }
  return null;
}

function getAllForGuild(guildId) {
  const data = loadData();
  return Object.entries(data)
    .filter(([key]) => key.startsWith(`${guildId}:`))
    .map(([key, record]) => ({ userId: key.split(':')[1], record }));
}

module.exports = {
  getVerification,
  setVerification,
  deleteVerification,
  findByChannelId,
  getAllForGuild,
};
