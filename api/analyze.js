// ============================================
// API ANALYZE - Vercel Serverless
// ============================================
const axios = require('axios');

const KOBOI_API_KEY = process.env.KOBOI_API_KEY || 'sk-S1w-OnAhdjtzMyYVMlYvGw';
const KOBOI_BASE_URL = process.env.KOBOI_BASE_URL || 'https://lite.koboillm.com/v1';

// Konfigurasi Bahasa
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
  id: { 
    mid: " Jika ingin tahu kelanjutannya, bantu subscribe dan nyalakan loncengnya ya. Jangan sampai ketinggalan!", 
    end: " Itu tadi rangkumannya. Jangan lupa like, subscribe, dan share video ini. Sampai jumpa di video berikutnya!" 
  },
  en: { 
    mid: " If you want to know what happens next, please subscribe and hit the bell notification.", 
    end: " That was the recap. Don't forget to like, subscribe, and share this video. See you in the next one!" 
  }
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function getClipConfig(format) {
  if (format === 'short') return { clipCount: 4, clipDuration: 15 };
  if (format === 'medium') return { clipCount: 7, clipDuration: 43 };
  if (format === 'long') return { clipCount: 12, clipDuration: 50 };
  return { clipCount: 4, clipDuration: 15 };
}

function generateClipTimestamps(durationSeconds, format) {
  const config = getClipConfig(format);
  const clips = [];
  const interval = Math.floor(durationSeconds / (config.clipCount + 1));
  
  for (let i = 0; i < config.clipCount; i++) {
    const start = (i + 1) * interval;
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

function getMaxChars(durationSec, lang) {
  const langData = LANGUAGES[lang] || LANGUAGES['id'];
  return Math.floor(durationSec * langData.charPerSec * 0.85);
}

function truncateToLength(text, maxLength) {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace) + '...';
  }
  return truncated + '...';
}

function generateSingleNarration(clips, lang, title, genre) {
  const cta = CTA_TEMPLATES[lang] || CTA_TEMPLATES['id'];
  const narration = [];

  const storyTemplates = {
    horror: {
      id: [
        "Film ini dimulai dengan suasana yang sangat mencekam. Kita diperkenalkan dengan karakter utama yang tampak biasa saja, namun sesuatu yang gelap dan misterius mulai mengintai di sekitar mereka.",
        "Ketegangan meningkat drastis ketika rahasia kelam dari masa lalu mulai terkuak satu per satu. Karakter utama menemukan petunjuk-petunjuk aneh yang membawanya ke lokasi terlarang.",
        "Ini adalah adegan paling menegangkan sepanjang film. Sesuatu yang tidak terlihat akhirnya mulai menunjukkan wujudnya.",
        "Konflik mencapai puncaknya dengan cara yang sangat mengharukan. Karakter utama dihadapkan pada pilihan sulit antara menyelamatkan diri sendiri atau orang yang mereka cintai."
      ]
    },
    action: {
      id: [
        "Aksi dimulai dengan pertarungan yang sangat sengit dan koordinasi tim yang apik. Protagonis menunjukkan keahlian tempur yang luar biasa.",
        "Konflik semakin memanas saat musuh utama akhirnya memperlihatkan wajah aslinya. Rencana jahat yang telah lama disusun mulai terungkap.",
        "Ini adalah momen paling epik sepanjang film. Aksi mendebarkan memenuhi layar dengan efek visual yang memukau.",
        "Pertarungan final dimulai dengan skala yang sangat besar. Semua kekuatan dan teknik terbaik dikeluarkan dalam duel yang menentukan nasib."
      ]
    },
    drama: {
      id: [
        "Kisah dimulai dengan perkenalan karakter yang sangat mendalam dan penuh emosi. Kita melihat lika-liku kehidupan mereka, impian yang dikejar, dan luka yang disembunyikan.",
        "Konflik internal mulai muncul ke permukaan. Karakter utama dihadapkan pada pilihan yang sangat sulit antara mengikuti hati atau logika.",
        "Ini adalah momen paling mengharukan sepanjang film. Hubungan antar karakter diuji dengan situasi yang sangat menantang dan menyakitkan.",
        "Semua konflik berujung pada resolusi yang sangat bermakna. Karakter utama akhirnya menemukan kedamaian dan memaafkan masa lalu."
      ]
    },
    default: {
      id: [
        "Cerita dimulai dengan pembuka yang sangat menarik dan memikat. Karakter utama diperkenalkan dengan latar belakang yang kuat dan personalitas yang berbeda.",
        "Alur semakin seru saat konflik mulai terlihat jelas. Tiap adegan membangun ketegangan dengan sangat apik dan tidak terduga.",
        "Ini adalah momen paling berkesan sepanjang film. Semua elemen cerita menyatu dalam adegan yang sangat epik dan emosional.",
        "Ending yang sangat memuaskan dan tak terlupakan. Semua pertanyaan terjawab dengan cara yang cerdas dan tak terduga."
      ]
    }
  };

  const g = storyTemplates[genre] || storyTemplates.default;
  const l = g[lang] || g['id'] || g['default'];

  clips.forEach((clip, idx) => {
    const isClip3 = idx === 2;
    const isLast = idx === clips.length - 1;
    const maxChars = getMaxChars(clip.durationSec, lang);

    let baseText = l[idx % l.length];

    if (isClip3) baseText += cta.mid;
    else if (isLast) baseText += cta.end;

    const finalText = truncateToLength(baseText, maxChars);

    narration.push({
      clipIndex: clip.index,
      start: clip.start,
      end: clip.end,
      durationSec: clip.durationSec,
      text: finalText,
      hasCTA: isClip3 || isLast,
      estimatedVO: `${clip.durationSec} detik`,
      charCount: finalText.length
    });
  });

  return narration;
}

