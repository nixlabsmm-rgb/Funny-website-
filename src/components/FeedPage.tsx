import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  doc, 
  setDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Post, UserProfile } from '../types';
import { MM } from '../lib/locale';
import { MYANMAR_PHOTOS } from '../lib/assets';
import PostCard from './PostCard';
import { Image as ImageIcon, Send, LayoutGrid, HelpCircle, AlertCircle, Heart, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeedPageProps {
  currentUser: UserProfile;
}

export default function FeedPage(props: FeedPageProps) {
  const { currentUser } = props;
  const [text, setText] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [showPhotoPanel, setShowPhotoPanel] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDeviceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitting(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75); // compress quality 0.75
            setPhotoURL(dataUrl);
            setShowPhotoPanel(true);
          } catch (err) {
            console.error("Canvas compression failed:", err);
            setError("Failed to process local image. Please try a different size or file format.");
          }
        }
        setSubmitting(false);
      };

      img.onerror = () => {
        setError("Invalid image file select. Please choose a valid image from your gallery.");
        setSubmitting(false);
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setError("Failed to read image file from your device.");
      setSubmitting(false);
    };

    reader.readAsDataURL(file);
  };

  // 1. Fetch posts onSnapshot ordered by createdAt descending
  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsList: Post[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        docsList.push({
          id: docSnap.id,
          authorId: data.authorId,
          authorName: data.authorName,
          authorPhoto: data.authorPhoto || '',
          text: data.text,
          photoURL: data.photoURL || '',
          createdAt: data.createdAt,
          likesCount: data.likesCount || 0,
          hahaCount: data.hahaCount || 0,
          careCount: data.careCount || 0,
          angryCount: data.angryCount || 0,
          commentsCount: data.commentsCount || 0,
          hashtags: data.hashtags || []
        });
      });
      setPosts(docsList);
      setLoading(false);
    }, (error) => {
      console.error("Error reading feed:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      } catch (wrappedErr: any) {
        setError("Error loading feed. Please refresh and try again.");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 2. Extract Hashtags from post text
  const extractHashtags = (postText: string): string[] => {
    const matched = postText.match(/#[^\s#]+/g);
    if (!matched) return [];
    // Clean and return unique tags
    return Array.from(new Set(matched.map(tag => tag.substring(1))));
  };

  // 3. Document Creation
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !photoURL.trim()) {
      setError(MM.feedOnlyTextOrPhoto);
      return;
    }

    setSubmitting(true);
    setError(null);

    // Prepare id and properties
    const postsColRef = collection(db, 'posts');
    const extractedTags = extractHashtags(text);

    // We can use addDoc to auto generate an ID
    try {
      // Setup payload matching spec
      const postPayload = {
        authorId: currentUser.id,
        authorName: currentUser.displayName,
        authorPhoto: currentUser.photoURL,
        text: text.trim(),
        photoURL: photoURL.trim(),
        createdAt: serverTimestamp(),
        likesCount: 0,
        hahaCount: 0,
        careCount: 0,
        angryCount: 0,
        commentsCount: 0,
        hashtags: extractedTags
      };

      await addDoc(postsColRef, postPayload);
      
      // Clear inputs
      setText('');
      setPhotoURL('');
      setShowPhotoPanel(false);
    } catch (err) {
      console.error("Creating post failed:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'posts/auto_id');
      } catch (wrappedErr: any) {
        setError("Could not create post. Please check database permissions or configuration.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="feed-container" className="space-y-6">
      {/* Post Creator Box */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/85 dark:border-zinc-800 rounded-none p-6 shadow-xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-lime-600 via-lime-550 to-emerald-650 opacity-60" />

        {error && (
          <div className="p-3 bg-red-950/20 border border-red-800/30 text-red-400 text-xs rounded-none mb-4 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreatePost} className="space-y-4">
          <div className="flex items-center space-x-3">
            <img
              src={currentUser.photoURL}
              alt={currentUser.displayName}
              className="w-10 h-10 rounded-none object-cover bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1">
              <textarea
                id="feed-post-text-input"
                rows={1}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={MM.feedInputPlaceholder}
                className="w-full bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 focus:border-lime-500 rounded-none px-3 py-2 text-sm text-zinc-950 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-lime-500/20 transition resize-none h-10 flex items-center"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-200/80 dark:border-zinc-800/60">
            {/* Hidden native device file input */}
            <input
              id="device-gallery-photo-input"
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleDeviceFileChange}
              className="hidden"
            />

            {/* Quick action: Trigger native device photo selection directly */}
            <button
              id="feed-toggle-photo-panel"
              type="button"
              onClick={triggerFileSelect}
              className={`flex items-center space-x-2 text-xs font-semibold px-4 py-2 rounded-none transition-all duration-200 cursor-pointer ${
                photoURL
                  ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border border-lime-500/20 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/40 hover:text-zinc-805'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-lime-600 dark:text-lime-400 animate-pulse" />
              <span>{photoURL ? "Photo Selected ✓" : MM.feedSharePhoto}</span>
            </button>

            {/* Submit Post button */}
            <button
              id="feed-post-submit-btn"
              type="submit"
              disabled={submitting || (!text.trim() && !photoURL.trim())}
              className="py-2 px-5 bg-lime-600 hover:bg-lime-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs rounded-none shadow-sm hover:shadow active:scale-[0.97] border border-lime-700 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              {submitting ? (
                <svg className="animate-spin h-3.5 w-3.5 text-black" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{MM.feedPostBtn}</span>
                </>
              )}
            </button>
          </div>

          {/* Picture Panel for Device Gallery style preview */}
          <AnimatePresence>
            {photoURL && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="bg-zinc-50 dark:bg-zinc-950/40 p-4 border border-zinc-200/50 dark:border-zinc-800 rounded-none space-y-4 overflow-hidden text-zinc-900 dark:text-zinc-50"
              >
                {/* Real-time preview element with metadata */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-lime-600 dark:text-lime-400 block uppercase tracking-wider">
                    Selected Photo Preview
                  </span>
                  <div className="relative inline-block w-full max-w-md border border-zinc-200 dark:border-zinc-800 rounded-none overflow-hidden group">
                    <img
                      src={photoURL}
                      alt="Current attached preview"
                      className="w-full max-h-64 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 right-2 flex items-center space-x-1.5 opacity-90 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          if (fileInputRef.current) fileInputRef.current.value = '';
                          setPhotoURL('');
                        }}
                        className="bg-red-600 hover:bg-red-500 text-white rounded-none p-1.5 text-[10px] font-bold shadow-sm cursor-pointer"
                        title="Remove photo"
                      >
                        ✕ Remove Image
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>

      {/* Feed Stream */}
      <div className="space-y-5">
        {loading ? (
          <div className="text-center py-12 flex flex-col items-center justify-center space-y-3">
            <svg className="animate-spin h-8 w-8 text-lime-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs text-zinc-500 font-bold">{MM.feedLoading}</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-none space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-lime-500/10 text-lime-600 dark:text-lime-400 rounded-none border border-lime-500/20">
              <Heart className="w-6 h-6 stroke-[2]" />
            </div>
            <p className="text-sm text-zinc-500 font-bold max-w-xs mx-auto text-center">
              {MM.feedNoPosts}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {posts.map((pst) => (
              <PostCard key={pst.id} post={pst} currentUser={currentUser} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
export { FeedPage };
