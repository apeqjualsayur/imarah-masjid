---
title: Mendaftar isi rumah dan import CSV
screen: /kariah
roles: [setiausaha]
---

# Mendaftar isi rumah dan import CSV

Daftar kariah menyimpan isi rumah dalam kawasan masjid: nama ketua keluarga, alamat, telefon, ahli keluarga dan persetujuan mereka. Hanya Setiausaha boleh menambah, mengubah dan mengimport. Pengerusi, Bendahari dan AJK boleh melihat. Imam tidak melihat daftar kariah.

## Menambah satu isi rumah

1. Pergi ke **Kariah** dan tekan **Tambah isi rumah**.
2. Isi **Nama ketua keluarga**, **Alamat** dan **Telefon** (contoh 012-345 6789).
3. Tanda kotak persetujuan jika isi rumah bersetuju:
   - **WhatsApp**: menerima hebahan masjid melalui WhatsApp (perlukan nombor telefon bimbit).
   - **PDPA**: maklumat disimpan oleh masjid untuk urusan kariah dan khairat sahaja.
4. Tekan **Simpan**. Tarikh persetujuan direkodkan secara automatik.
5. Di halaman isi rumah, tekan **Tambah ahli** untuk setiap ahli keluarga: nama, hubungan, tarikh lahir dan 4 digit terakhir No. KP.

**No. KP:** hanya 4 digit terakhir disimpan. Jika anda tertampal nombor penuh, Imarah memotongnya sebelum disimpan.

## Mengimport dari Excel (CSV)

1. Pergi ke **Kariah** dan tekan **Import CSV**.
2. Tekan **Muat turun templat CSV**. Buka dalam Excel atau Google Sheets.
3. Isi satu baris untuk setiap isi rumah: nama_ketua, alamat, telefon, whatsapp (ya/tidak), pdpa (ya/tidak).
4. Simpan sebagai **CSV**. (Dalam Excel: Fail > Simpan Sebagai > CSV UTF-8.)
5. Kembali ke Imarah, pilih fail dan tekan **Semak fail**. Tiada apa yang disimpan lagi.
6. Semak pratonton. Baris hijau akan diimport. Baris yang ada ralat menunjukkan sebabnya.
7. Tekan **Import**. Hanya baris tanpa ralat diimport. Ringkasan menunjukkan berapa yang diimport dan dilangkau.
8. Betulkan baris yang dilangkau dalam fail dan import semula. Baris yang sudah diimport akan dikesan sebagai "Sudah didaftarkan" dan tidak diulang.

Ahli keluarga ditambah di halaman setiap isi rumah selepas import.

## Mengubah atau memadam

- Buka isi rumah dan tekan **Ubah**. Membuang tanda kotak persetujuan akan memadam tarikh persetujuan.
- **Padam isi rumah** memadam isi rumah dan semua ahlinya. Ia tidak boleh dipadam jika ada rekod khairat atau kewangan yang berkaitan.

## Sejarah perubahan

Pengerusi dan Bendahari boleh melihat **Sejarah perubahan** di bawah setiap isi rumah: siapa mengubah, bila, dan medan mana. Untuk maklumat peribadi (nama, alamat, telefon, No. KP), hanya "diubah" dipaparkan. Nilai lama tidak disimpan dalam log, untuk melindungi privasi.

## Jika ada masalah

- **"Nombor telefon telah dirosakkan oleh Excel (contoh 1.23E+09)."** Dalam Excel, format lajur telefon sebagai Teks dan taip semula nombor.
- **"Nombor telefon tidak sah."** Semak bilangan digit. Nombor bimbit bermula 01 dan mempunyai 10 atau 11 digit.
- **"WhatsApp perlukan nombor telefon bimbit."** Nombor talian tetap (03, 04 ...) tidak boleh menerima WhatsApp.
- **"Sudah didaftarkan dalam kariah."** Isi rumah dengan telefon yang sama, atau nama dan alamat yang sama, sudah ada.
- **"Lajur nama tidak dijumpai."** Baris pertama fail mesti mengandungi nama lajur seperti dalam templat.
- **Huruf pelik (contoh Ã©) dalam nama.** Simpan semula fail sebagai "CSV UTF-8".
