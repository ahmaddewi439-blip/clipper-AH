const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(cors({
  origin: ['https://clipper-ah-production.up.railway.app', 'https://cineclipper.up.railway.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use('/output', express.static('output'));

app.use(express.static(path.join(__dirname, 'public')));
// ============================================
// BACKGROUND VIDEO CUTTER - HYBRID APPROACH
// ============================================


const crypto = require('crypto');

// Store active cutting jobs
const cuttingJobs = new Map();

// Helper: Generate unique job ID
function generateJobId() {
    return crypto.randomBytes(8).toString('hex');
}

// Helper: Parse time string "MM:SS" or "HH:MM:SS" to seconds
function parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
}

// Helper: Format seconds to MM:SS
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// API: Start background cutting
app.post('/api/start-cut', async (req, res) => {
    const { url, clips, jobId } = req.body;
    
    if (!url || !clips || !jobId) {
        return res.status(400).json({ success: false, error: 'Parameter kurang' });
    }
    
    // Response langsung, proses di background
    res.json({ success: true, message: 'Cutting started', jobId });
    
    // Background process
    startBackgroundCut(jobId, url, clips);
});


function getStreamUrl(url) {
    try {
        const cmd = `"${YTDLP_PATH}" --no-check-certificate --extractor-args "youtube:player_client=android,web" -f "best[ext=mp4]/best" --get-url "${url}"`;
        return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
    } catch (e) {
        const cmd2 = `"${YTDLP_PATH}" --no-check-certificate --cookies-from-browser chrome -f "best[ext=mp4]/best" --get-url "${url}"`;
        return execSync(cmd2, { encoding: 'utf-8', timeout: 30000 }).trim();
    }
}

// Background cutting function
async function startBackgroundCut(jobId, url, clips) {
    cuttingJobs.set(jobId, {
        status: 'downloading',
        progress: 0,
        total: clips.length,
        completed: 0,
        clips: []
    });
    
    const tempFile = path.join(OUTPUT_DIR, `temp_${jobId}.mp4`);
    
    try {
        console.log(`[CUT ${jobId}] Memulai sedot SUPER CEPAT (langsung per klip)...`);
        cuttingJobs.get(jobId).status = 'cutting';

        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            
            // Mengambil angka detik
            const startSec = clip.startSec !== undefined ? clip.startSec : parseTimeToSeconds(clip.start);
            const endSec = clip.endSec !== undefined ? clip.endSec : parseTimeToSeconds(clip.end);
            const duration = endSec - startSec;

            const outputFile = `clip_${jobId}_${i + 1}.mp4`;
            const outputPath = path.join(OUTPUT_DIR, outputFile);

            console.log(`[CUT ${jobId}] ⚡ Menyedot Klip ${i + 1}: dari detik ${startSec} sampai ${endSec}...`);

            // MAGIC COMMAND: Langsung download dan potong di detik tertentu!
            const cutCmd = `"${YTDLP_PATH}" --no-check-certificate --extractor-args "youtube:player_client=android,web" --ffmpeg-location "${FFMPEG_PATH}" --download-sections "*${startSec}-${endSec}" -f "best[ext=mp4]/best" -o "${outputPath}" "${url}"`;

            // Eksekusi
            execSync(cutCmd, { timeout: 300000, windowsHide: true });

            // Update persentase progress ke web Frontend
            const job = cuttingJobs.get(jobId);
            job.completed = i + 1;
            job.progress = Math.round(((i + 1) / clips.length) * 100);
            job.clips.push({
                index: i + 1,
                filename: outputFile,
                url: `/output/${outputFile}`,
                start: clip.start,
                end: clip.end,
                duration: formatTime(duration)
            });

            console.log(`[CUT ${jobId}] ✅ Klip ${i + 1}/${clips.length} selesai!`);
        }

        // Jika semua loop selesai
        cuttingJobs.get(jobId).status = 'completed';
        console.log(`[CUT ${jobId}] 🎉 SEMUA KLIP SUDAH SELESAI DIPOTONG!`);

        // Cleanup temp file
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }

    } catch (error) {
        console.error(`[CUT ${jobId}] Error:`, error);
        cuttingJobs.get(jobId).status = 'error';
        cuttingJobs.get(jobId).error = error.message;
        
        // Cleanup on error
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}

// API: Check cutting progress
app.get('/api/cut-status/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = cuttingJobs.get(jobId);
    
    if (!job) {
        return res.status(404).json({ success: false, error: 'Job tidak ditemukan' });
    }
    
    res.json({
        success: true,
        data: {
            status: job.status,
            progress: job.progress,
            completed: job.completed,
            total: job.total,
            clips: job.clips
        }
    });
});

// API: Download clip directly
app.get('/api/download-clip/:jobId/:clipIndex', (req, res) => {
    const { jobId, clipIndex } = req.params;
    const job = cuttingJobs.get(jobId);
    
    if (!job || !job.clips[clipIndex - 1]) {
        return res.status(404).json({ success: false, error: 'Clip tidak ditemukan' });
    }
    
    const clip = job.clips[clipIndex - 1];
    const filePath = path.join(OUTPUT_DIR, clip.filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'File belum siap' });
    }
    
    res.download(filePath, clip.filename);
});

