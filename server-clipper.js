const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use('/output', express.static('output'));

const FFMPEG_PATH = "C:\\Users\\User\\ffmpeg\\bin\\ffmpeg.exe";
const YTDLP_PATH  = "C:\\Users\\User\\ffmpeg\\bin\\yt-dlp.exe";

const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// ==================== KONFIGURASI BAHASA ====================
const LANGUAGES = {
  en: { name: 'English', tier: 1, charPerSec: 4.5, cta_mid: "If you want to know what happens next, please subscribe and hit the bell notification...", cta_end: "That was the recap. Don't forget to like, subscribe, and share this video. See you in the next one!" },
  ja: { name: '日本語', tier: 1, charPerSec: 3.8, cta_mid: "続きが気になる方は、チャンネル登録と通知のベルをお願いします...", cta_end: "以上が要約でした。高評価、チャンネル登録、共有をお忘れなく。次の動画でお会いしましょう！" },
  de: { name: 'Deutsch', tier: 1, charPerSec: 4.2, cta_mid: "Wenn Sie wissen möchten, was als Nächstes passiert, abonnieren Sie bitte und aktivieren Sie die Glocke...", cta_end: "Das war die Zusammenfassung. Vergessen Sie nicht zu liken, abonnieren und teilen. Bis zum nächsten Mal!" },
  fr: { name: 'Français', tier: 1, charPerSec: 4.3, cta_mid: "Si vous voulez savoir la suite, abonnez-vous et activez la cloche...", cta_end: "C'était le résumé. N'oubliez pas d'aimer, vous abonner et partager. À la prochaine!" },
  es: { name: 'Español', tier: 2, charPerSec: 4.4, cta_mid: "Si quieres saber qué pasa después, suscríbete y activa la campana...", cta_end: "Ese fue el resumen. No olvides dar like, suscribirte y compartir. ¡Nos vemos en el próximo!" },
  pt: { name: 'Português', tier: 2, charPerSec: 4.3, cta_mid: "Se quiser saber o que acontece depois, inscreva-se e ative o sininho...", cta_end: "Esse foi o resumo. Não esqueça de curtir, se inscrever e compartilhar. Até o próximo!" },
  ru: { name: 'Русский', tier: 2, charPerSec: 4.0, cta_mid: "Если хотите узнать, что будет дальше, подпишитесь и нажмите на колокольчик...", cta_end: "Это была сводка. Не забудьте поставить лайк, подписаться и поделиться. До следующей встречи!" },
  ar: { name: 'العربية', tier: 2, charPerSec: 3.8, cta_mid: "إذا كنت تريد معرفة ما سيحدث بعد ذلك، يرجى الاشتراك وتفعيل الجرس...", cta_end: "كان هذا الملخص. لا تنسَ الإعجاب والاشتراك والمشاركة. إلى اللقاء في الفيديو القادم!" },
  id: { name: 'Bahasa Indonesia', tier: 'local', charPerSec: 3.5, cta_mid: "Jika ingin tahu kelanjutannya, bantu subscribe dan nyalakan loncengnya ya...", cta_end: "Itu tadi rangkumannya. Jangan lupa like, subscribe, dan share video ini. Sampai jumpa di video berikutnya!" },
  ko: { name: '한국어', tier: 1, charPerSec: 3.8, cta_mid: "다음 내용이 궁금하시면 구독과 알림 설정 부탁드립니다...", cta_end: "지금까지 요약이었습니다. 좋아요, 구독, 공유 잊지 마세요. 다음 영상에서 만나요!" }
};

// ==================== UTILITAS ====================

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  return `${mins}:${secs.toString().padStart(2,'0')}`;
}

function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  return parts[0]*60 + parts[1];
}

// ==================== PERHITUNGAN KLIP STRICT ====================

function getClipConfig(durationSeconds, isShort) {
  const durationMin = durationSeconds / 60;

  let clipCount, clipDuration;

  if (isShort || durationMin <= 1) {
    // SHORT: wajib 4 klip, tiap klip 15 detik
    clipCount = 4;
    clipDuration = 15;
  } else if (durationMin <= 5) {
    // 5 MENIT: wajib 7 klip, tiap klip ~43 detik
    clipCount = 7;
    clipDuration = Math.floor(durationSeconds / clipCount);
  } else if (durationMin <= 10) {
    // 10 MENIT: wajib 12 klip, tiap klip ~50 detik
    clipCount = 12;
    clipDuration = Math.floor(durationSeconds / clipCount);
  } else {
    // >10 MENIT: max 12 klip, tiap klip ~50 detik (ambil awal video)
    clipCount = 12;
    clipDuration = 50;
  }

  return { clipCount, clipDuration };
}

