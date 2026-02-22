// api/proxy.js - This runs on Railway as a serverless function
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    const response = await fetch(url);
    const data = await response.text();
    
    // Set appropriate content type
    if (url.includes('format=Atom')) {
      res.setHeader('Content-Type', 'application/atom+xml');
    } else if (url.includes('format=Json')) {
      res.setHeader('Content-Type', 'application/json');
    }
    
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}