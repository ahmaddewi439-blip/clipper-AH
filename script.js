/* ============================================================
   CineClip AI — script.js
   ============================================================ */

'use strict';

/* ── State ── */
let currentClips    = [];
let currentMovieInfo = {};

/* ── Language display map ── */
const LANG_LABELS = {
  Indonesia : 'Indonesia',
  English   : 'English',
  Melayu    : 'Melayu',
  Jawa      : 'Jawa',
  Sunda     : 'Sunda',
  Japanese  : '日本語',
  Korean    : '한국어',
  Spanish   : 'Español',
};

/* ── Tone descriptions (for prompt) ── */
const TONE_DESC = {
  dramatic    : 'dramatis dan sinematik',
  hype        : 'hype, penuh energi, bikin penonton terbakar semangat',
  suspense    : 'menegangkan dan penuh ketegangan',
  emotional   : 'emosional, menyentuh hati',
  comedy      : 'lucu, ringan, menghibur',
  documentary : 'serius, informatif seperti narasi dokumenter',
};

/* ============================================================
   MAIN ENTRY
   ============================================================ */
async function startAnalysis() {
  const input = document.getElementById('movieInput').value.trim();
  if (!input) { showError('Masukkan judul atau URL film terlebih dahulu.'); return; }

  const voLang       = document.getElementById('voLang').value;
  const voTone       = document.getElementById('voTone').value;
  const clipCount    = document.getElementById('clipCount').value;
  const clipDuration = document.getElementById('clipDuration').value;

  hideError();
  document.getElementById('resultsArea').classList.remove('active');
  document.getElementById('progressArea').classList.add('active');
  document.getElementById('analyzeBtn').disabled = true;

  resetSteps();
  setProgress(5);

  try {
    await activateStep('step1', 1200); setProgress(20);
    await activateStep('step2', 1000); setProgress(40);
    await activateStep('step3',  800); setProgress(58);
    await activateStep('step4',  600); setProgress(78);

    const prompt = buildPrompt(input, voLang, voTone, clipCount, clipDuration);
    const raw    = await callClaudeAPI(prompt);

    await completeStep('step4');
    await activateStep('step5', 500); setProgress(92);
    await completeStep('step5');
    setProgress(100);
    await sleep(400);

    const parsed = parseResponse(raw);
    currentClips     = parsed.clips;
    currentMovieInfo = parsed.movie;

    renderResults(parsed, voLang, clipDuration);

    document.getElementById('progressArea').classList.remove('active');
    document.getElementById('resultsArea').classList.add('active');

  } catch (e) {
    document.getElementById('progressArea').classList.remove('active');
    showError('Terjadi kesalahan: ' + e.message + '. Coba ulangi atau masukkan judul film yang lebih spesifik.');
    console.error(e);
  } finally {
    document.getElementById('analyzeBtn').disabled = false;
  }
}

/* ============================================================
   PROMPT BUILDER (Versi Teks Statis CapCut Top & Bottom)
   ============================================================ */
function buildPrompt(input, lang, tone, count, duration) {
  const toneDesc = TONE_DESC[tone] || 'dramatis';

  return `Kamu adalah kreator YouTube Shorts super sukses yang fokus pada konten "Movie Commentary & Reaction" (Komentar Film). 
Tujuanmu adalah membuat naskah yang 100% LOLOS MONETISASI YouTube (Transformatif).

Film/input dari user: "${input}"

Tugasmu:
Buat ${count} klip berdurasi ${duration} detik secara KRONOLOGIS (dari awal hingga akhir film).
PENTING: Jangan hanya merangkum adegan! Skrip HARUS berisi opini, reaksi, atau analisis mendalam terhadap adegan tersebut agar bersifat transformatif.

Untuk SETIAP klip, berikan output dalam format JSON PERSIS seperti ini (HANYA JSON):

{
  "movie": {
    "title": "judul film",
    "year": "tahun",
    "genre": ["genre1", "genre2"],
    "director": "sutradara",
    "description": "sinopsis singkat",
    "total_duration": "durasi total"
  },
  "clips": [
    {
      "id": 1,
      "title": "judul singkat adegan",
      "scene_description": "deskripsi visual adegan untuk direkam dari film",
      "timestamp_start": "HH:MM:SS",
      "timestamp_end": "HH:MM:SS",
      "duration_seconds": ${duration},
      "hype_level": 5,
      "reason": "alasan kenapa adegan ini layak dikomentari",
      "teks_statis_capcut": {
        "judul_atas": "JUDUL ATAS LAYAR (Maks 4 kata, wajib Kapital semua, mewakili klip)",
        "opsi_hook_bawah": [
          "Opsi 1 hook teks bawah layar (Maks 6 kata, provokatif/penasaran)",
          "Opsi 2 hook teks bawah layar (Maks 6 kata, pertanyaan)",
          "Opsi 3 hook teks bawah layar (Maks 6 kata, emosional)"
        ]
      },
      "vo_script": "skrip voice over commentary",
      "hashtags": ["#tag1", "#tag2", "#tag3"]
    }
  ]
}

ATURAN WAJIB UNTUK TEKS CAPCUT & VO SCRIPT:
1. TEKS STATIS CAPCUT: User akan memasang teks ini dari detik pertama hingga akhir video. "judul_atas" harus mencolok (contoh: "FAKTA TERSEMBUNYI TITANIC"), dan "opsi_hook_bawah" harus memancing orang berkomentar (contoh: "Kenapa dia lakuin ini?!").
2. GAYA BAHASA VO: Gunakan bahasa tutur Indonesia yang sangat kasual dan natural (contoh: "nggak", "kayak", "gila banget").
3. ARAHAN KAMERA (AKTING): Di dalam vo_script, sisipkan teks di dalam kurung siku sebagai arahan untuk kreator. Contoh: "[Geleng-geleng kepala] Sumpah cowok ini nekat banget..."

Pastikan output HANYA JSON yang valid, tanpa teks awalan atau akhiran apa pun.`;
}

