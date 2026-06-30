const { Telegraf } = require('telegraf');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ==================== KONFIGURASI ====================
const token = '8633807429:AAGX694OcjcQ7s6xBL6FKXnKTRBNDM_vM_U';
const myChatId = 8196598586;

const FFMPEG_PATH = '"C:\\Users\\User\\ffmpeg\\bin\\ffmpeg.exe"';
const YTDLP_PATH  = '"C:\\Users\\User\\ffmpeg\\bin\\yt-dlp.exe"';

const OUTPUT_DIR = path.join(__dirname, 'output');
const INPUT_DIR  = path.join(__dirname, 'input');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR);

const bot = new Telegraf(token);

console.log("🚀 CINECLIPPER YOUTUBE EDITION AKTIF!");
console.log("Menunggu perintah Bos Ahmad...");

// ==================== HELPERS ====================
function parsePotong(text) {
    let clean = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2');
    const regex = /(https?:\/\/[^\s)]+|[^\s]+\.mp4)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*[-=]+>\s*(\d{1,2}:\d{2}(?::\d{2})?)/i;
    const match = clean.match(regex);
    if (!match) return null;
    return { url: match[1], start: match[2], end: match[3] };
}

function timeToSec(t) {
    const p = t.split(':').map(Number);
    if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
    if (p.length === 2) return p[0]*60 + p[1];
    return 0;
}

// ==================== COMMANDS ====================
bot.start((ctx) => {
    if (ctx.from.id !== myChatId) return;
    ctx.reply(
        '👋 Halo Bos Ahmad!\n\n' +
        '🎬 *CineClipper Turbo (YouTube)* siap kerja.\n\n' +
        'Kirim perintah:\n' +
        '/potong https://youtu.be/contoh 00:00:10 -> 00:00:20',
        { parse_mode: 'Markdown' }
    );
});

// ==================== MAIN: /potong ====================
bot.command('potong', async (ctx) => {
    if (ctx.from.id !== myChatId) return;

    const parsed = parsePotong(ctx.message.text);
    if (!parsed) return ctx.reply('❌ Format salah.\nContoh: /potong https://youtu.be/contoh 00:10 -> 00:20');

    const { url: inputName, start, end } = parsed;
    
    if (timeToSec(end) <= timeToSec(start)) {
        return ctx.reply('❌ Waktu END harus lebih besar dari START.');
    }

    const ts = Date.now();
    const tempOut = path.join(OUTPUT_DIR, `temp_${ts}.mp4`);
    const finalOut = path.join(OUTPUT_DIR, `Klip_${ts}.mp4`);

    await ctx.reply(`⏳ Bos Ahmad santai saja, PC lagi nyedot & merender YouTube adegan ${start} - ${end}...`);

    try {
        console.log(`[${ts}] Sedot cerdik YouTube: ${inputName}`);
        
        // Smart Slicing YouTube (Langsung potong di udara, super cepat)
        const dlCmd = `${YTDLP_PATH} --downloader ffmpeg --downloader-args "ffmpeg:-ss ${start} -to ${end}" --no-playlist --no-warnings "${inputName}" -o "${tempOut}"`;
        execSync(dlCmd, { stdio: 'pipe', encoding: 'utf-8', timeout: 300000 });

        console.log(`[${ts}] Merombak visual ke 9:16...`);
        // Crop vertikal 9:16
        const cropCmd = `${FFMPEG_PATH} -i "${tempOut}" -vf "crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -crf 23 -preset fast -c:a copy -movflags +faststart "${finalOut}" -y`;
        execSync(cropCmd, { stdio: 'pipe', encoding: 'utf-8', timeout: 300000 });

        const sizeMB = (fs.statSync(finalOut).size / 1024 / 1024).toFixed(2);

        console.log(`[${ts}] Mengirim ke Telegram...`);
        await ctx.replyWithVideo({ source: fs.createReadStream(finalOut) }, {
            caption: `🎉 *Ini hasil videonya Bos!*\n⏱️ ${start} → ${end}\n📦 ${sizeMB} MB\n📐 9:16 Vertikal`,
            parse_mode: 'Markdown'
        });

    } catch (err) {
        console.error(`[${ts}] ERROR:`, err);
        await ctx.reply(`❌ Gagal: Pastikan link YouTube benar dan dapat diakses.`);
    } finally {
        if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        if (fs.existsSync(finalOut)) fs.unlinkSync(finalOut);
    }
});

bot.catch((err, ctx) => {
    console.error('Bot error:', err);
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));