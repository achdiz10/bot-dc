# Discord Verification Bot

Bot Discord berbasis **prefix command** (bukan slash command) menggunakan **Node.js + Discord.js v14**.

Fitur:
- Welcome message otomatis untuk member baru (embed + GIF + info rules/role).
- Sistem role gender (Laki-laki langsung, Perempuan wajib verifikasi).
- Verifikasi gender Perempuan lewat **Voice Channel privat** atau **Voice Note (Forum thread)**.
- Admin/moderator Accept/Reject lewat tombol.
- Auto cleanup channel/thread/data setelah verifikasi selesai atau member keluar server.
- `!setup` otomatis mencari/membuat channel & role yang dibutuhkan (tidak perlu isi banyak ID manual).

---

## 1. Instalasi

```bash
npm install
```

## 2. Masukkan Token Bot

1. Buat bot di https://discord.com/developers/applications
2. Di tab **Bot**, aktifkan 3 intents berikut (WAJIB, kalau tidak bot akan error saat start):
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`
   - (Presence intent tidak wajib)
3. Copy file `.env.example` menjadi `.env`:

   ```bash
   cp .env.example .env
   ```

4. Buka `.env` dan isi:

   ```
   DISCORD_TOKEN=token_bot_kamu_di_sini
   ```

## 3. Mengatur Prefix

Semua command diatur lewat **satu tempat**: `config.json`.

```json
{
  "prefix": "!"
}
```

Ganti `"!"` menjadi prefix apapun yang kamu mau, misalnya `"y."`. Tidak perlu edit kode.

Kamu juga bisa mengganti nama-nama default channel/role yang akan dicari/dibuat otomatis lewat bagian `"names"` di `config.json`, sebelum menjalankan `!setup` pertama kali:

```json
"names": {
  "welcomeChannel": "welcome",
  "genderChannel": "pilih-role",
  "verificationCategory": "Verifikasi Gender",
  "verificationForum": "voice-note-verifikasi",
  "femaleRole": "Perempuan",
  "maleRole": "Laki-laki",
  "unverifiedRole": "Unverified",
  "adminRole": "Admin"
}
```

## 4. Undang Bot ke Server

Buat invite link di Developer Portal (tab **OAuth2 > URL Generator**) dengan scope `bot`, dan minimal permission berikut:

- Manage Roles
- Manage Channels
- Manage Threads
- View Channels
- Send Messages
- Send Messages in Threads
- Create Public Threads
- Connect (voice)
- Embed Links
- Attach Files

Setelah bot masuk ke server, **naikkan posisi role bot** di *Server Settings > Roles* ke atas role `Perempuan`, `Laki-laki`, dan `Unverified` yang akan dibuat/dipakai bot. Bot tidak bisa mengatur role yang posisinya di atas role bot sendiri (ini keterbatasan Discord API, bukan bug).

## 5. Jalankan Bot

```bash
node index.js
```

atau

```bash
npm start
```

## 6. Jalankan `!setup`

Setelah bot online, jalankan di server (hanya bisa oleh Administrator):

```
!setup
```

Command ini akan:
- Mencari role `Perempuan`, `Laki-laki`, `Unverified`, `Admin` berdasarkan ID yang tersimpan, lalu berdasarkan nama — kalau tidak ketemu, **dibuat otomatis**.
- Mencari/membuat category verifikasi.
- Mencari/membuat channel welcome & channel pilih role.
- Mencari/membuat forum channel untuk voice note verification.
- Mengirim pesan pilih role gender (tombol 👦 Laki-laki / 👧 Perempuan) di channel pilih role.
- Menyimpan semua ID yang ditemukan/dibuat ke `config.json` bagian `"ids"` supaya `!setup` berikutnya tidak membuat duplikat.

Jalankan `!setup` lagi kapan saja jika ada channel/role yang tidak sengaja terhapus — bot akan mendeteksi dan membuat ulang hanya yang hilang.

Command lain:
- `!gender` — mengirim ulang pesan pilih role gender (misalnya setelah kamu edit teksnya di `commands/setup.js`).
- `!help` — menampilkan daftar command.

---

## Cara Kerja Verifikasi Perempuan

1. Member menekan tombol **👧 Perempuan** di channel pilih role.
2. Bot menampilkan pilihan metode verifikasi (hanya terlihat oleh member itu sendiri):
   - **🔊 Voice Verification** — bot membuat voice channel privat `🔊・verify-namamember`, hanya bisa diakses member tsb + role Admin + bot.
   - **🎤 Voice Note Verification** — bot membuat thread privat `🎤・verify-namamember` di forum channel, member mengirim voice note di sana.
3. Admin (role yang ditandai sebagai `adminRole` di config, atau siapapun dengan permission Administrator) meninjau, lalu menekan tombol **✅ Accept** atau **❌ Reject** yang muncul di channel/thread tersebut.
4. Jika **Accept**: member mendapat role Perempuan, role gender lain dilepas, channel/thread dihapus, data verifikasi dibersihkan.
5. Jika **Reject**: channel/thread dihapus, data dibersihkan, member bisa mengulang proses verifikasi dari awal.
6. Jika member keluar server sebelum verifikasi selesai, channel/thread dan datanya otomatis dibersihkan.

> **Catatan privasi forum:** Discord tidak mendukung permission per-thread khusus di dalam forum channel. Bot mengatasi ini dengan memberi akses sementara ke forum channel hanya untuk member yang sedang diverifikasi (lewat permission overwrite), lalu mencabutnya setelah selesai. Selama proses berjalan, member yang sedang verifikasi berpotensi melihat thread verifikasi member lain yang kebetulan berjalan bersamaan — kalau butuh privasi 100%, gunakan metode **Voice Verification** yang memang dirancang privat penuh.

---

## Struktur Project

```
discord-bot/
├── index.js                     # entry point
├── package.json
├── config.json                  # prefix, nama channel/role, ID hasil !setup
├── .env.example
├── data/
│   └── verification.json        # data verifikasi berjalan (auto-generated)
├── commands/
│   ├── setup.js                 # !setup
│   ├── gender.js                # !gender
│   └── help.js                  # !help
├── handlers/
│   ├── messageCreate.js         # router command prefix
│   ├── interactionCreate.js     # semua tombol (pilih gender, metode, accept/reject)
│   ├── guildMemberAdd.js        # welcome message + role unverified
│   ├── guildMemberRemove.js     # cleanup jika member keluar saat verifikasi
│   └── voiceStateUpdate.js      # notifikasi admin saat member join voice verifikasi
├── managers/
│   ├── verificationManager.js   # baca/tulis data/verification.json
│   ├── roleManager.js           # assign role gender dengan aman (cek hierarki)
│   ├── setupManager.js          # logic find-or-create untuk !setup
│   └── verificationFlow.js      # logic buat/accept/reject voice & voice-note
└── utils/
    ├── config.js                # baca/tulis config.json
    ├── permissions.js           # cek apakah member adalah admin verifikasi
    └── logger.js
```

## Troubleshooting

- **Bot tidak merespon command** → cek `MESSAGE CONTENT INTENT` sudah aktif di Developer Portal, dan prefix di `config.json` sudah sesuai.
- **`!setup` gagal / role tidak bisa diberikan** → posisi role bot di *Server Settings > Roles* harus lebih tinggi dari role `Perempuan`/`Laki-laki`/`Unverified` yang dikelola bot.
- **Bot tidak bisa membuat forum channel** → pastikan server sudah mendukung Forum Channel (fitur ini tersedia di semua server saat ini, tapi pastikan bot punya permission Manage Channels).
- **Ingin reset semua konfigurasi** → hapus isi `"ids"` di `config.json` (set semua jadi `null`) lalu jalankan `!setup` lagi. Channel/role lama tidak otomatis terhapus, hanya tidak dipakai lagi.