// Helper: Extract YouTube ID (kalau belum ada)
function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// ============================================
// YOUTUBE DATA API v3 - PREVIEW CARD
// ============================================
const YOUTUBE_API_KEY = 'AIzaSyCxYDW4RDDBFEKM9XFsM-l1dCvN6g_2JYg';

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function formatDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '0:00';
  const h = parseInt(m[1]||0), min = parseInt(m[2]||0), s = parseInt(m[3]||0);
  if (h > 0) return `${h}:${min.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return `${min}:${s.toString().padStart(2,'0')}`;
}

function formatViews(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000) return (n/1000).toFixed(1)+'K';
  return n.toString();
}

// Tambahkan route ini bersama route lainnya
app.get('/api/youtube-info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL kosong' });
  
  const videoId = extractYouTubeId(url);
  if (!videoId) return res.status(400).json({ success: false, error: 'URL tidak valid' });
  
  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ success: false, error: 'Video tidak ditemukan/private' });
    }
    
    const v = data.items[0], s = v.snippet, d = v.contentDetails, st = v.statistics;
    res.json({
      success: true,
      data: {
        id: videoId,
        title: s.title,
        thumbnail: s.thumbnails.high?.url || s.thumbnails.medium?.url,
        channelName: s.channelTitle,
        duration: formatDuration(d.duration),
        views: formatViews(parseInt(st.viewCount||0)),
        publishedAt: new Date(s.publishedAt).toLocaleDateString('id-ID')
      }
    });
  } catch (err) {
    console.error('[YOUTUBE API]', err);
    res.status(500).json({ success: false, error: 'Gagal ambil data YouTube' });
  }
});
const FFMPEG_PATH = 'ffmpeg';  // Railway sudah install ffmpeg via apt
const YTDLP_PATH = 'yt-dlp';   // Nanti kita install yt-dlp via pip

// Konfigurasi Koboi LLM - PASTIKAN API KEY SUDAH BENAR
const KOBOI_API_KEY = 'sk-S1w-OnAhdjtzMyYVMlYvGw';  // GANTI JIKA PERLU
const KOBOI_BASE_URL = 'https://lite.koboillm.com/v1';

const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// ==================== KONFIGURASI BAHASA ====================
// charPerSec DINAikKAN untuk narasi yang lebih panjang & natural
// ==================== KONFIGURASI BAHASA ====================
// charPerSec Disesuaikan untuk kecepatan baca standar Voice Over (ElevenLabs)
const LANGUAGES = {
  en: { name: 'English', tier: 1, charPerSec: 14.0 },
  ja: { name: '日本語', tier: 1, charPerSec: 12.0 },
  de: { name: 'Deutsch', tier: 1, charPerSec: 14.0 },
  fr: { name: 'Français', tier: 1, charPerSec: 14.0 },
  es: { name: 'Español', tier: 2, charPerSec: 14.0 },
  pt: { name: 'Português', tier: 2, charPerSec: 14.0 },
  ru: { name: 'Русский', tier: 2, charPerSec: 13.0 },
  ar: { name: 'العربية', tier: 2, charPerSec: 12.0 },
  id: { name: 'Bahasa Indonesia', tier: 'local', charPerSec: 14.0 },
  ko: { name: '한국어', tier: 1, charPerSec: 12.0 }
};

const CTA_TEMPLATES = {
  en: { mid: " If you want to know what happens next, please subscribe and hit the bell notification.", end: " That was the recap. Don't forget to like, subscribe, and share this video. See you in the next one!" },
  ja: { mid: " 続きが気になる方は、チャンネル登録と通知のベルをお願いします。", end: " 以上が要約でした。高評価、チャンネル登録、共有をお忘れなく。次の動画でお会いしましょう！" },
  de: { mid: " Wenn Sie wissen möchten, was als Nächstes passiert, abonnieren Sie bitte und aktivieren Sie die Glocke.", end: " Das war die Zusammenfassung. Vergessen Sie nicht zu liken, abonnieren und teilen. Bis zum nächsten Mal!" },
  fr: { mid: " Si vous voulez savoir la suite, abonnez-vous et activez la cloche.", end: " C'était le résumé. N'oubliez pas d'aimer, vous abonner et partager. À la prochaine!" },
  es: { mid: " Si quieres saber qué pasa después, suscríbete y activa la campana.", end: " Ese fue el resumen. No olvides dar like, suscribirte y compartir. ¡Nos vemos en el próximo!" },
  pt: { mid: " Se quiser saber o que acontece depois, inscreva-se e ative o sininho.", end: " Esse foi o resumo. Não esqueça de curtir, se inscrever e compartilhar. Até o próximo!" },
  ru: { mid: " Если хотите узнать, что будет дальше, подпишитесь и нажмите на колокольчик.", end: " Это была сводка. Не забудьте поставить лайк, подписаться и поделиться. До следующей встречи!" },
  ar: { mid: " إذا كنت تريد معرفة ما سيحدث بعد ذلك، يرجى الاشتراك وتفعيل الجرس.", end: " كان هذا الملخص. لا تنسَ الإعجاب والاشتراك والمشاركة. إلى اللقاء في الفيديو القادم!" },
  id: { mid: " Jika ingin tahu kelanjutannya, bantu subscribe dan nyalakan loncengnya ya. Jangan sampai ketinggalan!", end: " Itu tadi rangkumannya. Jangan lupa like, subscribe, dan share video ini. Sampai jumpa di video berikutnya!" },
  ko: { mid: " 다음 내용이 궁금하시면 구독과 알림 설정 부탁드립니다.", end: " 지금까지 요약이었습니다. 좋아요, 구독, 공유 잊지 마세요. 다음 영상에서 만나요!" }
};

// ==================== UTILITAS ====================
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  return `${mins}:${secs.toString().padStart(2,'0')}`;
}


// ==================== PERHITUNGAN KLIP STRICT ====================
function getClipConfig(format) {
  if (format === 'short') return { clipCount: 4, clipDuration: 15 };
  if (format === 'medium') return { clipCount: 7, clipDuration: 43 };
  if (format === 'long') return { clipCount: 12, clipDuration: 50 };
  return { clipCount: 4, clipDuration: 15 }; // Default fallback
}

function generateClipTimestamps(durationSeconds, format) {
  const config = getClipConfig(format);
  const clips = [];
  
  for (let i = 0; i < config.clipCount; i++) {
    const start = i * config.clipDuration;
    // KUNCI MATI: End selalu start + durasi fix, JANGAN pakai Math.min dengan durasi total video
    const end = start + config.clipDuration; 
    
    clips.push({
      index: i + 1,
      start: formatTime(start),
      end: formatTime(end),
      startSec: start,
      endSec: end,
      durationSec: config.clipDuration
    });
  }
  return clips;
}

function detectGenre(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('action') || text.includes('war') || text.includes('fight')) return 'action';
  if (text.includes('horror') || text.includes('ghost') || text.includes('scary') || text.includes('santet') || text.includes('setan')) return 'horror';
  if (text.includes('comedy') || text.includes('funny')) return 'comedy';
  if (text.includes('romance') || text.includes('love')) return 'romance';
  if (text.includes('thriller') || text.includes('mystery') || text.includes('crime')) return 'thriller';
  return 'drama';
}

// ==================== GENERATE NARASI PANJANG ====================
function getMaxChars(durationSec, lang) {
  const langData = LANGUAGES[lang] || LANGUAGES['id'];
  // Dikali 0.85 untuk memberi ruang breathing/pause
  return Math.floor(durationSec * langData.charPerSec * 0.85);
}

function generateSingleNarration(clips, lang, title, genre) {
  const cta = CTA_TEMPLATES[lang] || CTA_TEMPLATES['id'];
  const narration = [];

  // Template narasi PANJANG per genre
  const storyTemplates = {
    horror: {
      id: [
        "Film ini dimulai dengan suasana yang sangat mencekam. Kita diperkenalkan dengan karakter utama yang tampak biasa saja, namun sesuatu yang gelap dan misterius mulai mengintai di sekitar mereka. Ketegangan perlahan-lahan dibangun dengan pencahayaan yang redup dan musik latar yang menggerogoti ketenangan. Penonton langsung merasa ada sesuatu yang tidak beres, namun tidak bisa menebak apa yang sebenarnya terjadi.",
        "Ketegangan meningkat drastis ketika rahasia kelam dari masa lalu mulai terkuak satu per satu. Karakter utama menemukan petunjuk-petunjuk aneh yang membawanya ke lokasi terlarang. Setiap langkah yang diambil semakin mendekatkan mereka pada bahaya yang sebenarnya. Suasana semakin tidak nyaman dan penonton mulai merasakan ketakutan yang mendalam.",
        "Ini adalah adegan paling menegangkan sepanjang film. Sesuatu yang tidak terlihat akhirnya mulai menunjukkan wujudnya. Ketakutan yang selama ini dibangun meledak dalam satu momen yang sangat intens. Karakter utama harus menghadapi kenyataan pahit bahwa mereka tidak bisa lari dari masa lalu yang menghantui mereka.",
        "Konflik mencapai puncaknya dengan cara yang sangat mengharukan. Karakter utama dihadapkan pada pilihan sulit antara menyelamatkan diri sendiri atau orang yang mereka cintai. Ending yang disajikan sangat memuaskan sekaligus menyisakan pertanyaan di benak penonton. Sebuah kisah horor yang tidak hanya menakutkan, tapi juga menyentuh hati."
      ],
      en: [
        "The film opens with an incredibly chilling atmosphere. We are introduced to the main character who seems ordinary, yet something dark and mysterious begins to stalk around them. Tension is slowly built through dim lighting and background music that gnaws at tranquility. Viewers immediately feel that something is wrong, but cannot guess what is actually happening.",
        "The tension rises dramatically as dark secrets from the past begin to unravel one by one. The main character discovers strange clues that lead them to a forbidden location. Every step taken brings them closer to the real danger. The atmosphere becomes increasingly uncomfortable and viewers begin to feel deep fear.",
        "This is the most tense scene in the entire film. Something unseen finally begins to show its form. The fear that has been built up explodes in one very intense moment. The main character must face the bitter reality that they cannot run away from the past that haunts them.",
        "The conflict reaches its peak in a very heartbreaking way. The main character is faced with a difficult choice between saving themselves or the person they love. The ending presented is very satisfying while leaving questions in the viewer's mind. A horror story that is not only scary, but also touching."
      ],
      default: [
        "The story begins with an intriguing setup that immediately draws viewers into the narrative world.",
        "The plot thickens as unexpected twists begin to unfold, keeping everyone on the edge of their seats.",
        "This scene delivers the most impactful moment of the story so far, with brilliant cinematography.",
        "The climax arrives as all storylines converge toward a dramatic and satisfying resolution."
      ]
    },
    action: {
      id: [
        "Aksi dimulai dengan pertarungan yang sangat sengit dan koordinasi tim yang apik. Protagonis menunjukkan keahlian tempur yang luar biasa, mengalahkan musuh satu per satu dengan strategi cerdas. Tiap gerakan terlihat sangat realistis dan penuh dengan ketegangan. Penonton langsung terhanyut dalam alur aksi yang cepat dan penuh adrenalin ini.",
        "Konflik semakin memanas saat musuh utama akhirnya memperlihatkan wajah aslinya. Rencana jahat yang telah lama disusun mulai terungkap, membahayakan tidak hanya sang protagonis tetapi juga orang-orang di sekitarnya. Persahabatan diuji dan loyalitas mulai goyah. Adegan ini penuh dengan dialog tajam dan ketegangan psikologis.",
        "Ini adalah momen paling epik sepanjang film. Aksi mendebarkan memenuhi layar dengan efek visual yang memukau dan koreografi pertarungan yang sempurna. Tiap detik dipenuhi ketegangan yang memacu adrenalin. Protagonis harus menggunakan semua keahliannya untuk bertahan hidup dan melindungi yang mereka cintai.",
        "Pertarungan final dimulai dengan skala yang sangat besar. Semua kekuatan dan teknik terbaik dikeluarkan dalam duel yang menentukan nasib. Kemenangan tidak datang dengan mudah dan harus dibayar mahal. Ending yang heroik sekaligus mengharukan, membuat penonton terpukau dan merasa puas."
      ],
      en: [
        "The action kicks off with a very fierce battle and excellent team coordination. The protagonist shows extraordinary combat skills, defeating enemies one by one with smart strategy. Every movement looks very realistic and full of tension. Viewers are immediately swept away in this fast-paced and adrenaline-filled action flow.",
        "The conflict heats up as the main villain finally shows their true face. An evil plan that has been long in the making begins to unfold, endangering not only the protagonist but also the people around them. Friendship is tested and loyalty begins to waver. This scene is full of sharp dialogue and psychological tension.",
        "This is the most epic moment in the entire film. Thrilling action fills the screen with stunning visual effects and perfect fight choreography. Every second is filled with adrenaline-pumping tension. The protagonist must use all their skills to survive and protect those they love.",
        "The final battle begins on a very large scale. All the best powers and techniques are unleashed in a determining duel. Victory does not come easily and must be paid for dearly. A heroic yet heartbreaking ending that leaves viewers amazed and satisfied."
      ],
      default: [
        "The story kicks off with an exciting opening that sets the stage for an epic adventure.",
        "The conflict escalates as the antagonist makes their move, raising the stakes significantly.",
        "This scene delivers the most thrilling sequence of the film with spectacular visuals.",
        "The story reaches its climax with an epic showdown that determines everything."
      ]
    },
    drama: {
      id: [
        "Kisah dimulai dengan perkenalan karakter yang sangat mendalam dan penuh emosi. Kita melihat lika-liku kehidupan mereka, impian yang dikejar, dan luka yang disembunyikan. Penonton langsung terhubung secara emosional dan merasa ikut hidup dalam dunia mereka. Setiap dialog terasa sangat natural dan menyentuh hati.",
        "Konflik internal mulai muncul ke permukaan. Karakter utama dihadapkan pada pilihan yang sangat sulit antara mengikuti hati atau logika. Hubungan dengan orang terdekat mulai retak dan kepercayaan diuji. Adegan ini sangat powerful dan membuat penonton merenungkan makna kehidupan.",
        "Ini adalah momen paling mengharukan sepanjang film. Hubungan antar karakter diuji dengan situasi yang sangat menantang dan menyakitkan. Rahasia tersembunyi akhirnya terungkap, mengubah segalanya. Penonton tidak bisa menahan air mata melihat perjuangan dan pengorbanan yang dilakukan.",
        "Semua konflik berujung pada resolusi yang sangat bermakna. Karakter utama akhirnya menemukan kedamaian dan memaafkan masa lalu. Pelajaran berharga tentang cinta, pengorbanan, dan arti keluarga tersimpan indah di ending ini. Sebuah masterpiece drama yang akan lama diingat."
      ],
      en: [
        "The story begins with a very deep and emotional character introduction. We see the ups and downs of their lives, dreams pursued, and wounds hidden. Viewers immediately connect emotionally and feel like they are living in their world. Every dialogue feels very natural and touching.",
        "Internal conflict begins to surface. The main character is faced with a very difficult choice between following the heart or logic. Relationships with closest people begin to crack and trust is tested. This scene is very powerful and makes viewers contemplate the meaning of life.",
        "This is the most heartbreaking moment in the entire film. Relationships between characters are tested with very challenging and painful situations. Hidden secrets are finally revealed, changing everything. Viewers cannot hold back tears seeing the struggles and sacrifices made.",
        "All conflicts lead to a very meaningful resolution. The main character finally finds peace and forgives the past. Valuable lessons about love, sacrifice, and the meaning of family are beautifully stored in this ending. A drama masterpiece that will be remembered for a long time."
      ],
      default: [
        "The narrative opens with a compelling introduction to the characters and their world.",
        "The story develops as conflicts begin to emerge, testing relationships and beliefs.",
        "This scene captures the emotional core of the film with powerful performances.",
        "The story concludes with a meaningful resolution that stays with you long after."
      ]
    },
    default: {
      id: [
        "Cerita dimulai dengan pembuka yang sangat menarik dan memikat. Karakter utama diperkenalkan dengan latar belakang yang kuat dan personalitas yang berbeda. Dunia yang dibangun terasa sangat hidup dan detail. Penonton langsung dibawa masuk ke dalam alur cerita yang penuh dengan kejutan.",
        "Alur semakin seru saat konflik mulai terlihat jelas. Tiap adegan membangun ketegangan dengan sangat apik dan tidak terduga. Rahasia demi rahasia mulai terkuak, mengubah pemahaman kita tentang karakter. Hubungan antar tokoh menjadi semakin kompleks dan menarik untuk diikuti.",
        "Ini adalah momen paling berkesan sepanjang film. Semua elemen cerita menyatu dalam adegan yang sangat epik dan emosional. Visual yang memukau, akting yang luar biasa, dan musik yang pas menciptakan pengalaman sinematik yang sempurna. Penonton terpaku pada layar dari awal sampai akhir.",
        "Ending yang sangat memuaskan dan tak terlupakan. Semua pertanyaan terjawab dengan cara yang cerdas dan tak terduga. Pesan moral yang disampaikan sangat kuat dan relevan. Film ini benar-benar sebuah karya yang wajib ditonton dan akan lama diingat."
      ],
      en: [
        "The story begins with a very interesting and captivating opening. The main character is introduced with a strong background and distinct personality. The world built feels very alive and detailed. Viewers are immediately drawn into a storyline full of surprises.",
        "The plot gets more exciting as conflicts begin to become clear. Each scene builds tension very skillfully and unexpectedly. Secret after secret begins to unfold, changing our understanding of the characters. Relationships between characters become increasingly complex and interesting to follow.",
        "This is the most memorable moment in the entire film. All story elements come together in a very epic and emotional scene. Stunning visuals, extraordinary acting, and fitting music create a perfect cinematic experience. Viewers are glued to the screen from start to finish.",
        "A very satisfying and unforgettable ending. All questions are answered in a clever and unexpected way. The moral message conveyed is very strong and relevant. This film is truly a work that must be watched and will be remembered for a long time."
      ],
      default: [
        "The story opens with an engaging introduction that immediately captures attention.",
        "The plot develops with rising tension and unexpected revelations.",
        "This scene stands out as the highlight with perfect cinematic execution.",
        "The story reaches a satisfying conclusion with a powerful message."
      ]
    }
  };

  const g = storyTemplates[genre] || storyTemplates.default;
  const l = g[lang] || g['en'] || g['default'];

  clips.forEach((clip, idx) => {
    const isClip3 = idx === 2;
    const isLast = idx === clips.length - 1;
    const maxChars = getMaxChars(clip.durationSec, lang);

    let baseText = l[idx % l.length];

    if (isClip3) {
      baseText += cta.mid;
    } else if (isLast) {
      baseText += cta.end;
    }

    const finalText = truncateToLength(baseText, maxChars);

    narration.push({
      clipIndex: clip.index,
      start: clip.start,
      end: clip.end,
      durationSec: clip.durationSec,
      text: finalText,
      hasCTA: isClip3 || isLast,
      estimatedVO: `${clip.durationSec} detik`,
      charCount: finalText.length,
      gptPrompt: `Buat narasi review film "${title}" genre ${genre} untuk klip ${clip.index} (${clip.durationSec} detik) dalam bahasa ${LANGUAGES[lang]?.name || 'Indonesia'}. ${isClip3 ? 'Sisipkan ajakan subscribe di akhir.' : isLast ? 'Sisipkan CTA akhir like, subscribe, share.' : 'Fokus pada alur cerita.'}`
    });
  });

  return narration;
}

function truncateToLength(text, maxLength) {
  if (text.length <= maxLength) return text;
  // Cari spasi terakhir sebelum batas untuk potong rapi
  const truncated = text.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
}

function generateThumbnailPrompt(title, genre, lang) {
  const prompts = {
    en: `Cinematic ${genre} movie poster style, ${title}, dramatic lighting, main character in dynamic action pose, intense facial expression, bold cinematic typography area at bottom, teal and orange color grading, 8k, highly detailed, professional photography, trending on ArtStation --ar 16:9`,
    id: `Gaya poster film ${genre} sinematik, ${title}, pencahayaan dramatis, karakter utama dalam pose aksi dinamis, ekspresi wajah intens, area tipografi sinematik tebal di bawah, color grading teal dan orange, 8k, sangat detail, fotografi profesional, trending di ArtStation --ar 16:9`,
    default: `Cinematic ${genre} poster, ${title}, dramatic lighting, dynamic pose, bold text bottom, 8k --ar 16:9`
  };
  return {
    prompt: prompts[lang] || prompts['en'],
    negativePrompt: "blurry, low quality, watermark, text overlay, distorted face, bad anatomy, cartoon, anime",
    tools: ["Midjourney", "DALL-E 3", "Leonardo.ai", "Ideogram", "Adobe Firefly"],
    aspectRatio: "16:9",
    title,
    genre
  };
  // TAMBAHKAN INI SEBELUM } PENUTUP generateThumbnailPrompt

function parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
    return parts[0]*60 + parts[1];
}
}


// ==================== ENDPOINT 1: ANALYZE (FULL AI AUTO-PILOT) ====================
app.post('/api/analyze', async (req, res) => {
  const { url, lang = 'id', format = 'short' } = req.body;

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return res.status(400).json({ success: false, error: "URL YouTube tidak valid" });
  }

  try {
    console.log(`[ANALYZE] Menyedot data video...`);

    // 1. Ambil Info Dasar Video
    const infoCmd = `"${YTDLP_PATH}" --print "%(title)s" --print "%(duration)s" --print "%(description)s" "${url}"`;
    const infoOutput = execSync(infoCmd, { encoding: 'utf8', stdio: 'pipe', timeout: 300000 });
    const lines = infoOutput.trim().split('\n');

    const title = lines[0] || 'Unknown Title';
    const duration = parseFloat(lines[1]) || 0;
    const description = lines.slice(2).join(' ') || '';

    if (duration === 0) throw new Error("Gagal mendapatkan durasi video");
    
    const durationMin = duration / 60;
    const clipConfig = getClipConfig(format);
    const genre = detectGenre(title, description);

    console.log(`[ANALYZE] Membangunkan GPT-4o untuk mencari adegan epik...`);

    // 2. PERINTAHKAN GPT-4o MENCARI TIMESTAMP ADEGAN TERHEBOH
    const aiPrompt = `Kamu adalah Asisten Sutradara Profesional. 
