// ============================================
// API ENHANCE NARRATION - Vercel Serverless
// ============================================
const axios = require('axios');

const KOBOI_API_KEY = process.env.KOBOI_API_KEY || 'sk-S1w-OnAhdjtzMyYVMlYvGw';
const KOBOI_BASE_URL = process.env.KOBOI_BASE_URL || 'https://lite.koboillm.com/v1';

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, title, genre, lang, durationSec } = req.body;

  if (!text) return res.status(400).json({ success: false, error: "Text required" });

  try {
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
      wordCount: enhancedText.split(/\s+/).length
    });

  } catch (err) {
    console.error('[ENHANCE] ERROR:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