/* ============================================================
   CLAUDE API CALL (Diperbarui ke OpenRouter API)
   ============================================================ */
async function callClaudeAPI(prompt) {
  // Masukkan API Key OpenRouter Anda di antara tanda kutip di bawah ini
  const OPENROUTER_API_KEY = 'KODE_API_OPENROUTER_ANDA_MASUKKAN_DISINI';
  const BASE_URL = 'https://openrouter.ai/api/v1';

  const response = await fetch(BASE_URL + '/chat/completions', {
    method  : 'POST',
    headers : {
      'Content-Type'  : 'application/json',
      'Authorization' : 'Bearer ' + OPENROUTER_API_KEY,
      'HTTP-Referer'  : 'https://clipper-ah.vercel.app', 
      'X-Title'       : 'CineClip AI' 
    },
    body : JSON.stringify({
      model      : 'google/gemini-1.5-flash', // Model yang super cepat dan stabil
      messages   : [{ role: 'user', content: prompt }]
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'HTTP ' + response.status);
  }

  const data = await response.json();
  
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  } else {
    throw new Error('Respons dari AI kosong atau format tidak sesuai.');
  }
}

/* ============================================================
   PARSE RESPONSE
   ============================================================ */
function parseResponse(raw) {
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (_) {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Format respons tidak valid. Coba ulangi.');
  }
}

/* ============================================================
   RENDER RESULTS
   ============================================================ */
function renderResults(data, lang, duration) {
  const { movie, clips } = data;

  const metaEl = document.getElementById('movieMeta');
  metaEl.innerHTML = `
    <div class="movie-poster">🎬</div>
    <div class="movie-info">
      <h2>${movie.title} (${movie.year || ''})</h2>
      <p>${movie.description || ''}</p>
      <div class="movie-tags">
        ${(movie.genre || []).map(g => `<span class="tag">${g}</span>`).join('')}
        <span class="tag hot">▶ ${clips.length} Klip</span>
        <span class="tag">⏱ ${duration}s / klip</span>
        <span class="tag">🌐 VO: ${LANG_LABELS[lang] || lang}</span>
      </div>
    </div>
  `;

  const grid = document.getElementById('clipsGrid');
  grid.innerHTML = clips.map((clip, i) => {
    const flames = '🔥'.repeat(Math.min(clip.hype_level || 3, 5));
    
    // Menangkap data teks statis capcut dari AI
    const ts = clip.teks_statis_capcut || { judul_atas: clip.title, opsi_hook_bawah: ["Hook 1", "Hook 2", "Hook 3"] };

    return `
    <div class="clip-card" id="clipCard${i}">

      <div class="clip-header" onclick="toggleClip(${i})">
        <div class="clip-num">0${clip.id}</div>
        <div class="clip-meta">
          <div class="clip-title">${clip.title}</div>
          <div class="clip-subtitle">${clip.reason || ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div class="clip-duration-badge">${clip.timestamp_start} → ${clip.timestamp_end}</div>
          <div class="clip-hype">${flames}</div>
        </div>
        <div class="chevron">▼</div>
      </div>

      <div class="clip-body">
        <div class="clip-body-grid">
          <div class="info-block">
            <h4>Timestamp</h4>
            <div class="timestamp-bar">
              <span>${clip.timestamp_start}</span>
              <span class="ts-arrow">──────►</span>
              <span>${clip.timestamp_end}</span>
            </div>
          </div>
          <div class="info-block">
            <h4>Durasi &amp; Hype</h4>
            <div class="timestamp-bar">
              <span>⏱ ${clip.duration_seconds || duration} detik</span>
              <span style="color:var(--gold)">🔥 ${clip.hype_level || '?'}/5</span>
            </div>
          </div>
        </div>

        <div class="info-block" style="margin-top:12px">
          <h4>Deskripsi Adegan</h4>
          <div class="scene-desc">${clip.scene_description || '-'}</div>
        </div>

        <!-- BLOK BARU UNTUK TEKS CAPCUT (FULL DURASI) -->
        <div class="info-block" style="margin-top:14px; background: rgba(255, 69, 0, 0.08); border-left: 3px solid var(--primary); padding: 14px;">
          <h4 style="color: var(--primary); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            📱 Teks Statis CapCut (Tampil Awal s/d Akhir)
          </h4>
          <div style="font-family: monospace; font-size: 0.95rem; line-height: 1.6;">
            <div style="color: #fff; margin-bottom: 6px;">
              <strong>[TEKS ATAS] Judul:</strong><br> 
              <span style="color:var(--gold); font-size: 1.05rem;">"${ts.judul_atas}"</span>
            </div>
            <div style="color: #fff;"><strong>[TEKS BAWAH] Pilih 1 Hook:</strong></div>
            <ul style="margin: 4px 0 0 20px; color: var(--accent2);">
              <li>"${ts.opsi_hook_bawah[0] || '-'}"</li>
              <li>"${ts.opsi_hook_bawah[1] || '-'}"</li>
              <li>"${ts.opsi_hook_bawah[2] || '-'}"</li>
            </ul>
          </div>
        </div>

        <div class="vo-section" style="margin-top: 14px;">
          <h4 class="section-label" style="margin:0 0 8px">🎙 Skrip Voice Over — ${LANG_LABELS[lang] || lang}</h4>
          <div class="vo-script-box" id="voBox${i}">
            <button class="vo-copy-btn" id="copyBtn${i}" onclick="copyVO(${i})">COPY</button>
            <div class="vo-text">${clip.vo_script || '-'}</div>
          </div>
        </div>

        <div class="info-block" style="margin-top:12px">
          <h4>Hashtag</h4>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${(clip.hashtags || []).map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
        </div>

        <div class="clip-actions">
          <button class="clip-action-btn primary" onclick="showExport(${i})">⬇ Panduan Export</button>
          <button class="clip-action-btn" onclick="copyVO(${i})">📋 Copy VO Script</button>
          <button class="clip-action-btn" onclick="copyFullClip(${i})">📄 Copy Semua Info</button>
        </div>
      </div>

    </div>`;
  }).join('');
}

/* ============================================================
   TOGGLE CLIP
   ============================================================ */
function toggleClip(i) {
  document.getElementById('clipCard' + i).classList.toggle('open');
}

/* ============================================================
   COPY HELPERS
   ============================================================ */
function copyVO(i) {
  const clip = currentClips[i];
  if (!clip) return;
  
  const cleanVO = (clip.vo_script || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();

  navigator.clipboard.writeText(cleanVO).then(() => {
    const btn = document.getElementById('copyBtn' + i);
    if (btn) {
      btn.textContent = '✓ COPIED';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'COPY'; btn.classList.remove('copied'); }, 2000);
    }
  }).catch(() => alert('Tekan Ctrl+C setelah teks diseleksi.'));
}

