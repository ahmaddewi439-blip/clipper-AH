// ============================================
// API GET EMBED URL - Vercel Serverless
// ============================================

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

function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  return parts[0]*60 + parts[1];
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, start, end } = req.body;
  
  let videoId = extractYouTubeId(url);
  if (!videoId) return res.status(400).json({ success: false, error: 'URL tidak valid' });
  
  const startSec = parseTimeToSeconds(start);
  const endSec = parseTimeToSeconds(end);
  
  // Embed URL dengan start & end
  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${startSec}&end=${endSec}&autoplay=0&rel=0&modestbranding=1`;
  
  // URL untuk preview thumbnail
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  
  res.json({
    success: true,
    embedUrl,
    thumbnailUrl,
    videoId,
    startSec,
    endSec
  });
};
