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

    // Potong teks agar tidak terlalu panjang untuk AI (maks 15.000 karakter)
    const limitedText = srtText.substring(0, 15000);

    // Kirim kembali teks subtitle ke frontend (script.js)
    res.status(200).json({ subtitleData: limitedText });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
