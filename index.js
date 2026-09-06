require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const logger = require('./utils/logger');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  logger.error('DISCORD_TOKEN tidak ditemukan. Buat file .env berdasarkan .env.example lalu isi token bot kamu.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ---------- Load commands (prefix based, bukan slash command) ----------
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command?.name) {
    client.commands.set(command.name, command);
    logger.info(`Command dimuat: ${command.name}`);
  }
}

// ---------- Load event handlers ----------
const handlersPath = path.join(__dirname, 'handlers');
for (const file of fs.readdirSync(handlersPath).filter((f) => f.endsWith('.js'))) {
  const registerHandler = require(path.join(handlersPath, file));
  if (typeof registerHandler === 'function') {
    registerHandler(client);
    logger.info(`Handler dimuat: ${file}`);
  }
}

client.once('ready', () => {
  logger.info(`Bot login sebagai ${client.user.tag}`);
  logger.info('Gunakan command !setup di server untuk menyiapkan channel/role otomatis.');
});

client.on('error', (err) => logger.error('Client error:', err));
process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));

client.login(process.env.DISCORD_TOKEN);