function generateClipTimestamps(durationSeconds, isShort) {
  const config = getClipConfig(durationSeconds, isShort);
  const clips = [];

  for (let i = 0; i < config.clipCount; i++) {
    const start = i * config.clipDuration;
    const end = start + config.clipDuration;

    // Jika melebihi durasi video, stop
    if (start >= durationSeconds) break;
    const actualEnd = Math.min(end, durationSeconds);
    const actualDuration = actualEnd - start;

    clips.push({
      index: i + 1,
      start: formatTime(start),
      end: formatTime(actualEnd),
      startSec: start,
      endSec: actualEnd,
      durationSec: actualDuration
    });
  }

  return clips;
}

function detectGenre(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('action') || text.includes('war') || text.includes('fight') || text.includes('mission')) return 'action';
  if (text.includes('horror') || text.includes('ghost') || text.includes('scary') || text.includes('dead') || text.includes('santet') || text.includes('setan')) return 'horror';
  if (text.includes('comedy') || text.includes('funny') || text.includes('laugh')) return 'comedy';
  if (text.includes('romance') || text.includes('love') || text.includes('kiss') || text.includes('heart')) return 'romance';
  if (text.includes('thriller') || text.includes('mystery') || text.includes('crime')) return 'thriller';
  if (text.includes('drama') || text.includes('family') || text.includes('life')) return 'drama';
  return 'drama';
}

// ==================== GENERATE NARASI DENGAN PANJANG SESUAI DURASI ====================

function getMaxChars(durationSec, lang) {
  const langData = LANGUAGES[lang] || LANGUAGES['id'];
  return Math.floor(durationSec * langData.charPerSec);
}

