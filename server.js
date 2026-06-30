const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Folder untuk tampilan Web
app.use('/output', express.static('output')); // Folder untuk file hasil video

// Lokasi mesin di PC Bos Ahmad
const FFMPEG_PATH = '"C:\\Users\\User\\ffmpeg\\bin\\ffmpeg.exe"';
const YTDLP_PATH  = '"C:\\Users\\User\\ffmpeg\\bin\\yt-dlp.exe"';
const OUTPUT_DIR = path.join(__dirname, 'output');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

console.log("🚀 CINECLIPPER WEB SERVER MENYALA!");
console.log(`🌐 Buka di browser: http://localhost:${PORT}`);

app.post('/api/potong', (req, res) => {
    const { url, start, end } = req.body;
    
    if (!url || !start || !end) {
        return res.status(400).json({ error: "Data tidak lengkap!" });
    }

    const ts = Date.now();
    const tempOut = path.join(OUTPUT_DIR, `temp_${ts}.mp4`);
    const finalOut = path.join(OUTPUT_DIR, `Klip_${ts}.mp4`);

    console.log(`[${ts}] Memproses: ${url} | ${start} -> ${end}`);

    try {
        // 1. Sedot YouTube cerdik
        const dlCmd = `${YTDLP_PATH} --downloader ffmpeg --downloader-args "ffmpeg:-ss ${start} -to ${end}" --no-playlist --no-warnings "${url}" -o "${tempOut}"`;
        execSync(dlCmd, { stdio: 'pipe', encoding: 'utf-8' });

        // 2. Render Vertikal 9:16
        const cropCmd = `${FFMPEG_PATH} -i "${tempOut}" -vf "crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -crf 23 -preset fast -c:a copy -movflags +faststart "${finalOut}" -y`;
        execSync(cropCmd, { stdio: 'pipe', encoding: 'utf-8' });

        console.log(`[${ts}] SUKSES! File siap.`);
        // Kembalikan link video lokal ke Web
        res.json({ success: true, videoUrl: `/output/Klip_${ts}.mp4` });

    } catch (err) {
        console.error(`[${ts}] ERROR:`, err);
        res.status(500).json({ error: "Gagal memproses video. Pastikan link YouTube valid." });
    } finally {
        if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
    }
});

app.listen(PORT, () => {
    console.log("Siap menerima perintah dari Web!");
});