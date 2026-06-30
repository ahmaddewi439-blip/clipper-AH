module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, clips, format, isShort } = req.body;
  
  // Generate embed URL untuk semua klip
  const videoId = extractYouTubeId(url);
  const firstClip = clips[0];
  const lastClip = clips[clips.length - 1];
  
  // Buat playlist URL (YouTube tidak support playlist embed, jadi kita return first clip)
  const videoUrl = `https://www.youtube.com/embed/${videoId}?start=${firstClip.startSec}&end=${lastClip.endSec}&autoplay=0&rel=0`;

  res.json({
    success: true,
    videoUrl: videoUrl,
    filename: `Klip_${Date.now()}.mp4`,
    message: "Render selesai! (Embed mode)"
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
