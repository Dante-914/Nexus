import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import './Notes.css';

export default function Notes() {
  const { currentUser } = useAuth();
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('personal');
  const [tags, setTags] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Categories
  const categories = ['personal', 'work', 'ideas', 'journal', 'study', 'other'];

  // Quill modules configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'color': [] }, { 'background': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      ['clean']
    ],
  };

  // Fetch notes from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = [];
      snapshot.forEach((doc) => {
        notesData.push({ id: doc.id, ...doc.data() });
      });
      setNotes(notesData);
      setFilteredNotes(notesData);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  // Filter notes based on search and category
  useEffect(() => {
    let filtered = notes;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(note => note.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(note => 
        note.title?.toLowerCase().includes(term) ||
        note.content?.toLowerCase().includes(term) ||
        note.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    setFilteredNotes(filtered);
  }, [notes, searchTerm, selectedCategory]);

  const createNewNote = () => {
    setSelectedNote(null);
    setTitle('');
    setContent('');
    setCategory('personal');
    setTags('');
    setIsEditing(true);
  };

  const saveNote = async () => {
    if (!title.trim()) {
      alert('Please add a title');
      return;
    }

    try {
      const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);

      if (selectedNote) {
        // Update existing note
        const noteRef = doc(db, 'notes', selectedNote.id);
        await updateDoc(noteRef, {
          title,
          content,
          category,
          tags: tagArray,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new note
        await addDoc(collection(db, 'notes'), {
          title,
          content,
          category,
          tags: tagArray,
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Reset form
      setSelectedNote(null);
      setTitle('');
      setContent('');
      setCategory('personal');
      setTags('');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const editNote = (note) => {
    setSelectedNote(note);
    setTitle(note.title || '');
    setContent(note.content || '');
    setCategory(note.category || 'personal');
    setTags(note.tags?.join(', ') || '');
    setIsEditing(true);
  };

  const deleteNote = async (noteId) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteDoc(doc(db, 'notes', noteId));
        if (selectedNote?.id === noteId) {
          setSelectedNote(null);
          setTitle('');
          setContent('');
          setCategory('personal');
          setTags('');
          setIsEditing(false);
        }
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  };

  const cancelEdit = () => {
    setSelectedNote(null);
    setTitle('');
    setContent('');
    setCategory('personal');
    setTags('');
    setIsEditing(false);
  };

  // Get unique tags from all notes
  const allTags = [...new Set(notes.flatMap(note => note.tags || []))];

  if (loading) {
    return <div className="loading">Loading notes...chill</div>;
  }

  return (
    <div className="notes-container">
      <div className="notes-sidebar">
        <div className="notes-header">
          <h2>📝 My Notes</h2>
          <button onClick={createNewNote} className="new-note-btn">
            + New Note
          </button>
        </div>

        <div className="notes-search">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="notes-filters">
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-filter"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {allTags.length > 0 && (
          <div className="tags-cloud">
            <h4>Popular Tags</h4>
            <div className="tags-list">
              {allTags.slice(0, 10).map(tag => (
                <button
                  key={tag}
                  onClick={() => setSearchTerm(tag)}
                  className="tag-chip"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="notes-list">
          {filteredNotes.length === 0 ? (
            <p className="empty-notes">No notes found</p>
          ) : (
            filteredNotes.map(note => (
              <div
                key={note.id}
                className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                onClick={() => editNote(note)}
              >
                <h3 className="note-title">{note.title || 'Untitled'}</h3>
                <div className="note-meta">
                  <span className={`note-category ${note.category}`}>
                    {note.category}
                  </span>
                  <span className="note-date">
                    {note.updatedAt?.toDate().toLocaleDateString()}
                  </span>
                </div>
                {note.tags && note.tags.length > 0 && (
                  <div className="note-tags">
                    {note.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="note-tag">#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="notes-editor">
        {isEditing ? (
          <div className="editor-container">
            <div className="editor-header">
              <input
                type="text"
                placeholder="Note title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="title-input"
              />
              <div className="editor-actions">
                <button onClick={cancelEdit} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={saveNote} className="save-btn">
                  {selectedNote ? 'Update' : 'Save'}
                </button>
              </div>
            </div>

            <div className="editor-meta">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="category-select">
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Tags (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="tags-input"
              />
            </div>

            <div className="quill-editor">
              <ReactQuill
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
                placeholder="Write your note here..."
              />
            </div>
          </div>
        ) : (
          <div className="editor-placeholder">
            <p>Select a note to edit or create a new one</p>
            <button onClick={createNewNote} className="start-new-btn">
              + Start Writing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}