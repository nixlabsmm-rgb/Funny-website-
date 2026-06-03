import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';
import { MM } from '../lib/locale';
import { AVATARS } from '../lib/assets';
import { Edit3, Check, X, LogOut, Award, User, Info, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfilePageProps {
  currentUser: UserProfile;
}

export default function ProfilePage(props: ProfilePageProps) {
  const { currentUser } = props;
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.photoURL);
  const [customPhotoURL, setCustomPhotoURL] = useState('');
  const [isCustomUrl, setIsCustomUrl] = useState(currentUser.photoURL.startsWith('http') && !AVATARS.includes(currentUser.photoURL));
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);

  // 1. Calculate real-time total posts from this user
  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, where('authorId', '==', currentUser.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPostCount(snapshot.size);
    }, (err) => {
      console.error("Error reading profile statistics:", err);
    });

    return unsubscribe;
  }, [currentUser.id]);

  // 2. Handle Profile Edit Submit
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    setLoading(true);
    setError(null);

    const finalPhoto = isCustomUrl ? (customPhotoURL.trim() || selectedAvatar) : selectedAvatar;
    const userRef = doc(db, 'users', currentUser.id);

    try {
      // 1. Update user profile
      await updateDoc(userRef, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        photoURL: finalPhoto,
        updatedAt: serverTimestamp()
      });

      // 2. Synchronously write updates to existing user posts
      try {
        const postsRef = collection(db, 'posts');
        const q = query(postsRef, where('authorId', '==', currentUser.id));
        const postsSnap = await getDocs(q);

        if (!postsSnap.empty) {
          const batch = writeBatch(db);
          postsSnap.forEach((postDoc) => {
            batch.update(postDoc.ref, {
              authorName: displayName.trim(),
              authorPhoto: finalPhoto,
              updatedAt: serverTimestamp()
            });
          });
          await batch.commit();
        }
      } catch (syncErr) {
        console.error("Failed to sync profile updates to posts collection in database:", syncErr);
      }

      setEditing(false);
    } catch (err) {
      console.error("Update profile failed:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.id}`);
      } catch (wrappedErr: any) {
        setError("Failed to update profile. Please verify database permissions.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Logout safely
  const handleLogout = () => {
    setShowConfirmLogout(true);
  };

  return (
    <div id="profile-container" className="space-y-6">
      {/* Profile Header Block */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-805 rounded-none p-6 sm:p-8 shadow-sm relative overflow-hidden">
        {/* Glowing top highlight */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-lime-600 via-lime-550 to-emerald-600" />

        <div className="flex flex-col md:flex-row items-center md:items-start justify-between space-y-6 md:space-y-0 md:space-x-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left space-y-4 sm:space-y-0 sm:space-x-5">
            {/* Visual avatar wrapper */}
            <div className="relative">
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName}
                className="w-24 h-24 rounded-none border-4 border-zinc-50 dark:border-zinc-800 shadow-lg object-cover bg-zinc-800"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = AVATARS[0];
                }}
              />
              <span className="absolute bottom-1 right-1 w-5 h-5 bg-lime-600 text-white border-2 border-white dark:border-zinc-900 text-[10px] font-bold rounded-none flex items-center justify-center">
                ✓
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                {currentUser.displayName}
              </h3>
              
              {/* Bio display */}
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed whitespace-pre-wrap">
                {currentUser.bio || MM.bioPlaceholder}
              </p>

              {/* Stats badges */}
              <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="flex items-center space-x-1 px-3 py-1 bg-lime-500/10 text-lime-600 dark:text-lime-400 rounded-none text-xs font-semibold border border-lime-500/15">
                  <Award className="w-3.5 h-3.5" />
                  <span>{MM.profileTotalPosts}: {postCount}</span>
                </span>
                <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-none text-xs font-mono border border-zinc-200 dark:border-zinc-800">
                  UID: {currentUser.id.substring(0, 8)}...
                </span>
              </div>
            </div>
          </div>

          {/* Inline Action block */}
          <div className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-2.5 shrink-0">
            <button
              id="profile-toggle-edit-btn"
              onClick={() => {
                setEditing(!editing);
                setError(null);
                // reset edits with current info
                setDisplayName(currentUser.displayName);
                setBio(currentUser.bio || '');
                setSelectedAvatar(currentUser.photoURL);
                if (!AVATARS.includes(currentUser.photoURL)) {
                  setCustomPhotoURL(currentUser.photoURL);
                  setIsCustomUrl(true);
                } else {
                  setIsCustomUrl(false);
                }
              }}
              className="px-4 py-2 bg-zinc-150 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-none flex items-center space-x-1.5 transition duration-200 border border-zinc-305 dark:border-zinc-700"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editing ? MM.profileCancelBtn : MM.profileEditBtn}</span>
            </button>

            <button
              id="profile-logout-btn"
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs rounded-none flex items-center space-x-1.5 transition duration-200 border border-red-500/20"
              title={MM.profileLogoutBtn}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{MM.profileLogoutBtn}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor Form Modal or inline panel */}
      {editing && (
        <motion.div
          id="profile-editing-form-card"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-none p-5 sm:p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center space-x-2 font-black text-sm text-lime-400 pb-2 border-b border-zinc-50 dark:border-zinc-850">
            <User className="w-4 h-4" />
            <span>{MM.profileEditBtn}</span>
          </div>

          {error && (
            <div className="p-3 bg-red-950/20 border border-red-800/30 text-red-400 text-xs rounded-none flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4 text-zinc-900 dark:text-zinc-50">
            <div>
              <label className="block text-xs font-semibold text-lime-400 uppercase tracking-wider mb-1.5">
                {MM.displayNameLabel}
              </label>
              <input
                id="edit-profile-name-input"
                type="text"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none text-xs focus:outline-none focus:border-lime-500 transition text-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-lime-400 uppercase tracking-wider mb-1.5">
                {MM.bioLabel}
              </label>
              <textarea
                id="edit-profile-bio-input"
                rows={3}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none text-xs focus:outline-none focus:border-lime-500 transition text-zinc-950 dark:text-zinc-100 resize-none"
              />
            </div>

            {/* Custom Avatar toggler */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-lime-400 uppercase tracking-wider">
                  {MM.avatarLabel}
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomUrl(!isCustomUrl)}
                  className="text-[10px] text-lime-400 hover:underline transition"
                >
                  {isCustomUrl ? 'Select from sample avatars' : 'Enter external image URL'}
                </button>
              </div>

              {isCustomUrl ? (
                <input
                  id="edit-profile-avatar-url"
                  type="url"
                  value={customPhotoURL}
                  onChange={(e) => setCustomPhotoURL(e.target.value)}
                  placeholder="https://example.com/me.jpg"
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-none text-xs focus:outline-none focus:border-lime-500 transition text-zinc-105"
                />
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 bg-zinc-50/60 dark:bg-zinc-950/40 p-3 border border-zinc-200 dark:border-zinc-800 rounded-none">
                  {AVATARS.map((url, idx) => (
                    <button
                      id={`edit-avatar-choice-${idx}`}
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAvatar(url)}
                      className={`relative p-0.5 rounded-none transition ${
                        selectedAvatar === url
                          ? 'bg-lime-500/10 ring-2 ring-lime-600'
                          : 'hover:bg-zinc-800'
                      }`}
                    >
                      <img
                        src={url}
                        alt="Avatar Option"
                        className="w-10 h-10 mx-auto rounded-none object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-zinc-50 dark:border-zinc-850">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-zinc-205 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 rounded-none text-xs font-semibold transition"
              >
                {MM.profileCancelBtn}
              </button>
              <button
                id="edit-profile-save-btn"
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-lime-600 hover:bg-lime-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-none text-xs font-bold transition flex items-center space-x-1 border border-lime-700"
              >
                {loading ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{MM.profileSaveBtn}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {showConfirmLogout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 max-w-sm w-full space-y-4 shadow-2xl text-center rounded-none font-sans"
          >
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
              Are you sure you want to log out?
            </p>
            <div className="flex justify-center space-x-3 pt-2">
              <button
                id="logout-cancel-btn"
                onClick={() => setShowConfirmLogout(false)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-400 text-xs font-semibold cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                id="logout-confirm-btn"
                onClick={async () => {
                  setShowConfirmLogout(false);
                  try {
                    await auth.signOut();
                  } catch (err) {
                    console.error("Logout failed:", err);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold border border-red-700 cursor-pointer rounded-none shadow-sm"
              >
                Log Out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
export { ProfilePage };