Tugasmu membedah struktur film berdasarkan info berikut:
Judul: "${title}"
Genre: ${genre}
Durasi Total: ${duration} detik.

Aku butuh mengambil ${clipConfig.clipCount} klip penting yang mewakili: Pengenalan, Konflik Utama, Tragedi/Aksi Terheboh, dan Klimaks/Ending.
Berikan HANYA format array JSON berisi angka detik dimulainya adegan-adegan tersebut. 
Contoh output wajib: [120, 1500, 3200, 4800]
PENTING: Jangan berikan teks apapun selain array JSON. Angka tidak boleh melebihi durasi total (${duration}).`;

    let startTimes = [];
    try {
        const aiResponse = await axios.post(`${KOBOI_BASE_URL}/chat/completions`, {
            model: 'openai/gpt-4o',
            messages: [{ role: 'user', content: aiPrompt }],
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${KOBOI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const aiText = aiResponse.data.choices[0].message.content;
        
        // Membersihkan jika AI membalas dengan format markdown markdown ```json [1,2,3] ```
        const jsonMatch = aiText.match(/\[.*?\]/s);
        if (jsonMatch) {
            startTimes = JSON.parse(jsonMatch[0]);
        }
    } catch (aiError) {
        console.log(`[AI ERROR] GPT-4o gagal merespon, menggunakan metode fallback.`);
    }

    // 3. JIKA AI GAGAL/ERROR, KITA PAKAI RUMUS PEMBAGIAN CERDAS (Fallback)
    if (!startTimes || startTimes.length !== clipConfig.clipCount) {
        startTimes = [];
        // Membagi film secara proporsional (bukan menumpuk di awal)
        const interval = Math.floor(duration / (clipConfig.clipCount + 1));
        for (let i = 0; i < clipConfig.clipCount; i++) {
            startTimes.push((i + 1) * interval); 
        }
    }

    // 4. SUSUN KLIP BERDASARKAN HASIL PEMIKIRAN AI
    const clips = startTimes.map((startSec, idx) => ({
        index: idx + 1,
        start: formatTime(startSec),
        end: formatTime(startSec + clipConfig.clipDuration),
        startSec: startSec,
        endSec: startSec + clipConfig.clipDuration,
        durationSec: clipConfig.clipDuration
    }));

    const narration = generateSingleNarration(clips, lang, title, genre);
    const thumbnail = generateThumbnailPrompt(title, genre, lang);

    console.log(`[ANALYZE] SUKSES! AI berhasil memilih ${clips.length} adegan emas.`);

    res.json({
      success: true,
      title,
      duration,
      durationFormatted: formatTime(duration),
      durationMinutes: Math.round(durationMin * 10) / 10,
      clipCount: clips.length,
      clipDuration: clipConfig.clipDuration,
      genre,
      language: LANGUAGES[lang],
      clips,
      narration,
      thumbnail,
      url,
      format
    });

  } catch (err) {
    console.error(`[ANALYZE] ERROR:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== ENDPOINT 2: ENHANCE NARASI (AI) ====================
