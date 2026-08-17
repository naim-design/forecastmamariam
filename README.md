# Naim Sales Performance

Standalone HTML dashboard untuk rekod sales Naim.

## Data sejarah
- Historical data dibawa masuk daripada `Forecast Sales Naim.xlsx`
- Tempoh tersedia: Mac 2024 hingga Julai 2026
- Data sejarah disimpan terus dalam `js/historical-data.js`
- Tidak perlukan Firebase/database untuk melihat data lama

## Data baru
Input baru disimpan menggunakan browser `localStorage`.
Gunakan menu **Backup Data** untuk export JSON secara berkala.

## Deploy
Upload semua fail/folder ini ke repository GitHub baru, kemudian import repository tersebut ke Vercel.
Framework preset: **Other**
Root directory: `./`
Build command: kosong
Output directory: kosong
