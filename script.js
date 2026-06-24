/* ============================================================
   CineClip AI — script.js (VERSI ULTIMATE CLAUDE 3.5 SONNET)
   ============================================================ */

'use strict';

let currentClips    = [];
let currentMovieInfo = {};

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

const TONE_DESC = {
  dramatic    : 'dramatis dan sinematik',
  hype        : 'hype, penuh energi, bikin penonton terbakar semangat',
  suspense    : 'menegangkan dan penuh ketegangan',
  emotional   : 'emosional, menyentuh hati',
  comedy      : 'lucu, ringan, menghibur',
  documentary : 'serius, informatif seperti narasi dokumenter',
};

async function startAnalysis() {
  const input = document.getElementById('movieInput').value.trim();
  if (!input) { showError('Masukkan judul atau detail film terlebih dahulu.'); return; }

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
    showError('Terjadi kesalahan: ' + e.message);
    console.error(e);
  } finally {
    document.getElementById('analyzeBtn').disabled = false;
  }
}

function buildPrompt(input, lang, tone, count, duration) {
  return `Kamu adalah kreator YouTube Shorts ahli "Movie Commentary" dengan kualitas naskah tinggi.

INFORMASI DARI USER: "${input}"

ATURAN ANTI-HALUSINASI SANGAT KETAT:
1. JIKA FILM TERLALU BARU: Gunakan 100% detail dari petunjuk yang diketik user (misal: "cewek jaket kuning"). Kembangkan narasi dari petunjuk tersebut, JANGAN MENGARANG cerita/karakter fiktif yang tidak diminta.
2. TIMESTAMP: Jika tidak tahu durasi pastinya, berikan angka urut saja (misal 00:00:00 -> 00:01:00) sebagai ESTIMASI.
3. Buat ${count} klip berdurasi ${duration} detik.

Output HARUS format JSON persis seperti ini (HANYA JSON):
{
  "movie": {
    "title": "Judul film",
    "year": "Tahun",
    "genre": ["genre1", "genre2"],
    "director": "Sutradara (atau isi Tidak Diketahui)",
    "description": "Sinopsis singkat berfokus pada apa yang diminta user",
    "total_duration": "Estimasi durasi"
  },
  "clips": [
    {
      "id": 1,
      "title": "Judul adegan singkat",
      "scene_description": "Deskripsi visual adegan",
      "timestamp_start": "00:01:00",
      "timestamp_end": "00:02:00",
      "duration_seconds": ${duration},
      "hype_level": 5,
      "reason": "Alasan adegan ini menarik",
      "teks_statis_capcut": {
        "judul_atas": "JUDUL ATAS LAYAR (Maks 4 kata kapital)",
        "opsi_hook_bawah": [
          "Opsi 1 hook teks bawah (Maks 6 kata, penasaran)",
          "Opsi 2 hook teks bawah (Maks 6 kata, provokatif)",
          "Opsi 3 hook teks bawah (Maks 6 kata, pertanyaan)"
        ]
      },
      "vo_script": "Skrip VO gaya bahasa Indonesia kasual (nggak, kayak, gila banget).",
      "hashtags": ["#tag1", "#tag2", "#tag3"]
    }
  ]
}`;
}