function truncateToLength(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function generateHook(genre, lang, maxChars) {
  const hooks = {
    action: {
      en: ["He didn't know this day would change everything...", "One fatal decision...", "No way out...", "The mission begins now..."],
      id: ["Dia tidak tahu hari ini akan mengubah segalanya...", "Satu keputusan fatal...", "Tidak ada jalan keluar...", "Misi dimulai sekarang..."],
      ja: ["彼は今日が全てを変えるとは知らなかった...", "致命的な決断...", "出口はない...", "任務は今始まる..."],
      ko: ["그는 오늘이 모든 것을 바꿀 줄 몰랐다...", "치명적인 결정...", "탈출구는 없다...", "임무가 지금 시작된다..."],
      default: ["The moment everything changes...", "A decision that can't be undone..."]
    },
    horror: {
      en: ["Don't look behind you...", "It was already here...", "The silence before the scream..."],
      id: ["Jangan lihat ke belakang...", "Mereka sudah ada di sini...", "Keheningan sebelum teriakan..."],
      default: ["Something is watching...", "The nightmare begins..."]
    },
    romance: {
      en: ["A love that shouldn't happen...", "When hearts collide...", "The confession that changed everything..."],
      id: ["Cinta yang seharusnya tidak terjadi...", "Ketika hati bertabrakan...", "Pengakuan yang mengubah segalanya..."],
      default: ["Love in unexpected places...", "The heart wants what it wants..."]
    },
    drama: {
      en: ["A secret hidden for years...", "The truth finally revealed...", "When family is tested..."],
      id: ["Sebuah rahasia tersembunyi selama bertahun-tahun...", "Kebenaran akhirnya terungkap...", "Ketika keluarga diuji..."],
      default: ["The moment of truth...", "Everything falls apart..."]
    },
    default: {
      en: ["This moment changes everything...", "No one saw this coming...", "The scene everyone is talking about..."],
      id: ["Momen ini mengubah segalanya...", "Tidak ada yang menduga ini...", "Adegan yang dibicarakan semua orang..."],
      default: ["The moment you've been waiting for..."]
    }
  };

  const g = hooks[genre] || hooks.default;
  const l = g[lang] || g['en'] || g['default'];
  const hook = l[Math.floor(Math.random() * l.length)];
  return truncateToLength(hook, maxChars);
}

function generateSynopsis(clipIndex, title, genre, lang, maxChars) {
  const templates = {
    en: `In this scene from ${title}, the ${genre} intensifies as the story reaches a critical point. The tension builds up with every second, keeping viewers on the edge of their seats.`,
    id: `Dalam adegan ini dari ${title}, ketegangan ${genre} meningkat saat cerita mencapai titik kritis. Ketegangan memuncak di setiap detik, membuat penonton terpaku pada layar.`,
    ja: `${title}のこのシーンでは、物語が重要な局面に達するにつれて${genre}が激化します。緊張感が一秒ごとに高まり、視聴者を席に釘付けにします。`,
    ko: `${title}의 이 장면에서는 이야기가 중대한 국면에 도달하면서 ${genre}이 고조됩니다. 긴장감이 매초 높아지며 시청자들을 자리에 붙들어놓습니다.`,
    default: `Scene ${clipIndex} from ${title} intensifies the ${genre} narrative.`
  };

  const text = templates[lang] || templates['en'];
  return truncateToLength(text, maxChars);
}

function generateHighlight(clipIndex, title, genre, lang, maxChars) {
  const templates = {
    en: `This is the highlight that fans have been waiting for — pure ${genre} at its finest. The cinematography and acting combine to create an unforgettable moment in cinema history.`,
    id: `Ini adalah highlight yang ditunggu-tunggu penggemar — ${genre} murni dalam versi terbaiknya. Sinematografi dan akting menyatu menciptakan momen tak terlupakan dalam sejarah perfilman.`,
    ja: `これはファンが待ち望んでいたハイライトです — 最高の${genre}。撮影技術と演技が融合し、映画史に残る忘れられない瞬間を生み出しています。`,
    ko: `이것은 팬들이 기다리던 하이라이트입니다 — 최고의 ${genre}。촬영 기법과 연기가 어우러져 영화사에 남을 잊을 수 없는 순간을 만들어냅니다.`,
    default: `The highlight of scene ${clipIndex} showcases the best of ${genre}.`
  };

  const text = templates[lang] || templates['en'];
  return truncateToLength(text, maxChars);
}

function generateTransition(lang, maxChars) {
  const templates = {
    en: "But what happens next will leave you speechless. Stay tuned for the next scene that changes everything.",
    id: "Tapi apa yang terjadi selanjutnya akan membuatmu terdiam. Tunggu adegan berikutnya yang mengubah segalanya.",
    ja: "しかし、次に起こることはあなたを言葉を失わせるでしょう。全てを変える次のシーンをお見逃しなく。",
    ko: "하지만 다음에 일어날 일은 당신을 말문이 막히게 할 것입니다. 모든 것을 바꿀 다음 장면을 놓치지 마세요.",
    default: "What happens next will shock you..."
  };

  const text = templates[lang] || templates['en'];
  return truncateToLength(text, maxChars);
}

function generateNarration(clips, lang, title, genre) {
  const langData = LANGUAGES[lang] || LANGUAGES['id'];
  const narration = [];

  clips.forEach((clip, idx) => {
    const isClip3 = idx === 2;      // Klip ke-3 (index 2)
    const isLast = idx === clips.length - 1;
    const maxChars = getMaxChars(clip.durationSec, lang);

    // Bagi durasi: Hook 20%, Sinopsis 35%, Highlight 30%, CTA/Transisi 15%
    const hookMax = Math.floor(maxChars * 0.20);
    const synMax = Math.floor(maxChars * 0.35);
    const highMax = Math.floor(maxChars * 0.30);
    const ctaMax = Math.floor(maxChars * 0.15);

    let text = "";
    const hook = generateHook(genre, lang, hookMax);
    const synopsis = generateSynopsis(clip.index, title, genre, lang, synMax);
    const highlight = generateHighlight(clip.index, title, genre, lang, highMax);

    text += `[HOOK] ${hook}\n\n`;
    text += `[SINOPSIS] ${synopsis}\n\n`;
    text += `[HIGHLIGHT] ${highlight}\n\n`;

    if (isClip3) {
      const cta = truncateToLength(langData.cta_mid, ctaMax);
      text += `[CTA SUBSCRIBE] ${cta}\n\n`;
    }

    if (isLast) {
      const cta = truncateToLength(langData.cta_end, ctaMax);
      text += `[CTA AKHIR] ${cta}`;
    } else if (!isClip3) {
      const trans = generateTransition(lang, ctaMax);
      text += `[TRANSISI] ${trans}`;
    }

    narration.push({
      clipIndex: clip.index,
      start: clip.start,
      end: clip.end,
      durationSec: clip.durationSec,
      text: text.trim(),
      hasCTA: isClip3 || isLast,
      estimatedVO: `${clip.durationSec} detik`,
      charCount: text.replace(/\[[^\]]+\]/g, '').length
    });
  });

  return narration;
}

