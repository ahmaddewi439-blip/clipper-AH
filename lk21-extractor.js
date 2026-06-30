// lk21-extractor.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function extractVideoUrl(lk21Url) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    });
    
    let videoUrl = null;
    let debugInfo = [];
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
        
        // Intercept network untuk tangkap .m3u8, .mp4, .ts
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const url = req.url();
            if ((url.includes('.m3u8') || url.includes('.mp4') || url.includes('.ts') || url.includes('stream')) && !videoUrl) {
                videoUrl = url;
                debugInfo.push('Network intercept: ' + url.substring(0, 60));
            }
            req.continue();
        });
        
        // Buka halaman LK21
        await page.goto(lk21Url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        debugInfo.push('Page loaded');
        
        // Tunggu 8 detik biar JS load
        await page.waitForTimeout(8000);
        
        // Screenshot untuk debug (simpan ke folder)
        try {
            await page.screenshot({ path: 'debug-lk21-page.png' });
            debugInfo.push('Screenshot saved');
        } catch(e) {}
        
        // Scroll ke bawah untuk trigger lazy load
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(3000);
        
        // Cari iframe
        let iframeSrc = await page.evaluate(() => {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                if (iframe.src && (iframe.src.includes('dood') || iframe.src.includes('stream') || iframe.src.includes('embed'))) {
                    return iframe.src;
                }
            }
            return null;
        });
        
        if (iframeSrc) {
            debugInfo.push('Found iframe: ' + iframeSrc.substring(0, 60));
            
            // Buka iframe
            await page.goto(iframeSrc, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(5000);
            
            // Coba klik tombol play kalau ada
            try {
                const playBtn = await page.$('button, .play, [class*="play"], [id*="play"]');
                if (playBtn) {
                    await playBtn.click();
                    await page.waitForTimeout(3000);
                    debugInfo.push('Clicked play button');
                }
            } catch(e) {}
            
            // Tunggu network intercept
            await page.waitForTimeout(5000);
        }
        
        // Cek dari DOM
        if (!videoUrl) {
            videoUrl = await page.evaluate(() => {
                // Cek video tag
                const video = document.querySelector('video');
                if (video && video.src) return video.src;
                
                const source = document.querySelector('video source');
                if (source && source.src) return source.src;
                
                // Cek semua script
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const script of scripts) {
                    const text = script.textContent || '';
                    // Cari pattern URL video
                    const patterns = [
                        /(https?:\/\/[^"']+\.m3u8[^"']*)/,
                        /(https?:\/\/[^"']+\.mp4[^"']*)/,
                        /(https?:\/\/[^"']+\.ts[^"']*)/,
                        /src["']?\s*[:=]\s*["'](https?:\/\/[^"']+)["']/
                    ];
                    for (const p of patterns) {
                        const match = text.match(p);
                        if (match) return match[1];
                    }
                }
                
                // Cek data attribute
                const all = document.querySelectorAll('[data-src], [data-url], [data-video]');
                for (const el of all) {
                    if (el.dataset.src) return el.dataset.src;
                    if (el.dataset.url) return el.dataset.url;
                    if (el.dataset.video) return el.dataset.video;
                }
                
                return null;
            });
            
            if (videoUrl) debugInfo.push('Found from DOM: ' + videoUrl.substring(0, 60));
        }
        
        return { url: videoUrl, debug: debugInfo };
        
    } catch (err) {
        return { url: null, debug: [...debugInfo, 'Error: ' + err.message] };
    } finally {
        await browser.close();
    }
}

module.exports = { extractVideoUrl };