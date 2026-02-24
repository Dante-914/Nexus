import { 
  normalizeArticles, 
  mergeAndDeduplicateArticles,
  extractTrendingTopics,
  calculateQualityScore,
  formatArticleForView,
  validateArticle,
  SOURCES
} from '../services/dataNormalizer';

// Test data
const mockGuardianResponse = {
  response: {
    results: [
      {
        id: "world/2024/mar/13/test-article",
        webTitle: "Test Guardian Article",
        webUrl: "https://theguardian.com/test",
        webPublicationDate: "2024-03-13T10:00:00Z",
        sectionName: "World News",
        fields: {
          trailText: "This is a test article from The Guardian",
          thumbnail: "https://example.com/image.jpg",
          headline: "Test Headline"
        },
        tags: [
          {
            type: "contributor",
            webTitle: "John Doe"
          }
        ]
      }
    ]
  }
};

const mockNewsAPIResponse = {
  articles: [
    {
      title: "Test NewsAPI Article",
      description: "This is a test article from NewsAPI",
      content: "Full content here...",
      url: "https://newsapi.org/test",
      urlToImage: "https://example.com/image2.jpg",
      publishedAt: "2024-03-13T11:00:00Z",
      source: {
        name: "Test Source"
      },
      author: "Jane Smith"
    }
  ]
};

// Test normalization
export function testNormalization() {
  console.log('=== Testing Data Normalization ===\n');
  
  // Test Guardian normalization
  console.log('1. Normalizing Guardian articles:');
  const guardianNormalized = normalizeArticles(
    mockGuardianResponse.response.results, 
    'guardian'
  );
  console.log('Guardian normalized:', guardianNormalized[0]);
  console.log('Valid:', validateArticle(guardianNormalized[0]));
  console.log('Quality score:', calculateQualityScore(guardianNormalized[0]));
  console.log();
  
  // Test NewsAPI normalization
  console.log('2. Normalizing NewsAPI articles:');
  const newsAPINormalized = normalizeArticles(
    mockNewsAPIResponse.articles, 
    'newsapi'
  );
  console.log('NewsAPI normalized:', newsAPINormalized[0]);
  console.log('Valid:', validateArticle(newsAPINormalized[0]));
  console.log('Quality score:', calculateQualityScore(newsAPINormalized[0]));
  console.log();
  
  // Test merging
  console.log('3. Merging articles:');
  const merged = mergeAndDeduplicateArticles([
    guardianNormalized,
    newsAPINormalized
  ]);
  console.log(`Merged ${merged.length} articles`);
  console.log();
  
  // Test trending topics
  console.log('4. Extracting trending topics:');
  const topics = extractTrendingTopics(merged);
  console.log('Trending topics:', topics);
  console.log();
  
  // Test formatting
  console.log('5. Formatting for different views:');
  const cardView = formatArticleForView(merged[0], 'card');
  console.log('Card view:', cardView);
  
  return {
    guardian: guardianNormalized[0],
    newsapi: newsAPINormalized[0],
    merged
  };
}

// Run test if called directly
if (import.meta.env.MODE === 'development') {
  console.log('Running normalization tests...');
  testNormalization();
}