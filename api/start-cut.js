module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId, url, clips } = req.body;
  
  // Simpan job di memory (Vercel: hanya persist 1 request)
  // Solusi: Gunakan Cloudinary atau return langsung embed URL
  
  // Karena Vercel tidak bisa background process, kita return langsung
  const embedClips = clips.map((clip, i) => {
    const videoId = extractYouTubeId(url);
    return {
      index: i + 1,
      url: `https://www.youtube.com/embed/${videoId}?start=${clip.startSec}&end=${clip.endSec}&autoplay=0&rel=0`,
      start: clip.start,
      end: clip.end,
      duration: clip.durationSec
    };
  });

  res.json({
    success: true,
    jobId,
    status: 'completed',
    clips: embedClips
  });
};

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) { 
    const m = url.match(p); 
    if (m) return m[1]; 
  }
  return null;
}