// ==================== ENDPOINT 2: ENHANCE NARASI (AI) ====================
app.post('/api/enhance-narration', async (req, res) => {
    const { text, title, genre, lang, durationSec } = req.body;

    if (!text) return res.status(400).json({ success: false, error: "Text required" });

    try {
        // RUMUS MATEMATIKA VOICE OVER ELEVENLABS (~2.2 kata per detik)
        const minWords = Math.floor(durationSec * 2.0);
        const maxWords = Math.floor(durationSec * 2.4);

        const systemPrompt = `Kamu adalah Voice Over Talent profesional untuk YouTube.
Teksmu akan dibacakan oleh mesin AI Voice (ElevenLabs).
Durasi klip video ini adalah TEPAT ${durationSec} detik.

ATURAN MUTLAK (JUMLAH KATA):
Kecepatan bicara normal adalah ~2.2 kata per detik. 
Maka, untuk klip ${durationSec} detik, kamu WAJIB menulis naskah dengan panjang minimal ${minWords} kata HINGGA MAKSIMAL ${maxWords} kata.

Bahasa: ${lang || 'id'}. Genre: ${genre || 'drama'}.
Buatlah narasi alur cerita yang seru untuk film "${title}". 
HITUNG KATAMU! Jangan sampai kurang dari ${minWords} kata dan JANGAN PERNAH lebih dari ${maxWords} kata.
Jika ada instruksi CTA (ajakan subscribe), gabungkan secara natural. Hanya keluarkan teks naskah tanpa basa-basi atau tanda kutip.`;

        const response = await axios.post(`${KOBOI_BASE_URL}/chat/completions`, {
            model: 'openai/gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Buat ulang naskah narasi film "${title}" berdasarkan referensi ini:\n${text}\n\nIngat, WAJIB TEPAT BERJUMLAH ${minWords} sampai ${maxWords} KATA!` }
            ],
            temperature: 0.7,
            max_tokens: 500
        }, {
            headers: {
                'Authorization': `Bearer ${KOBOI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const enhancedText = response.data.choices[0].message.content.trim();

        res.json({
            success: true,
            original: text,
            enhanced: enhancedText,
            charCount: enhancedText.length,
            wordCount: enhancedText.split(/\s+/).length // Mengembalikan info jumlah kata ke log jika diperlukan
        });

    } catch (err) {
        console.error('[ENHANCE] ERROR:', err.response?.data || err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== ENDPOINT 3: RENDER ====================
app.post('/api/render', async (req, res) => {
  const { url, clips, isShort = false } = req.body;
  const ts = Date.now();

  const finalOut = path.join(OUTPUT_DIR, `Klip_${ts}.mp4`);
  const concatListPath = path.join(OUTPUT_DIR, `concat_${ts}.txt`);

  let concatContent = "";
  const processedFiles = [];

  try {
    console.log(`[RENDER ${ts}] ${clips.length} klip | Short: ${isShort}`);

    const fullVideoPath = path.join(OUTPUT_DIR, `full_${ts}.mp4`);
    const dldCmd = `"${YTDLP_PATH}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${url}" -o "${fullVideoPath}" --merge-output-format mp4`;
    execSync(dldCmd, { stdio: 'pipe', timeout: 300000 });

    if (!fs.existsSync(fullVideoPath)) throw new Error("Gagal download video");

    for (let i = 0; i < clips.length; i++) {
      const { start, end } = clips[i];
      const processedFile = path.join(OUTPUT_DIR, `proc_${ts}_${i}.mp4`);

      let vf = isShort
        ? "crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p"
        : "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p";

      const cropCmd = `"${FFMPEG_PATH}" -y -i "${fullVideoPath}" -ss ${start} -to ${end} -vf "${vf}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${processedFile}"`;
      execSync(cropCmd, { stdio: 'pipe', timeout: 120000 });

      processedFiles.push(processedFile);
      concatContent += `file '${processedFile.replace(/\\/g, '/')}'\n`;
    }

    fs.writeFileSync(concatListPath, concatContent);
    const mergeCmd = `"${FFMPEG_PATH}" -f concat -safe 0 -i "${concatListPath}" -c copy -movflags +faststart "${finalOut}" -y`;
    execSync(mergeCmd, { stdio: 'pipe' });

    processedFiles.forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f); });
    if(fs.existsSync(fullVideoPath)) fs.unlinkSync(fullVideoPath);
    if(fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);

    console.log(`[RENDER ${ts}] SELESAI`);

    res.json({
      success: true,
      videoUrl: `/output/Klip_${ts}.mp4`,
      filename: `Klip_${ts}.mp4`,
      message: "Render selesai!"
    });

  } catch (err) {
    console.error(`[RENDER ${ts}] ERROR:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// TAMBAHKAN INI SEBELUM app.listen(PORT, () => {

app.post('/api/get-embed-url', (req, res) => {
    const { url, start, end } = req.body;
    
    let videoId = '';
    if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
    }
    
    const startSec = parseTimeToSeconds(start);
    const endSec = parseTimeToSeconds(end);
    
    const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${startSec}&end=${endSec}&autoplay=0&rel=0`;
    
    res.json({
        success: true,
        embedUrl,
        videoId,
        startSec,
        endSec
    });
});

app.post('/api/render-single', async (req, res) => {
    const { url, clip, isShort = false } = req.body;
    const ts = Date.now();
    
    const outputFile = path.join(OUTPUT_DIR, `Klip_${ts}_${clip.index}.mp4`);
    
    try {
        const fullVideoPath = path.join(OUTPUT_DIR, `full_${ts}.mp4`);
        const dldCmd = `"${YTDLP_PATH}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${url}" -o "${fullVideoPath}" --merge-output-format mp4`;
        execSync(dldCmd, { stdio: 'pipe', timeout: 300000 });
        
        let vf = isShort
            ? "crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p"
            : "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p";
        
        const cropCmd = `"${FFMPEG_PATH}" -y -i "${fullVideoPath}" -ss ${clip.start} -to ${clip.end} -vf "${vf}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${outputFile}"`;
        execSync(cropCmd, { stdio: 'pipe', timeout: 300000 });
        
        if(fs.existsSync(fullVideoPath)) fs.unlinkSync(fullVideoPath);
        
        res.json({
            success: true,
            videoUrl: `/output/Klip_${ts}_${clip.index}.mp4`,
            filename: `Klip_${ts}_${clip.index}.mp4`
        });
        
    } catch (err) {
        console.error(`[RENDER-SINGLE] ERROR:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== START ====================
app.listen(PORT, () => {
  console.log("🚀 CINECLIPPER v2.3 FIX aktif di port " + PORT);
  console.log("📁 Output: " + OUTPUT_DIR);
  console.log("\n📋 RULES KLIP:");
  console.log("   Short (isShort=true) = 4 klip x 15 detik");
  console.log("   ≤5 menit             = 7 klip");
  console.log("   >5 menit             = 12 klip");
  console.log("\n🤖 AI Enhancement via Koboi LLM aktif");
  console.log("   Model: openai/gpt-4o");
});