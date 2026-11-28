---
title: "Padanan bank dan penyesuaian bulanan"
screen: /kewangan/bank
roles: [pengerusi, bendahari]
---

# Padanan bank dan penyesuaian bulanan

**Padanan bank** membandingkan penyata bank masjid dengan lejar Imarah. Matlamatnya: **beza RM 0.00** untuk setiap bulan, sebelum bulan itu dikunci.

- **Import, padan, tanda tunai, batal import:** Bendahari sahaja.
- **Melihat penyesuaian:** Pengerusi dan Bendahari.
- Imarah tidak pernah meminta atau menyimpan kata laluan atau log masuk bank. Anda memuat naik penyata sendiri.

## 1. Muat turun penyata dari bank

Dalam perbankan internet bank masjid, muat turun penyata akaun sebagai **CSV** (kadang-kadang dipanggil "Excel (CSV)" atau "Export"). Satu bulan atau lebih.

## 2. Import penyata

1. Pergi ke **Kewangan > Padanan bank** dan tekan **Import penyata**.
2. Pilih fail CSV.
3. **Kali pertama untuk bank ini:** pilih **Bank baharu**, isi nama bank (contoh "Maybank akaun utama"), dan semak lajur yang dipilih:
   - **Lajur tarikh** dan **susunan tarikh** (biasanya Hari/Bulan/Tahun).
   - **Lajur keterangan** (dan lajur kedua, contoh rujukan, jika mahu).
   - **Debit dan kredit berasingan**, atau **satu lajur amaun** (wang keluar bertanda tolak, DR atau dalam kurungan).

   Imarah meneka lajur daripada nama tajuk. Pilihan ini disimpan, jadi penyata seterusnya dari bank yang sama terus dikenali.
4. Tekan **Semak**. Senarai menunjukkan setiap baris: **Baharu**, **Sudah ada** (sudah diimport sebelum ini) atau **Bulan dikunci**.
5. Tekan **Import N baris baharu**.

Mengimport fail yang sama dua kali **tidak menambah apa-apa**. Imarah mengenal baris yang sudah ada melalui tarikh, amaun dan keterangan. Dua bayaran yang sama pada hari yang sama dalam satu penyata tetap dikira sebagai dua.

## 3. Padankan setiap baris

Selepas import, Imarah membuka penyesuaian bulan itu.

- **Cadangan:** untuk setiap baris bank, Imarah mencari entri lejar dengan **amaun dan arah yang sama**, bertarikh **dalam 3 hari**. Tekan **Terima** jika betul, atau **Tolak** (ia tidak akan dicadangkan lagi untuk baris itu).
- **Pilihan lain:** buka baris itu untuk memilih mana-mana entri dengan amaun yang sama, pada sebarang tarikh.
- **Cipta entri lejar:** untuk wang yang belum direkod (contoh derma terus ke akaun). Borang diisi dengan tarikh, amaun dan keterangan; pilih dana dan kategori, kemudian simpan. Ia dipadankan sendiri.
- **Tanda sebagai deposit tunai:** untuk wang tunai yang dimasukkan ke bank (contoh kutipan Jumaat). Wang itu sudah ada dalam lejar sebagai entri tunai, jadi tiada entri baharu diperlukan. Begitu juga **pengeluaran tunai** dari bank.

Satu baris bank dipadankan dengan satu entri sahaja. Entri tunai tidak boleh dipadankan kerana tidak melalui bank.

## 4. Baca penyesuaian

- **Jumlah bank:** semua baris bank bulan itu (masuk tolak keluar).
- **Jumlah lejar:** entri pindahan bank, DuitNow dan cek bulan itu, ditambah deposit dan pengeluaran tunai yang ditanda.
- **Beza:** jumlah bank tolak jumlah lejar. Apabila semuanya dipadankan, beza ialah **RM 0.00** dan tertera **Seimbang**.

Jika ada beza, lihat:

- **Baris bank belum dipadankan:** contoh caj bank. Cipta entri lejar untuknya (kategori perbelanjaan yang sesuai).
- **Entri lejar tiada dalam bank:** contoh cek yang belum ditunaikan, atau entri yang direkod dengan kaedah yang salah.
- **Dipadankan dengan bulan lain:** bank dan lejar mencatat pada bulan berlainan (contoh pindahan 30hb yang masuk ke bank 2hb). Ini beza masa yang sah.

## Membetulkan kesilapan

- **Padanan salah:** buka bahagian **Sudah dipadankan atau ditanda** dan tekan **Nyahpadan** (atau **Buang tanda tunai**).
- **Lajur salah semasa import:** di halaman **Import penyata**, bawah **Import terdahulu**, tekan **Batalkan import**. Ini hanya boleh sebelum mana-mana baris dipadankan. Kemudian import semula.
- **Entri lejar dibatalkan:** padanannya dibuang secara automatik. Padankan baris bank itu dengan entri yang betul.

Bulan yang sudah dikunci tidak boleh diubah: import, padanan dan tanda tunai ditolak untuk bulan itu.

Semua tindakan direkod dalam log audit. Keterangan bank tidak disimpan dalam log kerana mungkin mengandungi nama penderma.

## Jika ada masalah

- **"Lajur yang dipilih tiada dalam fail ini."** Bank menukar format fail. Pilih **Bank baharu** dan pilih lajur semula.
- **"tarikh tidak dapat dibaca" pada baris tertentu.** Semak **Susunan tarikh**. Baris itu dilangkau; baris lain masih boleh diimport.
- **"Semua baris sudah diimport."** Fail ini sudah diimport sebelum ini. Tiada apa yang perlu dibuat.
- **"Entri tunai tidak melalui bank."** Jika wang itu sebenarnya pindahan bank, batalkan entri itu dan rekod semula dengan kaedah yang betul.
- **"Bulan ini sudah dikunci."** Minta Pengerusi membuka kunci bulan itu (dengan sebab) jika perlu dibetulkan.
