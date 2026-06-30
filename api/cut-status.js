module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId } = req.query;
  
  // Karena Vercel tidak bisa persist state, kita return completed langsung
  // (Frontend sudah dapat data dari start-cut)
  res.json({
    success: true,
    data: {
      status: 'completed',
      progress: 100,
      completed: 0,
      total: 0,
      clips: []
    }
  });
};