function generateThumbnailPrompt(title, genre, lang) {
  return {
    prompt: `Cinematic ${genre} movie poster style, ${title}, dramatic lighting, main character in dynamic action pose, intense facial expression, bold cinematic typography area at bottom, teal and orange color grading, 8k, highly detailed, professional photography, trending on ArtStation --ar 16:9`,
    negativePrompt: "blurry, low quality, watermark, text overlay, distorted face, bad anatomy, cartoon, anime",
    tools: ["Midjourney", "DALL-E 3", "Leonardo.ai", "Ideogram", "Adobe Firefly"],
    aspectRatio: "16:9",
    title,
    genre
  };
}

// ============================================
// MAIN HANDLER
// ============================================
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, lang = 'id', format = 'short' } = req.body;

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return res.status(400).json({ success: false, error: "URL YouTube tidak valid" });
  }

  try {
    console.log(`[ANALYZE] Menyedot data video...`);

    // Ambil Info Dasar Video via YouTube oEmbed (tanpa API key)
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const oembedRes = await axios.get(oembedUrl, { timeout: 10000 });
    const title = oembedRes.data.title;
    
    // Estimasi durasi dari title/deskripsi atau default
    // Untuk durasi akurat, butuh YouTube Data API v3
    const durationSec = 3600; // Default 1 jam, nanti diperbaiki dengan YouTube API
    
    const durationMin = durationSec / 60;
    const clipConfig = getClipConfig(format);
    const genre = detectGenre(title, '');

    console.log(`[ANALYZE] Membangunkan AI untuk mencari adegan epik...`);

    // AI Prompt untuk timestamp
    const aiPrompt = `Kamu adalah Asisten Sutradara Profesional. 
Tugasmu membedah struktur film berdasarkan info berikut:
Judul: "${title}"
Genre: ${genre}
Durasi Total: ${durationSec} detik.

Aku butuh mengambil ${clipConfig.clipCount} klip penting yang mewakili: Pengenalan, Konflik Utama, Tragedi/Aksi Terheboh, dan Klimaks/Ending.
Berikan HANYA format array JSON berisi angka detik dimulainya adegan-adegan tersebut. 
Contoh output wajib: [120, 1500, 3200, 4800]
PENTING: Jangan berikan teks apapun selain array JSON. Angka tidak boleh melebihi durasi total (${durationSec}).`;

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
        },
        timeout: 30000
      });

      const aiText = aiResponse.data.choices[0].message.content;
      const jsonMatch = aiText.match(/\[.*?\]/s);
      if (jsonMatch) {
        startTimes = JSON.parse(jsonMatch[0]);
      }
    } catch (aiError) {
      console.log(`[AI ERROR] GPT-4o gagal, menggunakan fallback.`);
    }

    // Fallback jika AI gagal
    if (!startTimes || startTimes.length !== clipConfig.clipCount) {
      startTimes = [];
      const interval = Math.floor(durationSec / (clipConfig.clipCount + 1));
      for (let i = 0; i < clipConfig.clipCount; i++) {
        startTimes.push((i + 1) * interval); 
      }
    }

    // Susun klip
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
      duration: durationSec,
      durationFormatted: formatTime(durationSec),
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
};
