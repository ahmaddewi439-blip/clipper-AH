/* ============================================================
   CineClip AI — script.js (VERSI FIX MULTI-CLIP & IMPROVISASI)
   ============================================================ */

'use strict';

let currentClips    = [];
let currentMovieInfo = {};

const LANG_LABELS = {
  Indonesia : 'Indonesia',
  English   : 'English'
};

async function startAnalysis() {
  const title = document.getElementById('movieTitle')?.value.trim();
  const synopsis = document.getElementById('movieSynopsis')?.value.trim();
  
  if (!title || !synopsis) { 
    showError('Mohon isi Judul Film dan Sinopsisnya terlebih dahulu.'); 
    return; 
  }

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

    const prompt = buildPrompt(title, synopsis, voLang, voTone, clipCount, clipDuration);
    const raw    = await callKoboiAPI(prompt);

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

function buildPrompt(title, synopsis, lang, tone, count, duration) {
  // === RUMUS PEMBAGIAN DURASI & KATA OTOMATIS ===
  const durasiPerKlip = Math.floor(duration / count); 
  const targetWordsPerKlip = Math.floor(durasiPerKlip * 2.16); 
  
  return `Anda adalah 'CineClip AI', Sutradara Short Video Profesional yang dapat menganalisa Film secara Profesional yang sangat tepat sesuai adegan di film.

JUDUL FILM: "${title}"
SINOPSIS DARI USER: "${synopsis}"

TUGAS UTAMA: 
Pecah cerita di atas menjadi TEPAT ${count} adegan/klip. Total durasi video adalah ${duration} detik dan menganalisa Film secara Profesional untuk menghasilkan voice over yang sesuai dengan adegan di moview.

ATURAN KETAT PEMILIHAN ADEGAN (VISUAL LOCK):
1. ANTI-AWALAN MEMBOSANKAN: JANGAN ambil adegan pengenalan di awal film (menit 0-5).
2. KUNCI ADEGAN PUNCAK: Langsung lompat dan temukan adegan paling SERU (menegangkan, komedi brutal, horor, plot twist gila) berdasarkan sinopsis.
3. JUMLAH KLIP: Anda WAJIB menghasilkan TEPAT ${count} klip. Tidak boleh kurang!

ATURAN KETAT SCRIPT VOICE OVER (PRESISI DURASI):
1. Durasi SETIAP KLIP/ADEGAN adalah TEPAT ${durasiPerKlip} detik.
2. Naskah Voice Over (VO) (Tone: ${tone}) dalam bahasa ${lang} untuk SETIAP KLIP dibatasi MAX ${targetWordsPerKlip} KATA! 
3. JANGAN LEBIH DARI ${targetWordsPerKlip} KATA per klip agar saat digabungkan audionya pas dan tidak terpotong.

Output HARUS format JSON (HANYA JSON):
{
  "movie": {
    "title": "Judul film",
    "description": "Sinopsis singkat",
    "total_duration": "${duration} detik"
  },
  "clips": [
    // PERHATIAN AI: ANDA WAJIB MEMBUAT TEPAT ${count} OBJECT DI DALAM ARRAY INI! JANGAN HANYA 1!
    {
      "id": 1,
      "title": "Judul adegan",
      "scene_description": "Deskripsi visual adegan puncak",
      "timestamp_start": "00:25:00",
      "timestamp_end": "00:25:${durasiPerKlip}",
      "duration_seconds": ${durasiPerKlip},
      "hype_level": 5,
      "reason": "Alasan adegan seru",
      "teks_statis_capcut": {
        "judul_atas": "JUDUL ATAS",
        "opsi_hook_bawah": ["Hook 1", "Hook 2", "Hook 3"]
      },
      "vo_script": "Kata pertama wajib Hook. Panjang naskah ini WAJIB TEPAT sekitar ${targetWordsPerKlip} kata. Jangan kepanjangan!",
      "hashtags": ["#tag1"]
    }
    // AI WAJIB MELANJUTKAN MEMBUAT OBJECT UNTUK ID 2, ID 3, SAMPAI ID ${count} DI SINI!!!
  ]
}`;
}
async function callKoboiAPI(prompt) {
  // --- MASUKKAN KODE API KOBOI ANDA DI BAWAH INI ---
  const KOBOI_API_KEY = 'sk-S1w-OnAhdjtzMyYVMlYvGw';   
  const BASE_URL = 'https://lite.koboillm.com'; 

  const response = await fetch(BASE_URL + '/v1/chat/completions', {
    method  : 'POST',
    headers : {
      'Content-Type'  : 'application/json',
      'Authorization' : 'Bearer ' + KOBOI_API_KEY
    },
    body : JSON.stringify({
      model      : 'openai/gpt-4o', 
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
  let clean = raw.replace(new RegExp('\`{3}json', 'g'), '').replace(new RegExp('\`{3}', 'g'), '').trim();
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
      <div style="background: rgba(46, 204, 113, 0.15); color: #2ecc71; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; margin-bottom: 10px; border: 1px solid #2ecc71; display: inline-block;">🧠 POWERED BY: KOBOI API (GPT-4o)</div>
      <h2 style="margin-top:0;">${movie.title} (${movie.year || ''})</h2>
      <p>${movie.description || ''}</p>
    </div>
  `;

  const grid = document.getElementById('clipsGrid');
  grid.innerHTML = clips.map((clip, i) => {
    const flames = '🔥'.repeat(Math.min(clip.hype_level || 3, 5));
    const ts = clip.teks_statis_capcut || { judul_atas: clip.title, opsi_hook_bawah: ["Hook 1", "Hook 2", "Hook 3"] };

    return `
    <div class="clip-card" id="clipCard${i}">
      <div class="clip-header" onclick="toggleClip(${i})">
        <div class="clip-num">0${clip.id || i+1}</div>
        <div class="clip-meta">
          <div class="clip-title">${clip.title}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div class="clip-duration-badge">${clip.timestamp_start} → ${clip.timestamp_end}</div>
          <div class="clip-hype">${flames}</div>
        </div>
        <div class="chevron">▼</div>
      </div>
      <div class="clip-body">
        <div class="info-block" style="margin-top:12px">
          <h4>Deskripsi Adegan</h4>
          <div class="scene-desc">${clip.scene_description || '-'}</div>
        </div>
        
        <div class="info-block" style="margin-top:14px; background: rgba(255, 69, 0, 0.08); border-left: 3px solid var(--primary); padding: 14px;">
          <h4 style="color: var(--primary); margin-bottom: 10px;">📱 Teks Statis CapCut</h4>
          <div style="font-family: monospace; font-size: 0.95rem; line-height: 1.6;">
            <div style="color: #fff; margin-bottom: 6px;">
              <strong>[TEKS ATAS]:</strong> <span style="color:var(--gold);">${ts.judul_atas}</span>
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
          <h4 class="section-label" style="margin:0 0 8px">🎙 Skrip Voice Over (Target: ~${Math.floor(duration * 2.2)} kata)</h4>
          <div class="vo-script-box" id="voBox${i}">
            <button class="vo-copy-btn" id="copyBtn${i}" onclick="copyVO(${i})">COPY</button>
            <div class="vo-text">${clip.vo_script || '-'}</div>
          </div>
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
      setTimeout(() => { btn.textContent = 'COPY'; }, 2000);
    }
  });
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
  document.getElementById('movieTitle').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('movieSynopsis').focus();
    }
  });
});