function generateThumbnailPrompt(title, genre, lang) {
  const prompts = {
    en: `Cinematic ${genre} movie poster style, ${title}, dramatic lighting, main character in dynamic action pose, intense facial expression, bold cinematic typography area at bottom, teal and orange color grading, 8k, highly detailed, professional photography, trending on ArtStation --ar 16:9`,
    id: `Gaya poster film ${genre} sinematik, ${title}, pencahayaan dramatis, karakter utama dalam pose aksi dinamis, ekspresi wajah intens, area tipografi sinematik tebal di bawah, color grading teal dan orange, 8k, sangat detail, fotografi profesional, trending di ArtStation --ar 16:9`,
    ja: `シネマティック${genre}映画ポスタースタイル、${title}、劇的な照明、ダイナミックなアクションポーズの主人公、強烈な表情、下部に太字シネマティックタイポグラフィエリア、ティールとオレンジのカラーグレーディング、8k、高精細、プロフェッショナル写真、ArtStationでトレンド --ar 16:9`,
    ko: `시네마틱 ${genre} 영화 포스터 스타일, ${title}, 극적인 조명, 다이내믹한 액션 포즈의 주인공, 강렬한 표정, 하단에 굵은 시네마틱 타이포그래피 영역, 틸과 오렌지 컬러 그레이딩, 8k, 고해상도, 전문 사진, ArtStation 트렌드 --ar 16:9`,
    default: `Cinematic ${genre} poster, ${title}, dramatic lighting, dynamic pose, bold text bottom, 8k --ar 16:9`
  };

  return {
    prompt: prompts[lang] || prompts['en'],
    negativePrompt: "blurry, low quality, watermark, text overlay, distorted face, bad anatomy, cartoon, anime",
    tools: ["Midjourney", "DALL-E 3", "Leonardo.ai", "Ideogram", "Adobe Firefly"],
    aspectRatio: "16:9",
    title: title,
    genre: genre
  };
}

// ==================== ENDPOINT 1: ANALYZE ====================

