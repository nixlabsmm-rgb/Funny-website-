import React, { useState, useEffect, useRef } from 'react';
import { 
  doc, 
  onSnapshot, 
  increment, 
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Post, UserProfile, ReactionType } from '../types';
import { MM } from '../lib/locale';
import { ThumbsUp, Smile, Heart, Frown, MessageSquare } from 'lucide-react';

interface PostActionsProps {
  post: Post;
  currentUser: UserProfile;
  showComments: boolean;
  onCommentToggle: () => void;
}

export default function PostActions({ post, currentUser, showComments, onCommentToggle }: PostActionsProps) {
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverTimeout, setPopoverTimeout] = useState<any>(null);
  const [holdActive, setHoldActive] = useState(false);
  const pressTimerRef = useRef<any>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (popoverTimeout) clearTimeout(popoverTimeout);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, [popoverTimeout]);

  const handleMouseEnter = () => {
    if (popoverTimeout) clearTimeout(popoverTimeout);
    setShowPopover(true);
  };

  const handleMouseLeave = () => {
    const timer = setTimeout(() => {
      setShowPopover(false);
    }, 450);
    setPopoverTimeout(timer);
  };

  const handlePopMouseEnter = () => {
    if (popoverTimeout) clearTimeout(popoverTimeout);
  };

  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    setHoldActive(false);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      setShowPopover(true);
      setHoldActive(true);
    }, 280); // Quick 280ms press detection
  };

  const endPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const getSelectedReactionUI = () => {
    switch (myReaction) {
      case 'like':
        return {
          label: MM.reactLike || 'Like',
          icon: <ThumbsUp className="w-4.5 h-4.5 shrink-0 fill-current" />,
          colorClass: 'text-lime-600 dark:text-lime-400 font-extrabold',
        };
      case 'haha':
        return {
          label: MM.reactHaha || 'Haha',
          icon: <Smile className="w-4.5 h-4.5 shrink-0 fill-current" />,
          colorClass: 'text-amber-500 dark:text-amber-400 font-extrabold',
        };
      case 'care':
        return {
          label: MM.reactCare || 'Care',
          icon: <Heart className="w-4.5 h-4.5 shrink-0 fill-current" />,
          colorClass: 'text-pink-500 dark:text-pink-400 font-extrabold',
        };
      case 'angry':
        return {
          label: MM.reactAngry || 'Angry',
          icon: <Frown className="w-4.5 h-4.5 shrink-0 fill-current" />,
          colorClass: 'text-red-500 dark:text-red-400 font-extrabold',
        };
      default:
        return {
          label: MM.reactLike || 'Like',
          icon: <ThumbsUp className="w-4.5 h-4.5 shrink-0" />,
          colorClass: 'text-zinc-500 dark:text-zinc-400 hover:text-lime-600 dark:hover:text-lime-400',
        };
    }
  };

  const currentUI = getSelectedReactionUI();

  const handleMainButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (holdActive) {
      // Hold was active (the popover was opened via holding/long press).
      // We block click so we don't accidently toggle "like" immediately on finger release.
      setHoldActive(false);
      return;
    }
    if (myReaction) {
      handleReact(myReaction);
    } else {
      handleReact('like');
    }
  };

  // Listen to my current reaction on this post in real-time
  useEffect(() => {
    const rxRef = doc(db, 'posts', post.id, 'reactions', currentUser.id);
    const unsubscribe = onSnapshot(rxRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMyReaction(data.type as ReactionType);
      } else {
        setMyReaction(null);
      }
    }, (error) => {
      console.error("Error reading reaction:", error);
    });
    return unsubscribe;
  }, [post.id, currentUser.id]);

  // Handle Reaction Logic securely with direct writes for instant local latency compensation
  const handleReact = async (type: ReactionType) => {
    const postRef = doc(db, 'posts', post.id);
    const reactionRef = doc(db, 'posts', post.id, 'reactions', currentUser.id);

    const getCounterKey = (t: ReactionType) => t === 'like' ? 'likesCount' : `${t}Count`;

    try {
      if (myReaction) {
        if (myReaction === type) {
          // Unreact (click same reaction type)
          // 1. Delete reaction doc from database
          await deleteDoc(reactionRef);

          // 2. Decrement post count
          const decKey = getCounterKey(myReaction);
          await updateDoc(postRef, {
            [decKey]: increment(-1),
            updatedAt: serverTimestamp()
          });
        } else {
          // Switch reaction types
          // 1. Update reaction doc
          await setDoc(reactionRef, {
            type: type,
            userId: currentUser.id,
            updatedAt: serverTimestamp()
          });

          // 2. Decrement old and Increment new count
          const decKey = getCounterKey(myReaction);
          const incKey = getCounterKey(type);
          await updateDoc(postRef, {
            [decKey]: increment(-1),
            [incKey]: increment(1),
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // Create new reaction
        // 1. Set reaction doc with createdAt
        await setDoc(reactionRef, {
          type: type,
          userId: currentUser.id,
          createdAt: serverTimestamp()
        });

        // 2. Increment post count
        const incKey = getCounterKey(type);
        await updateDoc(postRef, {
          [incKey]: increment(1),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Reaction failed:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
      } catch (e) {
        // Log friendly error silently
      }
    }
  };

  return (
    <div className="px-3 py-2 bg-zinc-50/40 dark:bg-zinc-950/20 flex gap-2 border-t border-zinc-100 dark:border-zinc-800/60 rounded-none relative">
      
      {/* React Flyout Popover */}
      {showPopover && (
        <div 
          id={`post-reactions-popover-${post.id}`}
          onMouseEnter={handlePopMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="absolute bottom-[92%] left-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 py-1.5 flex items-center space-x-3.5 shadow-xl z-20 rounded-none animate-in fade-in slide-in-from-bottom-2 duration-150 transition-all font-sans"
        >
          {/* LIKE EMOJI ACTION */}
          <button
            type="button"
            onClick={() => { handleReact('like'); setShowPopover(false); }}
            className="hover:scale-135 transition-transform duration-100 p-1 flex flex-col items-center gap-0.5 cursor-pointer rounded-none animate-bounce"
            title={MM.reactLike}
          >
            <span className="text-xl sm:text-2xl filter drop-shadow">👍</span>
            <span className="text-[9px] font-bold text-zinc-400 capitalize">{MM.reactLike}</span>
          </button>

          {/* HAHA EMOJI ACTION */}
          <button
            type="button"
            onClick={() => { handleReact('haha'); setShowPopover(false); }}
            className="hover:scale-135 transition-transform duration-100 p-1 flex flex-col items-center gap-0.5 cursor-pointer rounded-none animate-bounce"
            title={MM.reactHaha}
          >
            <span className="text-xl sm:text-2xl filter drop-shadow">😆</span>
            <span className="text-[9px] font-bold text-zinc-400 capitalize">{MM.reactHaha}</span>
          </button>

          {/* CARE EMOJI ACTION */}
          <button
            type="button"
            onClick={() => { handleReact('care'); setShowPopover(false); }}
            className="hover:scale-135 transition-transform duration-100 p-1 flex flex-col items-center gap-0.5 cursor-pointer rounded-none animate-bounce"
            title={MM.reactCare}
          >
            <span className="text-xl sm:text-2xl filter drop-shadow">❤️</span>
            <span className="text-[9px] font-bold text-zinc-400 capitalize">{MM.reactCare}</span>
          </button>

          {/* ANGRY EMOJI ACTION */}
          <button
            type="button"
            onClick={() => { handleReact('angry'); setShowPopover(false); }}
            className="hover:scale-135 transition-transform duration-100 p-1 flex flex-col items-center gap-0.5 cursor-pointer rounded-none animate-bounce"
            title={MM.reactAngry}
          >
            <span className="text-xl sm:text-2xl filter drop-shadow">😡</span>
            <span className="text-[9px] font-bold text-zinc-400 capitalize">{MM.reactAngry}</span>
          </button>
        </div>
      )}

      {/* REACT BUTTON CONTAINER WITH HOVER / LONG-PRESS HOLD */}
      <div 
        className="flex-1 relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          id={`post-react-button-${post.id}`}
          onClick={handleMainButtonClick}
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          className={`w-full py-2 px-3 flex items-center justify-center space-x-2 text-xs font-bold rounded-none cursor-pointer transition-all duration-150 active:scale-95 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 select-none touch-manipulation ${currentUI.colorClass}`}
        >
          {currentUI.icon}
          <span className="text-xs sm:text-xs font-bold">{currentUI.label}</span>
        </button>
      </div>

      {/* COMMENT BUTTON */}
      <button
        id={`post-comment-toggle-btn-${post.id}`}
        onClick={onCommentToggle}
        className={`flex-1 py-2 px-3 flex items-center justify-center space-x-2 text-xs font-bold rounded-none cursor-pointer transition-all duration-150 active:scale-95 border border-zinc-200 dark:border-zinc-800 ${
          showComments 
            ? 'bg-lime-100 dark:bg-lime-950/30 text-lime-600 dark:text-lime-400 font-extrabold border-lime-300 dark:border-lime-900' 
            : 'text-zinc-500 dark:text-zinc-400 hover:text-lime-600 dark:hover:text-lime-400 bg-white dark:bg-zinc-900'
        }`}
      >
        <MessageSquare className={`w-4.5 h-4.5 shrink-0 transition-transform ${showComments ? 'scale-110 text-lime-600 dark:text-lime-400' : ''}`} />
        <span className="text-xs sm:text-xs font-bold">Comment</span>
      </button>

    </div>
  );
}
export { PostActions };
