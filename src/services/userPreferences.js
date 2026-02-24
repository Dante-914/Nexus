import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';

// Save article to bookmarks
export const saveArticle = async (userId, article) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Check if already saved
    const q = query(
      collection(db, 'savedArticles'),
      where('userId', '==', userId),
      where('url', '==', article.url)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      // Article already saved, return the existing ID
      return { exists: true, id: snapshot.docs[0].id };
    }

    // Prepare article data for saving
    const articleData = {
      userId,
      url: article.url,
      title: article.title || 'Untitled',
      description: article.description || article.content || '',
      imageUrl: article.imageUrl || article.urlToImage || '',
      source: article.source || 'Unknown',
      publishedAt: article.publishedAt || new Date().toISOString(),
      savedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'savedArticles'), articleData);
    console.log('Article saved with ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error saving article:', error);
    throw error;
  }
};

// Remove article from bookmarks
export const removeSavedArticle = async (articleId) => {
  if (!articleId) {
    throw new Error('Article ID is required');
  }

  try {
    await deleteDoc(doc(db, 'savedArticles', articleId));
    return { success: true };
  } catch (error) {
    console.error('Error removing article:', error);
    throw error;
  }
};

// Listen to saved articles
export const listenToSavedArticles = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  
  const q = query(
    collection(db, 'savedArticles'),
    where('userId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const articles = [];
    snapshot.forEach((doc) => {
      articles.push({ id: doc.id, ...doc.data() });
    });
    callback(articles);
  }, (error) => {
    console.error('Error listening to saved articles:', error);
    callback([]);
  });
};

// Add to watchlist
export const addToWatchlist = async (userId, keyword) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (!keyword || !keyword.trim()) {
    throw new Error('Keyword is required');
  }

  try {
    // Check if already exists
    const q = query(
      collection(db, 'watchlist'),
      where('userId', '==', userId),
      where('keyword', '==', keyword.toLowerCase().trim())
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { exists: true, id: snapshot.docs[0].id };
    }

    const docRef = await addDoc(collection(db, 'watchlist'), {
      keyword: keyword.toLowerCase().trim(),
      userId,
      createdAt: serverTimestamp()
    });
    
    console.log('Watchlist item added with ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw error;
  }
};

// Remove from watchlist
export const removeFromWatchlist = async (watchlistId) => {
  if (!watchlistId) {
    throw new Error('Watchlist ID is required');
  }

  try {
    await deleteDoc(doc(db, 'watchlist', watchlistId));
    return { success: true };
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    throw error;
  }
};

// Listen to watchlist
export const listenToWatchlist = (userId, callback) => {
  if (!userId) {
    callback([]);
    return () => {};
  }
  
  const q = query(
    collection(db, 'watchlist'),
    where('userId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const items = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    callback(items);
  }, (error) => {
    console.error('Error listening to watchlist:', error);
    callback([]);
  });
};