import React, { useState } from 'react';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import { db, doc, handleFirestoreError, OperationType } from '../lib/firebase';
import { MM } from '../lib/locale';
import { AVATARS } from '../lib/assets';
import { User, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface OnboardingProps {
  userId: string;
  defaultEmail: string | null;
  defaultPhoto: string | null;
  defaultName: string | null;
  onComplete: () => void;
}

export default function Onboarding(props: OnboardingProps) {
  const [displayName, setDisplayName] = useState(props.defaultName || '');
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(props.defaultPhoto || AVATARS[0]);
  const [customPhotoURL, setCustomPhotoURL] = useState('');
  const [isCustomUrl, setIsCustomUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError(MM.displayNameLabel + ' is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const finalPhoto = isCustomUrl ? (customPhotoURL.trim() || selectedAvatar) : selectedAvatar;

    const userProfileData = {
      id: props.userId,
      displayName: displayName.trim(),
      photoURL: finalPhoto,
      bio: bio.trim(),
      onboarded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      notificationSettings: {
        newPost: true,
        newReaction: true,
        newComment: true
      }
    };

    const path = `users/${props.userId}`;
    try {
      await setDoc(doc(db, 'users', props.userId), userProfileData);
      props.onComplete();
    } catch (err: any) {
      console.error('Error writing profile during onboarding:', err);
      // We MUST handle using handleFirestoreError according to rules
      try {
        handleFirestoreError(err, OperationType.CREATE, path);
      } catch (wrappedErr: any) {
        setError(wrappedErr.message ? 'An error occurred while saving profile' : String(wrappedErr));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="onboarding-container" className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4 py-12 relative overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(132,204,22,0.1),rgba(0,0,0,0))]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-none p-6 sm:p-10 shadow-2xl relative z-10 my-8"
      >
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 bg-lime-950/20 border border-lime-500/30 rounded-none items-center justify-center text-lime-400 mb-3">
            <User className="w-6 h-6 stroke-[2]" />
          </div>
          <h2 className="text-2xl font-extrabold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            {MM.onboardingTitle}
          </h2>
          <p className="text-xs text-lime-400 mt-1 font-medium">
            {MM.onboardingSubtitle}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-950/40 border border-red-800/30 text-red-200 text-xs rounded-none mb-6 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-lime-400 mb-1.5">
              {MM.displayNameLabel} <span className="text-red-500">*</span>
            </label>
            <input
              id="onboard-display-name"
              type="text"
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={MM.displayNamePlaceholder}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-lime-500 rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-lime-500/30 text-white placeholder-zinc-700 transition"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-semibold text-lime-400 mb-1.5">
              {MM.bioLabel}
            </label>
            <textarea
              id="onboard-bio"
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={MM.bioPlaceholder}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-lime-500 rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-lime-500/30 text-white placeholder-zinc-700 transition resize-none"
            />
          </div>

          {/* Avatars Grid */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-lime-400">
                {MM.avatarLabel}
              </label>
              <button
                type="button"
                onClick={() => setIsCustomUrl(!isCustomUrl)}
                className="text-[10px] text-lime-400 hover:underline transition cursor-pointer"
              >
                {isCustomUrl ? 'Select from sample avatars' : 'Enter custom image URL'}
              </button>
            </div>

            {isCustomUrl ? (
              <input
                id="onboard-avatar-url"
                type="url"
                value={customPhotoURL}
                onChange={(e) => setCustomPhotoURL(e.target.value)}
                placeholder="https://example.com/my-photo.jpg"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-lime-500 rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-lime-500/30 text-white placeholder-zinc-700 transition"
              />
            ) : (
              <div className="grid grid-cols-4 gap-3 bg-zinc-950/60 p-4 border border-zinc-800 rounded-none">
                {AVATARS.map((url, idx) => (
                  <button
                    id={`avatar-choice-${idx}`}
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(url)}
                    className={`relative p-1 rounded-none transition cursor-pointer ${
                      selectedAvatar === url
                        ? 'bg-lime-500/10 ring-2 ring-lime-600 scale-105'
                        : 'hover:bg-zinc-800/40 hover:scale-102'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Avatar Option ${idx}`}
                      className="w-11 h-11 mx-auto rounded-none object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {selectedAvatar === url && (
                      <span className="absolute -bottom-1 -right-1 bg-lime-600 text-white text-[9px] font-bold px-1 rounded-none">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current Selection Preview */}
          <div className="flex items-center space-x-3 bg-zinc-950/40 p-4 rounded-none border border-zinc-800">
            <img
              src={isCustomUrl ? (customPhotoURL || selectedAvatar) : selectedAvatar}
              alt="Preview"
              className="w-12 h-12 rounded-none border border-lime-500/20 object-cover bg-zinc-800"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // If custom URL fails, default to first avatar
                (e.target as HTMLImageElement).src = AVATARS[0];
              }}
            />
            <div className="flex-1">
              <span className="text-xs text-zinc-500 block">Current profile photo status</span>
              <span className="text-xs font-semibold text-zinc-300 break-all truncate max-w-xs block">
                {isCustomUrl ? (customPhotoURL || 'No image URL provided yet') : 'Sample avatar selected'}
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            id="onboarding-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-lime-600 hover:bg-lime-500 text-white font-bold rounded-none shadow-lg active:scale-[0.98] transition duration-200 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer border border-lime-700"
          >
            {loading ? (
              <span className="flex items-center space-x-2 animate-pulse">
                <svg className="animate-spin h-5 w-5 text-black" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span className="text-sm">{MM.onboardingSubmit}</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
