const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. SETUP LOKASI FILE (Sesuai PC Anda)
const FFMPEG_PATH = `"C:\\Users\\User\\ffmpeg\\bin\\ffmpeg.exe"`;
const YTDLP_PATH  = `"C:\\Users\\User\\ffmpeg\\bin\\yt-dlp.exe"`; 
const OUTPUT_DIR  = path.join(__dirname, 'output');

// Buat folder output jika belum ada
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// ==========================================
// 2. MASUKKAN LINK FILM DAN DATA KLIP DI SINI
// ==========================================
const VIDEO_URL = "https://www.youtube.com/watch?v=JfVOs4VSpmA";

const clipsData = [
    {
        "id": 1,
        "title": "Tes Adegan Pertama",
        "timestamp_adegan": "00:01:10 -> 00:01:20"
    }
];
   
    // Paste sisa klip dari Web Clipper-AH ke sini nanti...

// ==========================================

console.log(`\n🚀 MEMULAI PROSES PENYEDOTAN & PEMOTONGAN OTOMATIS!`);
console.log(`🔗 Target URL: ${VIDEO_URL}\n`);

// 3. PROSES EKSEKUSI (Satu per satu)
clipsData.forEach((clip) => {
    const timeParts = clip.timestamp_adegan.split('->').map(t => t.trim());
    if (timeParts.length !== 2) return;

    const startTime = timeParts[0];
    const endTime = timeParts[1];

    const safeTitle = clip.title.replace(/[^a-zA-Z0-9]/g, '_');
    const tempVideo = path.join(OUTPUT_DIR, `temp_${clip.id}.mp4`);
    const finalVideo = path.join(OUTPUT_DIR, `Klip_${clip.id}_${safeTitle}_9x16.mp4`);

    console.log(`\n⏳ [Klip ${clip.id}] Menyedot adegan: ${clip.title} (${startTime} - ${endTime})...`);

    // TAHAP A: Menyedot langsung dari internet
    const downloadCmd = `${YTDLP_PATH} --ffmpeg-location ${FFMPEG_PATH} -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --download-sections "*${startTime}-${endTime}" "${VIDEO_URL}" -o "${tempVideo}"`;

    try {
        execSync(downloadCmd, { stdio: 'ignore' });
        console.log(`✅ Sedot berhasil! Sekarang mengubah rasio ke Vertikal 9:16...`);

        // TAHAP B: Memotong (Crop) rasio vertikal TikTok/Shorts (9:16)
        const cropCmd = `${FFMPEG_PATH} -i "${tempVideo}" -vf "crop=ih*9/16:ih" -c:v libx264 -crf 23 -preset fast -c:a copy "${finalVideo}" -y`;
        
        execSync(cropCmd, { stdio: 'ignore' });
        
        // TAHAP C: Bersihkan file temp
        if (fs.existsSync(tempVideo)) {
            fs.unlinkSync(tempVideo);
        }

        console.log(`🎉 Selesai! Tersimpan sebagai: Klip_${clip.id}_${safeTitle}_9x16.mp4`);

    } catch (error) {
        console.error(`❌ Gagal memproses klip ${clip.id}. Pastikan link bisa diakses atau format waktu benar.`);
        if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
    }
});

console.log(`\n✅ SEMUA TUGAS SELESAI! Silakan buka folder 'output' untuk melihat hasilnya.`);