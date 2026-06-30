// File: api/subtitle.js
export default async function handler(req, res) {
  // Hanya menerima metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title } = req.body;
  const apiKey = process.env.OPENSUBTITLES_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API Key OpenSubtitles tidak ditemukan di Vercel.' });
  }

  try {
    // 1. Cari ID Subtitle berdasarkan Judul Film
    const searchRes = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(title)}&languages=en,id`, {
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'ClipperAH v1.0'
      }
    });
    
    const searchData = await searchRes.json();
    if (!searchData.data || searchData.data.length === 0) {
      throw new Error('Subtitle untuk film ini tidak ditemukan di database.');
    }
    
    // Ambil ID file pertama yang ditemukan
    const fileId = searchData.data[0].attributes.files[0].file_id;

    // 2. Minta Link Download Subtitle
    const dlRes = await fetch('https://api.opensubtitles.com/api/v1/download', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'ClipperAH v1.0'
      },
      body: JSON.stringify({ file_id: fileId })
    });
    
    const dlData = await dlRes.json();
    if (!dlData.link) {
      throw new Error('Gagal mendapatkan akses unduh subtitle.');
    }

    // 3. Tarik Teks Subtitle (SRT)
    const srtRes = await fetch(dlData.link);
    const srtText = await srtRes.text();

    // BERSIIHKAN SUBTITLE AGAR 1 FILM FULL BISA MASUK AI
    // Hapus angka urutan, tag HTML, dan baris kosong
    const cleanSrt = srtText
      .replace(/^[0-9]+$/gm, '') 
      .replace(/<[^>]*>/g, '') 
      .replace(/^\s*[\r\n]/gm, '') 
      .trim();

    // Batas aman Vercel (sekitar 80.000 karakter, cukup untuk 1 film durasi 3 jam)
    const finalSrt = cleanSrt.substring(0, 80000);

    // Kirim kembali teks subtitle ke frontend
    res.status(200).json({ subtitleData: finalSrt });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
