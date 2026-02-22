import fetch from 'node-fetch';
import { parseString } from 'xml2js';

export default async function handler(req, res) {
  const { source } = req.query;
  
  const NIGERIAN_FEEDS = {
    vanguard: 'https://www.vanguardngr.com/feed/',
    punch: 'https://punchng.com/feed/',
    guardian_nigeria: 'https://guardian.ng/feed/',
    premium_times: 'https://www.premiumtimesng.com/feed',
    channelstv: 'https://www.channelstv.com/feed/',
    nigerian_tribune: 'https://tribuneonlineng.com/feed/'
  };

  const SPORTS_SOURCES = {
    espn: 'https://www.espn.com/espn/rss/news',
    bbc_sport: 'http://feeds.bbci.co.uk/sport/rss.xml',
    sky_sports: 'https://www.skysports.com/rss/12040',
    nigerian_sports: 'https://www.completesports.com/feed/',
    soccer_news: 'https://www.goal.com/feeds/en/news'
  };

  try {
    const feedUrl = NIGERIAN_FEEDS[source] || SPORTS_SOURCES[source];
    if (!feedUrl) {
      return res.status(400).json({ error: 'Invalid source' });
    }

    const response = await fetch(feedUrl);
    const xml = await response.text();
    
    const articles = await parseRSS(xml, source);
    
    res.status(200).json(articles);
  } catch (error) {
    console.error('Error fetching RSS:', error);
    res.status(500).json({ error: 'Failed to fetch RSS feed' });
  }
}

async function parseRSS(xml, source) {
  return new Promise((resolve, reject) => {
    parseString(xml, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      const items = result.rss?.channel[0]?.item || [];
      const articles = items.map(item => ({
        title: item.title[0],
        description: item.description[0],
        content: item['content:encoded']?.[0] || item.description[0],
        url: item.link[0],
        imageUrl: extractImage(item),
        source: source,
        publishedAt: item.pubDate[0],
        author: item['dc:creator']?.[0] || 'Unknown'
      }));

      resolve(articles);
    });
  });
}

function extractImage(item) {
  // Try to extract image from media:content
  if (item['media:content'] && item['media:content'][0].$.url) {
    return item['media:content'][0].$.url;
  }
  
  // Try to extract from description
  const description = item.description[0];
  const imgRegex = /<img[^>]+src="([^">]+)"/;
  const match = description.match(imgRegex);
  if (match) {
    return match[1];
  }
  
  // Default image
  return 'https://via.placeholder.com/300x200?text=News';
}