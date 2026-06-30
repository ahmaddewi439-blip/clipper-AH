module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId, url, clips } = req.body;
  
  // Extract video ID
  const videoId = extractYouTubeId(url);
  
  // Generate embed URLs untuk setiap klip
  const embedClips = clips.map((clip, i) => ({
    index: i + 1,
    url: `https://www.youtube.com/embed/${videoId}?start=${clip.startSec}&end=${clip.endSec}&autoplay=0&rel=0&modestbranding=1`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    start: clip.start,
    end: clip.end,
    startSec: clip.startSec,
    endSec: clip.endSec,
    duration: clip.durationSec,
    status: 'ready'
  }));

  res.json({
    success: true,
    jobId,
    status: 'completed',
    progress: 100,
    completed: clips.length,
    total: clips.length,
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
