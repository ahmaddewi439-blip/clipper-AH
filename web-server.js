const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const WEB_DIR = path.join(__dirname, 'web');
const PORT = 3000;

if (!fs.existsSync(WEB_DIR)) fs.mkdirSync(WEB_DIR);

// Serve video files
app.use('/clips', express.static(WEB_DIR));

// Halaman utama: List semua clip
app.get('/', (req, res) => {
    const files = fs.readdirSync(WEB_DIR)
        .filter(f => f.endsWith('.mp4'))
        .sort((a, b) => b.localeCompare(a)); // Terbaru di atas
    
    let html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>CineClipper Output</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #0f0f0f; color: #fff; 
                padding: 20px; max-width: 600px; margin: 0 auto;
            }
            h1 { font-size: 1.5rem; margin-bottom: 20px; text-align: center; }
            .clip { 
                background: #1a1a1a; border-radius: 16px; 
                margin-bottom: 20px; overflow: hidden;
                border: 1px solid #333;
            }
            .clip video { 
                width: 100%; height: auto; display: block;
                background: #000;
            }
            .clip-info { padding: 15px; }
            .clip-name { font-size: 0.9rem; color: #aaa; word-break: break-all; }
            .empty { text-align: center; color: #666; padding: 60px 20px; }
            .refresh { 
                position: fixed; bottom: 20px; right: 20px;
                background: #e50914; color: white; border: none;
                width: 56px; height: 56px; border-radius: 50%;
                font-size: 24px; cursor: pointer; box-shadow: 0 4px 12px rgba(229,9,20,0.4);
            }
        </style>
    </head>
    <body>
        <h1>🎬 CineClipper</h1>
        ${files.length === 0 ? '<div class="empty">Belum ada clip. Kirim /potong dari Telegram.</div>' : ''}
    `;
    
    files.forEach(file => {
        html += `
        <div class="clip">
            <video controls playsinline preload="metadata" poster="">
                <source src="/clips/${file}" type="video/mp4">
                Browser tidak support video.
            </video>
            <div class="clip-info">
                <div class="clip-name">${file}</div>
            </div>
        </div>
        `;
    });
    
    html += `
        <button class="refresh" onclick="location.reload()">↻</button>
    </body>
    </html>`;
    
    res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server: http://localhost:${PORT}`);
    console.log(`📱 Akses dari HP: http://${require('os').networkInterfaces()['Wi-Fi']?.find(n=>n.family==='IPv4' && !n.internal)?.address || 'IP_PC_ANDA'}:${PORT}`);
});

// Auto-refresh list setiap 10 detik via SSE (optional)