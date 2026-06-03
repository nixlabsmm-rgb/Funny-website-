import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, NotificationSettings } from '../types';
import { MM } from '../lib/locale';
import { Bell, ShieldCheck, Mail, MessageSquare, Heart, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationSettingsPageProps {
  currentUser: UserProfile;
}

export default function NotificationSettingsPage(props: NotificationSettingsPageProps) {
  const { currentUser } = props;
  const [newPost, setNewPost] = useState(currentUser.notificationSettings?.newPost ?? true);
  const [newReaction, setNewReaction] = useState(currentUser.notificationSettings?.newReaction ?? true);
  const [newComment, setNewComment] = useState(currentUser.notificationSettings?.newComment ?? true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (key: 'newPost' | 'newReaction' | 'newComment', currentVal: boolean) => {
    const newVal = !currentVal;
    
    // Snappy UX updates local state instantly
    if (key === 'newPost') setNewPost(newVal);
    if (key === 'newReaction') setNewReaction(newVal);
    if (key === 'newComment') setNewComment(newVal);

    setLoading(true);
    setSuccess(false);
    setError(null);

    const userRef = doc(db, 'users', currentUser.id);
    const updatedSettings = {
      newPost: key === 'newPost' ? newVal : newPost,
      newReaction: key === 'newReaction' ? newVal : newReaction,
      newComment: key === 'newComment' ? newVal : newComment
    };

    try {
      await updateDoc(userRef, {
        notificationSettings: updatedSettings,
        updatedAt: serverTimestamp()
      });
      setSuccess(true);
      // Auto fade out success message
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Auto-saving notification settings failed:", err);
      setError("Unable to save settings automatically.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="notifications-settings-container" className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none p-6 sm:p-8 shadow-sm space-y-6">
        {/* Header Title */}
        <div className="flex items-start justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 bg-lime-500/10 text-lime-600 dark:text-lime-400 rounded-none border border-lime-500/15 flex items-center justify-center shrink-0">
              <Bell className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                {MM.notifTitle}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                {MM.notifSubtitle}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-950/20 border border-red-800/30 text-red-200 text-xs rounded-none flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-5 text-zinc-900 dark:text-zinc-50">
          {/* Settings Lists */}
          <div className="space-y-3.5">
            {/* Toggle 1: New Posts */}
            <div 
              id="notif-toggle-new-post"
              onClick={() => handleToggle('newPost', newPost)}
              className="flex items-center justify-between p-4 bg-zinc-50 hover:bg-zinc-100/50 dark:bg-zinc-950/30 dark:hover:bg-zinc-950/50 rounded-none border border-zinc-100 dark:border-zinc-800/60 cursor-pointer transition duration-150"
            >
              <div className="flex items-center space-x-3.5 pr-2">
                <div className="w-8 h-8 rounded-none bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 block">
                    {MM.notifNewPost}
                  </span>
                </div>
              </div>

              {/* Tick checkbox style */}
              <div className={`w-5 h-5 border transition-all duration-150 flex items-center justify-center shrink-0 ${
                newPost 
                  ? 'bg-lime-600 border-lime-700 text-white animate-scale-up' 
                  : 'border-zinc-400 dark:border-zinc-600 text-transparent bg-white dark:bg-zinc-950 hover:border-lime-500 dark:hover:border-lime-400'
              }`}>
                <Check className="w-3.5 h-3.5 stroke-[3.5]" />
              </div>
            </div>

            {/* Toggle 2: New Reactions */}
            <div 
              id="notif-toggle-new-react"
              onClick={() => handleToggle('newReaction', newReaction)}
              className="flex items-center justify-between p-4 bg-zinc-50 hover:bg-zinc-100/50 dark:bg-zinc-950/30 dark:hover:bg-zinc-950/50 rounded-none border border-zinc-100 dark:border-zinc-800 cursor-pointer transition duration-150"
            >
              <div className="flex items-center space-x-3.5 pr-2">
                <div className="w-8 h-8 rounded-none bg-zinc-200 dark:bg-zinc-800 text-zinc-550 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 block">
                    {MM.notifNewReact}
                  </span>
                </div>
              </div>

              {/* Tick checkbox style */}
              <div className={`w-5 h-5 border transition-all duration-150 flex items-center justify-center shrink-0 ${
                newReaction 
                  ? 'bg-lime-600 border-lime-700 text-white animate-scale-up' 
                  : 'border-zinc-400 dark:border-zinc-600 text-transparent bg-white dark:bg-zinc-950 hover:border-lime-500 dark:hover:border-lime-400'
              }`}>
                <Check className="w-3.5 h-3.5 stroke-[3.5]" />
              </div>
            </div>

            {/* Toggle 3: New Comments */}
            <div 
              id="notif-toggle-new-comment"
              onClick={() => handleToggle('newComment', newComment)}
              className="flex items-center justify-between p-4 bg-zinc-50 hover:bg-zinc-100/50 dark:bg-zinc-950/30 dark:hover:bg-zinc-950/50 rounded-none border border-zinc-100 dark:border-zinc-800 cursor-pointer transition duration-150"
            >
              <div className="flex items-center space-x-3.5 pr-2">
                <div className="w-8 h-8 rounded-none bg-zinc-200 dark:bg-zinc-800 text-zinc-550 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200 block">
                    {MM.notifNewComment}
                  </span>
                </div>
              </div>

              {/* Tick checkbox style */}
              <div className={`w-5 h-5 border transition-all duration-150 flex items-center justify-center shrink-0 ${
                newComment 
                  ? 'bg-lime-600 border-lime-700 text-white animate-scale-up' 
                  : 'border-zinc-400 dark:border-zinc-600 text-transparent bg-white dark:bg-zinc-950 hover:border-lime-500 dark:hover:border-lime-400'
              }`}>
                <Check className="w-3.5 h-3.5 stroke-[3.5]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export { NotificationSettingsPage };