function copyFullClip(i) {
  const clip = currentClips[i];
  if (!clip) return;

  const ts = clip.teks_statis_capcut || { judul_atas: "-", opsi_hook_bawah: [] };
  const hookText = (ts.opsi_hook_bawah || []).map((h, idx) => `Opsi ${idx + 1}: "${h}"`).join('\n');

  const txt =
`=== KLIP ${clip.id}: ${clip.title} ===
Timestamp : ${clip.timestamp_start} → ${clip.timestamp_end}
Durasi    : ${clip.duration_seconds} detik  |  Hype: ${clip.hype_level}/5

DESKRIPSI ADEGAN:
${clip.scene_description}

📱 TEKS STATIS CAPCUT (Tampil Awal s/d Akhir):
Teks Atas (Judul) : "${ts.judul_atas}"
Teks Bawah (Hook) :
${hookText}

🎙 SKRIP VOICE OVER:
${clip.vo_script}

HASHTAG: ${(clip.hashtags || []).join(' ')}
`;
  navigator.clipboard.writeText(txt)
    .then(() => alert('✓ Semua info klip berhasil dicopy!'))
    .catch(() => alert(txt));
}

/* ============================================================
   EXPORT MODAL
   ============================================================ */
function showExport(i) {
  const clip = currentClips[i];
  const name = (clip.title || 'scene').replace(/\s+/g, '_');

  document.getElementById('modalContent').innerHTML = `
    <p style="color:var(--dim);font-size:.8rem;line-height:1.7;margin-bottom:12px">
      Gunakan perintah ffmpeg berikut untuk memotong klip ini dari file video lokal:
    </p>
    <div class="ffmpeg-block">ffmpeg -i "nama_film.mp4" \\
  -ss ${clip.timestamp_start} \\
  -to ${clip.timestamp_end} \\
  -c:v libx264 -c:a aac \\
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,\\
pad=1080:1920:(ow-iw)/2:(oh-ih)/2" \\
  "klip_${clip.id}_${name}.mp4"</div>
    <p class="modal-note">
      📱 <strong>Format:</strong> Output 9:16 (1080×1920) siap untuk Shorts / Reels / TikTok.<br>
      🎙 <strong>VO:</strong> Rekam voice over lalu gabungkan dengan CapCut.<br>
      ⚡ <strong>Tips:</strong> Pasang Teks Atas (Judul) dan Teks Bawah (Hook) di CapCut sepanjang durasi klip.
    </p>
    <div class="clip-actions" style="margin-top:16px">
      <button class="clip-action-btn primary" onclick="copyFFmpeg(${i})">📋 Copy Command ffmpeg</button>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function copyFFmpeg(i) {
  const clip = currentClips[i];
  const name = (clip.title || 'scene').replace(/\s+/g, '_');
  const cmd  =
`ffmpeg -i "nama_film.mp4" -ss ${clip.timestamp_start} -to ${clip.timestamp_end} ` +
`-c:v libx264 -c:a aac ` +
`-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" ` +
`"klip_${clip.id}_${name}.mp4"`;
  navigator.clipboard.writeText(cmd)
    .then(() => alert('✓ Command ffmpeg berhasil dicopy!'))
    .catch(() => alert(cmd));
}