app.post('/api/analyze', async (req, res) => {
  const { url, lang = 'id', isShort = false } = req.body;

  if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    return res.status(400).json({ success: false, error: "URL YouTube tidak valid" });
  }

  try {
    console.log(`[ANALYZE] Mulai analisis: ${url} | Bahasa: ${lang} | Short: ${isShort}`);

    // Ambil metadata TANPA download video
    const infoCmd = `"${YTDLP_PATH}" --print "%(title)s" --print "%(duration)s" --print "%(description)s" "${url}"`;
    const infoOutput = execSync(infoCmd, { encoding: 'utf8', stdio: 'pipe', timeout: 15000 });
    const lines = infoOutput.trim().split('\n');

    const title = lines[0] || 'Unknown Title';
    const duration = parseFloat(lines[1]) || 0;
    const description = lines.slice(2).join(' ') || '';

    if (duration === 0) throw new Error("Gagal mendapatkan durasi video");

    const durationMin = duration / 60;
    const clipConfig = getClipConfig(duration, isShort);
    const clips = generateClipTimestamps(duration, isShort);
    const genre = detectGenre(title, description);
    const narration = generateNarration(clips, lang, title, genre);
    const thumbnail = generateThumbnailPrompt(title, genre, lang);

    console.log(`[ANALYZE] OK: ${title} | ${durationMin.toFixed(1)}min | ${clips.length} klip | ${clipConfig.clipDuration}s/klip | ${genre}`);

    res.json({
      success: true,
      title: title,
      duration: duration,
      durationFormatted: formatTime(duration),
      durationMinutes: Math.round(durationMin * 10) / 10,
      clipCount: clips.length,
      clipDuration: clipConfig.clipDuration,
      genre: genre,
      language: LANGUAGES[lang],
      clips: clips,
      narration: narration,
      thumbnail: thumbnail,
      url: url,
      isShort: isShort
    });

  } catch (err) {
    console.error(`[ANALYZE] ERROR:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== ENDPOINT 2: RENDER ====================

app.post('/api/render', async (req, res) => {
  const { url, clips, lang = 'id', isShort = false } = req.body;
  const ts = Date.now();

  const finalOut = path.join(OUTPUT_DIR, `Klip_${ts}.mp4`);
  const concatListPath = path.join(OUTPUT_DIR, `concat_${ts}.txt`);

  let concatContent = "";
  const processedFiles = [];

  try {
    console.log(`[RENDER ${ts}] Mulai render ${clips.length} klip | Short: ${isShort}`);

    // 1. Download video full SEKALI
    const fullVideoPath = path.join(OUTPUT_DIR, `full_${ts}.mp4`);
    console.log(`[RENDER ${ts}] Download video utama...`);

    const dldCmd = `"${YTDLP_PATH}" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${url}" -o "${fullVideoPath}" --merge-output-format mp4`;
    execSync(dldCmd, { stdio: 'pipe', timeout: 300000 });

    if (!fs.existsSync(fullVideoPath)) throw new Error("Gagal download video");

    // 2. Process setiap klip
    for (let i = 0; i < clips.length; i++) {
      const { start, end } = clips[i];
      const processedFile = path.join(OUTPUT_DIR, `proc_${ts}_${i}.mp4`);

      console.log(`[RENDER ${ts}] Cut klip ${i + 1}: ${start} - ${end}`);

      let vf = isShort
        ? "crop=ih*9/16:ih,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p"
        : "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p";

      const cropCmd =
        `"${FFMPEG_PATH}" -y -i "${fullVideoPath}" ` +
        `-ss ${start} -to ${end} ` +
        `-vf "${vf}" ` +
        `-c:v libx264 -preset fast -crf 23 ` +
        `-c:a aac -b:a 128k ` +
        `-movflags +faststart ` +
        `"${processedFile}"`;

      execSync(cropCmd, { stdio: 'pipe', timeout: 120000 });
      processedFiles.push(processedFile);
      concatContent += `file '${processedFile.replace(/\\/g, '/')}'\n`;
    }

    // 3. Merge
    fs.writeFileSync(concatListPath, concatContent);
    const mergeCmd = `"${FFMPEG_PATH}" -f concat -safe 0 -i "${concatListPath}" -c copy -movflags +faststart "${finalOut}" -y`;
    execSync(mergeCmd, { stdio: 'pipe' });

    // 4. Cleanup
    processedFiles.forEach(f => { if(fs.existsSync(f)) fs.unlinkSync(f); });
    if(fs.existsSync(fullVideoPath)) fs.unlinkSync(fullVideoPath);
    if(fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);

    console.log(`[RENDER ${ts}] SELESAI: ${finalOut}`);

    res.json({
      success: true,
      videoUrl: `http://localhost:3000/output/Klip_${ts}.mp4`,
      filename: `Klip_${ts}.mp4`,
      message: "Render selesai!"
    });

  } catch (err) {
    console.error(`[RENDER ${ts}] ERROR:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== START ====================

app.listen(PORT, () => {
  console.log("🚀 CINECLIPPER v2.1 aktif di port " + PORT);
  console.log("📁 Output: " + OUTPUT_DIR);
  console.log("\n📋 Endpoint:");
  console.log("   POST /api/analyze  -> Analisis video (cepat, tanpa download)");
  console.log("   POST /api/render   -> Render video (download + cut + merge)");
  console.log("\n✅ RULES KLIP:");
  console.log("   Short (≤1min)  = 4 klip x 15 detik");
  console.log("   5 menit        = 7 klip x ~43 detik");
  console.log("   10 menit       = 12 klip x ~50 detik");
  console.log("   >10 menit      = 12 klip x 50 detik (ambil awal)");
});