async function callClaudeAPI(prompt) {
  // --- GANTI TEKS DI BAWAH INI DENGAN API KEY OPENROUTER ANDA ---
  const OPENROUTER_API_KEY = 'PASTE_API_KEY_OPENROUTER_ANDA_DISINI'; 
  const BASE_URL = '[https://openrouter.ai/api/v1](https://openrouter.ai/api/v1)';

  const response = await fetch(BASE_URL + '/chat/completions', {
    method  : 'POST',
    headers : {
      'Content-Type'  : 'application/json',
      'Authorization' : 'Bearer ' + OPENROUTER_API_KEY,
      'HTTP-Referer'  : '[https://clipper-ah.vercel.app](https://clipper-ah.vercel.app)', 
      'X-Title'       : 'CineClip AI' 
    },
    body : JSON.stringify({
      // MENGGUNAKAN CLAUDE 3.5 SONNET: Sangat anti-halusinasi dan cerdas
      model      : 'anthropic/claude-3.5-sonnet', 
      messages   : [{ role: 'user', content: prompt }]
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error('API Error: ' + (err.error?.message || response.status));
  }

  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  } else {
    throw new Error('Respons dari AI kosong.');
  }
}

function parseResponse(raw) {
  // Perbaikan format replace agar aman saat di-copy paste
  let clean = raw.replace(/```json/g, '');
  clean = clean.replace(/```/g, '');
  clean = clean.trim();
  
  try { return JSON.parse(clean); } 
  catch (_) {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Format JSON dari AI tidak valid. Ulangi kembali.');
  }
}

function renderResults(data, lang, duration) {
  const { movie, clips } = data;
  const metaEl = document.getElementById('movieMeta');
  metaEl.innerHTML = `
    <div class="movie-poster">🎬</div>
    <div class="movie-info">
      <div style="background: rgba(142, 68, 173, 0.15); color: #9b59b6; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; margin-bottom: 10px; border: 1px solid #9b59b6; display: inline-block;">🧠 POWERED BY: CLAUDE 3.5 SONNET</div>
      <h2 style="margin-top:0;">${movie.title} (${movie.year || ''})</h2>
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
            <h4>Timestamp (Estimasi)</h4>
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
        
        <div class="info-block" style="margin-top:14px; background: rgba(255, 69, 0, 0.08); border-left: 3px solid var(--primary); padding: 14px;">
          <h4 style="color: var(--primary); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            📱 Teks Statis CapCut (Awal s/d Akhir)
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
          <h4 class="section-label" style="margin:0 0 8px">🎙 Skrip Voice Over</h4>
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

function toggleClip(i) {
  document.getElementById('clipCard' + i).classList.toggle('open');
}

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

📱 TEKS STATIS CAPCUT:
Teks Atas (Judul) : "${ts.judul_atas}"
Teks Bawah (Hook) :
${hookText}

🎙 SKRIP VOICE OVER:
${clip.vo_script}

HASHTAG: ${(clip.hashtags || []).join(' ')}
`;
  navigator.clipboard.writeText(txt).then(() => alert('✓ Semua info klip berhasil dicopy!')).catch(() => alert(txt));
}

function showExport(i) {
  const clip = currentClips[i];
  const name = (clip.title || 'scene').replace(/\s+/g, '_');
  document.getElementById('modalContent').innerHTML = `
    <p style="color:var(--dim);font-size:.8rem;line-height:1.7;margin-bottom:12px">Panduan command ffmpeg untuk potong video:</p>
    <div class="ffmpeg-block">ffmpeg -i "nama_film.mp4" -ss ${clip.timestamp_start} -to ${clip.timestamp_end} -c:v libx264 -c:a aac -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" "klip_${clip.id}_${name}.mp4"</div>
  `;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

function copyFFmpeg(i) {
  const clip = currentClips[i];
  const name = (clip.title || 'scene').replace(/\s+/g, '_');
  const cmd  = `ffmpeg -i "nama_film.mp4" -ss ${clip.timestamp_start} -to ${clip.timestamp_end} -c:v libx264 -c:a aac -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" "klip_${clip.id}_${name}.mp4"`;
  navigator.clipboard.writeText(cmd).then(() => alert('✓ Command ffmpeg berhasil dicopy!')).catch(() => alert(cmd));
}

function exportAll() {
  if (!currentClips.length) return;
  let out = `=== CINECLIP AI EXPORT ===\n\n`;
  currentClips.forEach(clip => {
    out += `--- KLIP ${clip.id}: ${clip.title} ---\nSkrip VO: ${clip.vo_script}\n\n`;
  });
  const blob = new Blob([out], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `cineclip_export.txt`;
  a.click();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function setProgress(pct) { document.getElementById('progressBar').style.width = pct + '%'; }
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

function showError(msg) {
  const el = document.getElementById('errorBox');
  el.textContent = '⚠ ' + msg;
  el.classList.add('active');
}
function hideError() { document.getElementById('errorBox').classList.remove('active'); }

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('movieInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') startAnalysis();
  });
});
