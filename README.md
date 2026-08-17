# Naim Sales Performance V2

Versi yang diperbetulkan berdasarkan struktur `Forecast Sales Naim.xlsx`.

## Formula utama
- Total Sales = WhatsApp + Live cycle.
- Live cycle bulan = Live 26hb–akhir bulan sebelumnya + Live 1hb–25hb bulan semasa.
- Live 26hb–akhir bulan semasa dibawa ke bulan berikutnya.
- TikTok GMV **tidak** dimasukkan dalam Total Sales; ia dipaparkan sebagai Marketing GMV.
- Komisen WhatsApp + Live = `max(Total Sales - RM1,000, 0) × 4%` secara default.
- ROI GMV = `Sales GMV / (Ads Cost + SST)`.
- Default SST = 8% (boleh ubah dalam Rules & Setting).
- Default GMV: ROI >= 5 = 2%, ROI < 5 = 1%. Ini boleh diubah di setting.

## COD
COD Tracker menyimpan:
- tarikh submit
- M9F / M9F 1
- nombor COD/order
- nama customer
- telefon
- nilai
- tarikh follow-up
- status Pending/Settled/Return

## Historical
Data asal Mac 2024–Julai 2026 dimasukkan terus dari workbook.
Bulan yang mempunyai section Live/GMV akan dipaparkan bersama breakdown tersebut.

## Deploy
Upload seluruh isi folder ini ke repo GitHub `forecastmamariam` (replace fail lama), commit, kemudian tunggu Vercel auto deploy.
