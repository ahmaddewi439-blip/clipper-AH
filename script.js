/* ============================================================
   CineClip AI — script.js (VERSI FIX: TWO-STEP GENERATION)
   ============================================================ */

'use strict';

let currentClips    = [];
let currentMovieInfo = {};
let recommendedScenes = []; // Menyimpan data rekomendasi sementara

const LANG_LABELS = {
  Indonesia : 'Indonesia',
  English   : 'English'
};

// ==========================================
// TAHAP 1: PENCARIAN REKOMENDASI ADEGAN
// ==========================================
async function findScenes() {
  const title = document.getElementById('movieTitle')?.value.trim();
  const synopsis = document.getElementById('movieSynopsis')?.value.trim();
  
  if (!title || !synopsis) { 
    showError('Mohon isi Judul Film dan Sinopsis Utuh terlebih dahulu untuk mencari adegan.'); 
    return; 
  }

  const btn = document.getElementById('findScenesBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '⏳ Sedang Membaca Sinopsis...';
  btn.disabled = true;
  hideError();

  try {
    const prompt = buildRecommendPrompt(title, synopsis);
    const raw = await callKoboiAPI(prompt);
    const parsed = parseResponse(raw);
    
    if (parsed.rekomendasi_adegan && parsed.rekomendasi_adegan.length > 0) {
      renderSceneCards(parsed.rekomendasi_adegan);
    } else {
      showError('Gagal menemukan rekomendasi adegan. Coba ubah sinopsis Anda.');
    }
  } catch (e) {
    showError('Terjadi kesalahan saat mencari adegan: ' + e.message);
    console.error(e);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function buildRecommendPrompt(title, fullSynopsis) {
  return `Anda adalah Asisten Analis Film.
JUDUL FILM: "${title}"
SINOPSIS UTUH: "${fullSynopsis}"

TUGAS:
Ekstrak 3 hingga 4 adegan paling epik, dramatis, atau penuh aksi dari sinopsis di atas yang sangat cocok dipotong menjadi konten video vertikal yang viral.
Jelaskan kejadiannya secara singkat dan padat (fokus pada Siapa, Ngapain, Di mana/Bagaimana).

Output wajib HANYA dalam format JSON:
{
  "rekomendasi_adegan": [
    {
      "judul_card": "Judul Singkat (Contoh: Pertarungan Akhir)",
      "deskripsi_adegan": "Deskripsi kejadian (Contoh: Karakter utama membalas dendam di atas gedung pencakar langit saat hujan deras.)"
    }
  ]
}`;
}

function renderSceneCards(scenes) {
  recommendedScenes = scenes;
  const container = document.getElementById('cardsContainer');
  const area = document.getElementById('recommendationArea');
  
  container.innerHTML = scenes.map((scene, i) => `
    <div class="scene-card" id="sceneCard_${i}" onclick="selectScene(${i})" style="padding: 12px; background: rgba(0,0,0,0.5); border: 2px solid #444; border-radius: 8px; cursor: pointer; transition: 0.2s;">
      <h4 style="margin: 0 0 5px 0; color: #fff;">🎬 ${scene.judul_card}</h4>
      <p style="margin: 0; font-size: 0.9rem; color: #aaa;">${scene.deskripsi_adegan}</p>
    </div>
  `).join('');
  
  area.style.display = 'block';
}

function selectScene(index) {
  const scene = recommendedScenes[index];
  
  // Masukkan teks ke dalam textarea
  const textarea = document.getElementById('movieSynopsis');
  textarea.value = scene.deskripsi_adegan;
  
  // Efek visual klik (Highlight card yang dipilih)
  document.querySelectorAll('.scene-card').forEach((el, i) => {
    if (i === index) {
      el.style.border = '2px solid #2ecc71';
      el.style.background = 'rgba(46, 204, 113, 0.1)';
    } else {
      el.style.border = '2px solid #444';
      el.style.background = 'rgba(0,0,0,0.5)';
    }
  });

  // Highlight tombol Generate utama agar user tahu langkah selanjutnya
  document.getElementById('analyzeBtn').style.boxShadow = '0 0 15px var(--accent)';
  setTimeout(() => {
    document.getElementById('analyzeBtn').style.boxShadow = 'none';
  }, 1500);
}


// ==========================================
// TAHAP 2: EKSEKUSI PEMBUATAN SKRIP VO
// ==========================================
async function startAnalysis() {
  const title = document.getElementById('movieTitle')?.value.trim();
  const sceneContext = document.getElementById('movieSynopsis')?.value.trim();
  
  if (!title || !sceneContext) { 
    showError('Mohon isi Judul Film dan pilih/isi Konteks Adegan terlebih dahulu.'); 
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

    const prompt = buildPrompt(title, sceneContext, voLang, voTone, clipCount, clipDuration);
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

function buildPrompt(title, sceneContext, lang, tone, count, duration) {
  // RUMUS SANGAT KETAT UNTUK DURASI & KATA
  const durasiPerKlip = Math.floor(duration / count); 
  const targetWordsPerKlip = Math.floor(durasiPerKlip * 2.5); 
  
  return `Anda adalah 'CineClip AI', spesialis narasi video vertikal.

JUDUL FILM: "${title}"
KONTEKS ADEGAN REKAMAN: "${sceneContext}"

SITUASI & TUGAS UTAMA: 
User baru saja merekam (screen-record) potongan adegan dari film berdasarkan konteks di atas.
Tugas Anda HANYA membuat naskah Voice Over (VO) yang FOKUS 100% mendeskripsikan kejadian pada "KONTEKS ADEGAN REKAMAN". 
JANGAN mengarang cerita lain atau membahas bagian awal/akhir film jika tidak ada di konteks.

ATURAN KETAT DURASI & KATA (HARGA MATI):
1. Video ini dibagi persis menjadi ${count} klip.
2. Durasi SETIAP KLIP adalah TEPAT ${durasiPerKlip} detik.
3. Skrip VO bahasa ${lang} (Tone: ${tone}) untuk SETIAP KLIP dibatasi MAKSIMAL ${targetWordsPerKlip} KATA. JANGAN LEBIH!

Output HARUS format JSON (HANYA JSON):
{
  "movie": {
    "title": "${title}",
    "description": "Fokus Adegan: ${sceneContext}",
    "total_duration": "${duration} detik"
  },
  "clips": [
    {
      "id": 1,
      "title": "Judul spesifik adegan ini",
      "scene_description": "Deskripsi visual berdasarkan konteks adegan",
      "timestamp_start": "00:00:00",
      "timestamp_end": "00:00:${durasiPerKlip < 10 ? '0'+durasiPerKlip : durasiPerKlip}",
      "duration_seconds": ${durasiPerKlip},
      "hype_level": 5,
      "reason": "Alasan skrip ini pas dengan durasi",
      "teks_statis_capcut": {
        "judul_atas": "JUDUL ATAS",
        "opsi_hook_bawah": ["Hook 1", "Hook 2", "Hook 3"]
      },
      "vo_script": "Tulis narasi di sini. WAJIB MAKSIMAL ${targetWordsPerKlip} KATA. Langsung to the point."
    }
  ]
}`;
}

// ==========================================
// KONEKSI API & UTILITAS UMUM
// ==========================================
async function callKoboiAPI(prompt) {
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
          <h4 class="section-label" style="margin:0 0 8px">🎙 Skrip Voice Over (Maksimal: ~${Math.floor((duration / clips.length) * 2.5)} kata)</h4>
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
