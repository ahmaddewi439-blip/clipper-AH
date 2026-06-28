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

// Tambahkan fungsi baru ini untuk memanggil backend Vercel Anda
async function fetchSubtitleFromVercel(title) {
  const response = await fetch('/api/subtitle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal menarik data subtitle.');
  }

  const data = await response.json();
  return data.subtitleData;
}

// PERBARUI FUNGSI startAnalysis
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
    await activateStep('step1', 800); setProgress(15);
    
    // TAHAP BARU: Menarik Subtitle
    const subtitleText = await fetchSubtitleFromVercel(title);
    
    await activateStep('step2', 800); setProgress(40);
    await activateStep('step3',  800); setProgress(58);
    await activateStep('step4',  600); setProgress(78);

    // Masukkan teks subtitle ke dalam prompt
    const prompt = buildPrompt(title, synopsis, voLang, voTone, clipCount, clipDuration, subtitleText);
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
    saveResultsToStorage(parsed, clipDuration);
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

// PERBARUI FUNGSI buildPrompt
function buildPrompt(title, synopsis, lang, tone, count, duration, subtitleData) {
  const durasiPerKlip = Math.floor(duration / count); 
  const targetWordsPerKlip = Math.floor(durasiPerKlip * 2.5); 
  
  return `Anda adalah 'CineClip AI', Sutradara Short Video Profesional.

JUDUL FILM: "${title}"
SINOPSIS: "${synopsis}"

DATA SUBTITLE ASLI (GUNAKAN INI UNTUK TIMESTAMP YANG AKURAT):
---
${subtitleData}
---

TUGAS UTAMA: 
Analisis naskah subtitle di atas. Ekstrak TEPAT ${count} adegan PALING SERU (berdasarkan teks dialog/kejadian di subtitle).

ATURAN KETAT (HARGA MATI):
1. Anda WAJIB memberikan "timestamp_adegan" (contoh: 00:15:30 -> 00:15:40) yang BENAR-BENAR ADA di dalam data subtitle yang saya berikan. JANGAN MENGARANG TIMESTAMP!
2. Naskah Voice Over (Tone: ${tone}, Bahasa: ${lang}) untuk SETIAP KLIP dibatasi MAKSIMAL ${targetWordsPerKlip} KATA. JANGAN LEBIH!
3. Anda WAJIB membuat tepat ${count} klip di dalam array JSON.

Output HARUS format JSON (HANYA JSON):
{
  "movie": {
    "title": "${title}",
    "description": "Analisis adegan puncak berdasarkan subtitle selesai."
  },
  "clips": [
    {
      "id": 1,
      "title": "Judul Adegan",
      "timestamp_adegan": "00:00:00 -> 00:00:00 (WAJIB SESUAI SUBTITLE)",
      "scene_description": "Deskripsi adegan berdasarkan dialog di detik tersebut",
      "hype_level": 5,
      "teks_statis_capcut": {
        "judul_atas": "JUDUL ATAS",
        "opsi_hook_bawah": ["Hook 1", "Hook 2", "Hook 3"]
      },
      "vo_script": "Teks narasi di sini. WAJIB MAKSIMAL ${targetWordsPerKlip} KATA."
    }
  ]
}`;
}

