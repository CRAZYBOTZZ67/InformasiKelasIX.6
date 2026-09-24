# KELAS IX.6 — Web Chat

Project ini mempertahankan halaman `InformasiKelas.html` sebagai basis, lalu menambahkan aplikasi chat bergaya WhatsApp.

## Fitur
- Login 1 akun per orang.
- Hanya 4 username yang diizinkan: Rizky, Chalista, Syakina, Nadira.
- Admin bisa membuat akun yang belum ada, dengan batas maksimal 4 profile.
- Private chat realtime.
- Buat grup + pilih anggota + foto grup.
- Buat saluran/channel + pilih anggota + foto saluran.
- Status/SW 24 jam + mention `@Rizky`, `@Chalista`, `@Syakina`, `@Nadira`.
- Foto profil upload langsung ke Storage.
- Bio dan nama tampilan.
- Data chat/profile/status tersimpan di PostgreSQL Supabase.
- Realtime message/status melalui Supabase Realtime.

## Akun awal
Script `seed-users.mjs` membuat:
- Rizky — admin — `Rizky12345`
- Chalista — user — `Chalista12345`
- Syakina — user — `Syakina12345`
- Nadira — user — `Nadira12345`

Password tersebut hanya password awal untuk instalasi. Ganti setelah login bila nanti ingin sistem produksi.

## Setup Supabase
1. Buat project baru di Supabase.
2. Buka SQL Editor dan jalankan seluruh `schema.sql`.
3. Aktifkan Realtime untuk tabel `messages` dan `statuses` (script sudah mencoba menambahkannya ke publication).
4. Jalankan seed dari komputer/VPS yang memiliki Node 20+:

```bash
SUPABASE_URL="https://PROJECT.supabase.co" SUPABASE_SERVICE_ROLE_KEY="SERVICE_ROLE_KEY" node seed-users.mjs
```

Jangan pernah memasukkan `SUPABASE_SERVICE_ROLE_KEY` ke HTML atau frontend.

## Setup Vercel
Di Vercel → Project → Settings → Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Import repository GitHub ini ke Vercel. Vercel akan menjalankan `api/config.js` untuk memberikan URL + anon key ke frontend dan `api/admin.js` untuk pembuatan akun admin.

## Catatan keamanan
- Service role key hanya dipakai server-side di `api/admin.js`.
- RLS Supabase membatasi percakapan, anggota, pesan, dan status.
- Username dibatasi ke empat nama yang ditentukan.
- Untuk produksi, tambahkan validasi ukuran/jenis media dan kebijakan moderasi sesuai kebutuhan.
