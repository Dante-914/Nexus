// API Configuration
export const API_KEYS = {
  newsapi: import.meta.env.VITE_NEWSAPI_KEY || '0584cfd3fbd04aaeb4b5589a2eb92599',
  guardian: import.meta.env.VITE_GUARDIAN_KEY || 'f3f7f5ef-450f-4324-82db-41f0ba1ee45b',
  
};

export const API_ENDPOINTS = {
  newsapi: 'https://newsapi.org/v2',
  guardian: 'https://content.guardianapis.com',
  gdelt: 'https://api.gdeltproject.org/api/v2'
};