function buildPrompt(title, synopsis, lang, tone, count, duration, subtitleData) {
  const durasiPerKlip = Math.floor(duration / count);
  const targetWordsPerKlip = Math.floor(durasiPerKlip * 2.5);
  // Toleransi sangat ketat: Maksimal meleset 2 kata
  const minWords = targetWordsPerKlip - 2;
  const maxWords = targetWordsPerKlip + 2;

  return `Anda adalah 'CineClip AI', Sutradara Short Video Profesional.

JUDUL FILM: "${title}"
SINOPSIS: "${synopsis}"

DATA SUBTITLE 1 FILM PENUH:
---
${subtitleData || 'TIDAK ADA DATA SUBTITLE'}
---

TUGAS UTAMA:
Pilih TEPAT ${count} adegan PALING "TER-" (paling mendebarkan, paling lucu, paling sedih, plot twist, atau horor) dari subtitle di atas. 
PENTING: Adegan harus TERSEBAR MERATA dari babak AWAL, TENGAH (konflik), hingga AKHIR (klimaks) film. JANGAN hanya menumpuk di 20 menit pertama!

ATURAN KETAT (HARGA MATI):
1. WAJIB BERIKAN "timestamp_adegan" (contoh: 01:15:30 -> 01:15:40) yang BENAR-BENAR ADA di data subtitle.
2. Naskah Voice Over (Tone: ${tone}, Bahasa: ${lang}) untuk SETIAP KLIP WAJIB berisi antara ${minWords} sampai ${maxWords} kata. TIDAK BOLEH KURANG, TIDAK BOLEH LEBIH! Ini agar sesuai dengan durasi klip ${durasiPerKlip} detik.
3. Anda WAJIB membuat tepat ${count} klip di dalam array JSON.

Output HARUS format JSON (HANYA JSON):
{
  "movie": {
    "title": "${title}",
    "description": "Analisis adegan puncak tersebar selesai."
  },
  "clips": [
    {
      "id": 1,
      "title": "Judul Adegan",
      "timestamp_adegan": "00:00:00 -> 00:00:00",
      "scene_description": "Deskripsi visual adegan puncak ini",
      "hype_level": 5,
      "teks_statis_capcut": {
        "judul_atas": "JUDUL ATAS",
        "opsi_hook_bawah": ["Hook 1", "Hook 2", "Hook 3"]
      },
      "vo_script": "Teks narasi di sini. WAJIB berjumlah antara ${minWords} hingga ${maxWords} kata. Hitung dengan teliti!"
    }
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

    // --- PASTE 1 BARIS INI TEPAT DI BAWAHNYA ---
    localStorage.setItem('kuliClipper_hasil', JSON.stringify({ data, lang, duration }));

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
  const durasiPerKlip = Math.floor(duration / clips.length); // Hitung ulang durasi per klip
  
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
          <div class="clip-duration-badge">Target Durasi: ${durasiPerKlip} Detik</div>
          <div class="clip-hype">${flames}</div>
        </div>
        <div class="chevron">▼</div>
      </div>
      <div class="clip-body">
       <div class="info-block" style="margin-top:12px">
  <h4>🎥 Petunjuk Cari Adegan di LK21:</h4>
  <div style="font-weight:bold; color: #ffeb3b; background: rgba(255, 235, 59, 0.15); padding: 8px; border-radius: 4px; margin-bottom: 8px; border: 1px solid #ffeb3b;">
    ⏳ WAKTU: ${clip.timestamp_adegan || 'Tidak ada data waktu'}
  </div>
  <button onclick="kirimKeBot('${clip.timestamp_adegan}')" style="margin-top: 10px; background: #2ecc71; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-weight: bold; width: 100%; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
   ⚡ Eksekusi Potong di PC
</button>
  <div class="scene-desc" style="font-weight:bold; color:var(--accent2);">${clip.scene_description || '-'}</div>
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
          <h4 class="section-label" style="margin:0 0 8px">🎙 Skrip VO (Pas untuk ~${durasiPerKlip} Detik)</h4>
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

// ==========================================
// FITUR MEMORI (LOCAL STORAGE)
// ==========================================

// 1. Simpan input teks setiap kali diketik
function saveInputsToStorage() {
  const inputs = {
    title: document.getElementById('movieTitle')?.value || '',
    synopsis: document.getElementById('movieSynopsis')?.value || '',
    lang: document.getElementById('voLang')?.value || 'Indonesia',
    tone: document.getElementById('voTone')?.value || 'Dramatis',
    count: document.getElementById('clipCount')?.value || '7',
    duration: document.getElementById('clipDuration')?.value || '60'
  };
  localStorage.setItem('clipperInputs', JSON.stringify(inputs));
}

// 2. Simpan hasil akhir (klip & skrip VO) ke memori
function saveResultsToStorage(parsedData, duration) {
  const results = { data: parsedData, duration: duration };
  localStorage.setItem('clipperResults', JSON.stringify(results));
}

// 3. Panggil ulang semua data saat web dibuka kembali
function loadStateFromStorage() {
  // Panggil Input
  const savedInputs = localStorage.getItem('clipperInputs');
  if (savedInputs) {
    const inputs = JSON.parse(savedInputs);
    if (document.getElementById('movieTitle')) document.getElementById('movieTitle').value = inputs.title;
    if (document.getElementById('movieSynopsis')) document.getElementById('movieSynopsis').value = inputs.synopsis;
    if (document.getElementById('voLang')) document.getElementById('voLang').value = inputs.lang;
    if (document.getElementById('voTone')) document.getElementById('voTone').value = inputs.tone;
    if (document.getElementById('clipCount')) document.getElementById('clipCount').value = inputs.count;
    if (document.getElementById('clipDuration')) document.getElementById('clipDuration').value = inputs.duration;
  }

  // Panggil Hasil Analisis AI
  const savedResults = localStorage.getItem('clipperResults');
  if (savedResults) {
    const results = JSON.parse(savedResults);
    currentClips = results.data.clips;
    currentMovieInfo = results.data.movie;
    
    // Tampilkan ulang ke layar
    renderResults(results.data, document.getElementById('voLang')?.value || 'Indonesia', results.duration);
    document.getElementById('progressArea').classList.remove('active');
    document.getElementById('resultsArea').classList.add('active');
  }
}

// 4. Pasang pendeteksi otomatis di setiap kolom input
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromStorage(); // Jalankan saat web pertama kali dimuat

  const hasilLama = localStorage.getItem('kuliClipper_hasil');
    if (hasilLama) {
        try {
            const { data, lang, duration } = JSON.parse(hasilLama);
            // Panggil kembali tampilan tanpa perlu render ulang ke AI
            renderResults(data, lang, duration); 
        } catch (e) {
            console.log("Tidak ada data lama");
        }
    }

  // Simpan tiap ada perubahan
  const inputsToTrack = ['movieTitle', 'movieSynopsis', 'voLang', 'voTone', 'clipCount', 'clipDuration'];
  inputsToTrack.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', saveInputsToStorage);
      el.addEventListener('change', saveInputsToStorage);
    }
  });
 
});

// --- PASTE MULAI DI SINI (BARIS 428) ---
async function kirimKeBot(waktu) {
    // Kalau waktunya kosong, tolak
    if (!waktu || waktu === 'Tidak ada data waktu' || waktu === 'undefined') {
        alert("❌ Waktu adegan tidak valid!");
        return;
    }

    // 1. Munculkan pop-up minta link video
    const url = prompt(`⚡ KIRIM KE BOT PC ⚡\nAdegan: ${waktu}\n\nMasukkan URL/Link video mentahnya di bawah ini:`);
    
    // Kalau dibatalkan atau kosong, hentikan
    if (!url) return; 

    // 2. Data Bot Anda
    const BOT_TOKEN = '8633807429:AAGX694OcjcQ7s6xBL6FKXnKTRBNDM_vM_U'; 
    const MY_ID = '8196598586';
    
    // 3. Rakit pesan untuk bot PC
    const pesan = `/potong ${url} ${waktu}`;
    
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: MY_ID, text: pesan })
        });
        alert("🚀 BINGO! Perintah meluncur ke PC Anda. Silakan buka Telegram di HP sekarang.");
    } catch (e) {
        alert("❌ Gagal mengirim, cek koneksi internet Anda.");
    }
}
