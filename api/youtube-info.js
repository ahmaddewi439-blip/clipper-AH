// ============================================
// API YOUTUBE INFO - Vercel Serverless
// ============================================

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

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

function formatDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '0:00';
  const h = parseInt(m[1]||0), min = parseInt(m[2]||0), s = parseInt(m[3]||0);
  if (h > 0) return `${h}:${min.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return `${min}:${s.toString().padStart(2,'0')}`;
}

function formatViews(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000) return (n/1000).toFixed(1)+'K';
  return n.toString();
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL kosong' });
  
  const videoId = extractYouTubeId(url);
  if (!videoId) return res.status(400).json({ success: false, error: 'URL tidak valid' });
  
  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ success: false, error: 'Video tidak ditemukan/private' });
    }
    
    const v = data.items[0], s = v.snippet, d = v.contentDetails, st = v.statistics;
    res.json({
      success: true,
      data: {
        id: videoId,
        title: s.title,
        thumbnail: s.thumbnails.high?.url || s.thumbnails.medium?.url,
        channelName: s.channelTitle,
        duration: formatDuration(d.duration),
        views: formatViews(parseInt(st.viewCount||0)),
        publishedAt: new Date(s.publishedAt).toLocaleDateString('id-ID')
      }
    });
  } catch (err) {
    console.error('[YOUTUBE API]', err);
    res.status(500).json({ success: false, error: 'Gagal ambil data YouTube' });
  }
};