/* ============================================================
   EXPORT ALL (download .txt)
   ============================================================ */
function exportAll() {
  if (!currentClips.length) return;
  const movie = currentMovieInfo;
  let out = `=== CINECLIP AI EXPORT ===\nFilm: ${movie.title} (${movie.year})\n${'='.repeat(40)}\n\n`;

  currentClips.forEach(clip => {
    out += `--- KLIP ${clip.id}: ${clip.title} ---\n`;
    out += `Timestamp : ${clip.timestamp_start} → ${clip.timestamp_end} (${clip.duration_seconds}s)\n`;
    out += `Hype      : ${'★'.repeat(clip.hype_level || 3)}\n\n`;
    out += `Deskripsi:\n${clip.scene_description}\n\n`;
    
    const ts = clip.teks_statis_capcut || { judul_atas: "-", opsi_hook_bawah: [] };
    const hookText = (ts.opsi_hook_bawah || []).map((h, idx) => `Opsi ${idx + 1}: "${h}"`).join('\n');
      
    out += `TEKS STATIS CAPCUT (Awal s/d Akhir):\n`;
    out += `Teks Atas: "${ts.judul_atas}"\n`;
    out += `Teks Bawah:\n${hookText}\n\n`;
    
    out += `VO Script:\n${clip.vo_script}\n\n`;
    out += `Hashtag: ${(clip.hashtags || []).join(' ')}\n`;
    out += `${'─'.repeat(40)}\n\n`;
  });

  const blob = new Blob([out], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `cineclip_${(movie.title || 'film').replace(/\s+/g, '_')}.txt`;
  a.click();
}

/* ============================================================
   PROGRESS HELPERS
   ============================================================ */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function setProgress(pct) {
  document.getElementById('progressBar').style.width = pct + '%';
}

function resetSteps() {
  ['step1','step2','step3','step4','step5'].forEach((id, idx) => {
    const el = document.getElementById(id);
    el.className = 'step';
    el.querySelector('.step-icon').textContent = String(idx + 1);
  });
  setProgress(0);
}

async function activateStep(id, delay) {
  document.getElementById(id).classList.add('active');
  await sleep(delay);
}

async function completeStep(id) {
  const el = document.getElementById(id);
  el.classList.remove('active');
  el.classList.add('done');
  el.querySelector('.step-icon').textContent = '✓';
  const ids = ['step1','step2','step3','step4','step5'];
  const idx  = ids.indexOf(id);
  for (let j = 0; j < idx; j++) {
    const prev = document.getElementById(ids[j]);
    if (!prev.classList.contains('done')) {
      prev.classList.add('done');
      prev.querySelector('.step-icon').textContent = '✓';
    }
  }
}

/* ============================================================
   ERROR HELPERS
   ============================================================ */
function showError(msg) {
  const el = document.getElementById('errorBox');
  el.textContent = '⚠ ' + msg;
  el.classList.add('active');
}

function hideError() {
  document.getElementById('errorBox').classList.remove('active');
}

/* ============================================================
   KEYBOARD SHORTCUT — Enter to analyze
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('movieInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') startAnalysis();
  });
});
