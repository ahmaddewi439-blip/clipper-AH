module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId, clipIndex } = req.query;
  
  // Redirect ke YouTube (karena tidak bisa generate MP4 di Vercel)
  res.status(200).json({
    success: true,
    message: 'Download not available in Vercel. Use YouTube Premium or external tool.'
  });
};
