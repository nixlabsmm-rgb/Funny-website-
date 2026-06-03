import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  increment, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Post, Comment, ReactionType, UserProfile } from '../types';
import { MM } from '../lib/locale';
import HashtagText from './HashtagText';
import PostActions from './PostActions';
import { MessageSquare, Heart, Smile, HelpCircle, Flame, Trash2, Send, Clock, Sparkles, ThumbsUp, Frown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PostCardProps {
  post: Post;
  currentUser: UserProfile;
  key?: string;
}

export default function PostCard(props: PostCardProps) {
  const { post, currentUser } = props;
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [commentToDeleteId, setCommentToDeleteId] = useState<string | null>(null);

  // 2. Listen to comments when expanded
  useEffect(() => {
    if (!showComments) return;

    const commentsRef = collection(db, 'posts', post.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsList: Comment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        docsList.push({
          id: docSnap.id,
          userId: data.userId,
          userName: data.userName,
          userPhoto: data.userPhoto || '',
          text: data.text,
          createdAt: data.createdAt,
        });
      });
      setComments(docsList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `posts/${post.id}/comments`);
    });

    return unsubscribe;
  }, [post.id, showComments]);

  // 4. Handle Post Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) {
      setCommentError(MM.postCommentEmpty);
      return;
    }

    setSubmittingComment(true);
    setCommentError(null);

    const postRef = doc(db, 'posts', post.id);
    const commentsColRef = collection(db, 'posts', post.id, 'comments');

    try {
      // Create comment document
      await addDoc(commentsColRef, {
        userId: currentUser.id,
        userName: currentUser.displayName,
        userPhoto: currentUser.photoURL,
        text: newCommentText.trim(),
        createdAt: serverTimestamp()
      });

      // Update post comment counter
      await updateDoc(postRef, {
        commentsCount: increment(1),
        updatedAt: serverTimestamp()
      });

      setNewCommentText('');
    } catch (err) {
      console.error("Adding comment failed:", err);
      handleFirestoreError(err, OperationType.CREATE, `posts/${post.id}/comments`);
    } finally {
      setSubmittingComment(false);
    }
  };

  // 5. Handle Delete Post (Only if post author)
  const handleDeletePost = () => {
    setShowDeletePostConfirm(true);
  };

  const confirmDeletePost = async () => {
    try {
      await deleteDoc(doc(db, 'posts', post.id));
    } catch (err) {
      console.error("Deleting post failed:", err);
      handleFirestoreError(err, OperationType.DELETE, `posts/${post.id}`);
    } finally {
      setShowDeletePostConfirm(false);
    }
  };

  // 6. Handle Delete Comment
  const handleDeleteComment = (commentId: string) => {
    setCommentToDeleteId(commentId);
  };

  const confirmDeleteComment = async () => {
    if (!commentToDeleteId) return;
    const commentRef = doc(db, 'posts', post.id, 'comments', commentToDeleteId);
    const postRef = doc(db, 'posts', post.id);
    try {
      await deleteDoc(commentRef);
      await updateDoc(postRef, {
        commentsCount: increment(-1),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Deleting comment failed:", err);
      handleFirestoreError(err, OperationType.DELETE, `posts/${post.id}/comments/${commentToDeleteId}`);
    } finally {
      setCommentToDeleteId(null);
    }
  };

  // Humanize Timestamp to localized String
  const formatTime = (ts: any) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  // Helper values
  const totalReactions = (post.likesCount || 0) + (post.hahaCount || 0) + (post.careCount || 0) + (post.angryCount || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      id={`post-card-${post.id}`}
      className="bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/80 rounded-none shadow-sm hover:shadow-md transition-shadow duration-350 overflow-hidden relative"
    >
      {/* Header section (Author) */}
      <div className="p-4 sm:p-5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src={post.authorId === currentUser.id ? currentUser.photoURL : post.authorPhoto}
            alt={post.authorId === currentUser.id ? currentUser.displayName : post.authorName}
            className="w-10 h-10 rounded-none border border-zinc-200 dark:border-zinc-800 shadow-sm object-cover bg-zinc-800"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${post.authorId}`;
            }}
          />
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center">
              <span>{post.authorId === currentUser.id ? currentUser.displayName : post.authorName}</span>
              {post.authorId === 'MMyvY2gqN2SAnS8B9E9W' && (
                <Sparkles className="w-3.5 h-3.5 ml-1 text-lime-600 animate-bounce" />
              )}
            </h4>
            <div className="flex items-center space-x-1 text-[10px] text-zinc-400 font-mono mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{formatTime(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Delete option (Only owners can delete) */}
        {post.authorId === currentUser.id && (
          <button
            id={`delete-post-${post.id}`}
            onClick={handleDeletePost}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-950/30 rounded-none border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all duration-200 cursor-pointer"
            title="Delete Post"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main post text content */}
      <div className="px-4 sm:px-5 pb-4 text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed break-words whitespace-pre-wrap">
        <HashtagText text={post.text} />
      </div>

      {/* Optional attached photo */}
      {post.photoURL && (
        <div className="px-1 border-y border-zinc-50 dark:border-zinc-800 bg-zinc-950/20 max-h-[480px] overflow-hidden flex items-center justify-center">
          <img
            src={post.photoURL}
            alt="Post contribution"
            className="w-full h-auto object-cover max-h-[480px]"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </div>
      )}

      {/* Status summary analytics */}
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/40 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center space-x-2">
          {totalReactions > 0 ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              {post.likesCount > 0 && (
                <span className="flex items-center space-x-1 text-sm select-none">
                  <span className="filter drop-shadow" title="Like">👍</span>
                  <span className="font-extrabold text-zinc-800 dark:text-zinc-200 text-xs">{post.likesCount}</span>
                </span>
              )}
              {post.hahaCount > 0 && (
                <span className="flex items-center space-x-1 text-sm select-none">
                  <span className="filter drop-shadow" title="Haha">😆</span>
                  <span className="font-extrabold text-zinc-800 dark:text-zinc-200 text-xs">{post.hahaCount}</span>
                </span>
              )}
              {post.careCount > 0 && (
                <span className="flex items-center space-x-1 text-sm select-none">
                  <span className="filter drop-shadow" title="Care">❤️</span>
                  <span className="font-extrabold text-zinc-800 dark:text-zinc-200 text-xs">{post.careCount}</span>
                </span>
              )}
              {post.angryCount > 0 && (
                <span className="flex items-center space-x-1 text-sm select-none">
                  <span className="filter drop-shadow" title="Angry">😡</span>
                  <span className="font-extrabold text-zinc-800 dark:text-zinc-200 text-xs">{post.angryCount}</span>
                </span>
              )}
              <span className="text-[10px] text-zinc-400 font-bold ml-1">
                ({totalReactions} reactions)
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-400 font-medium">No reactions yet</span>
          )}
        </div>

        <button
          id={`toggle-comments-btn-${post.id}`}
          onClick={() => setShowComments(!showComments)}
          className="hover:underline hover:text-lime-600 dark:hover:text-lime-400 transition-colors cursor-pointer text-[11px]"
        >
          {post.commentsCount || 0} Comments
        </button>
      </div>

      {/* Modern Friendly Reactions Row (Like, Haha, Care, Angry) */}
      <PostActions 
        post={post} 
        currentUser={currentUser} 
        showComments={showComments} 
        onCommentToggle={() => setShowComments(!showComments)}
      />

      {/* Real-time Subcollection Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/40 dark:bg-zinc-950/10"
          >
            {/* List existing comments */}
            <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
              {comments.length === 0 ? (
                <div className="text-center py-4 text-xs text-zinc-400">
                  No comments yet. Be the first to comment!
                </div>
              ) : (
                comments.map((cmt) => (
                  <div id={`comment-${cmt.id}`} key={cmt.id} className="flex items-start space-x-2.5">
                    <img
                      src={cmt.userId === currentUser.id ? currentUser.photoURL : cmt.userPhoto}
                      alt={cmt.userId === currentUser.id ? currentUser.displayName : cmt.userName}
                      className="w-7 h-7 rounded-none border border-zinc-200 dark:border-zinc-800 object-cover bg-zinc-800"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-800/65 rounded-none border border-zinc-200/50 dark:border-zinc-800 px-3.5 py-2.5 text-xs max-w-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          {cmt.userId === currentUser.id ? currentUser.displayName : cmt.userName}
                        </span>
                        <div className="flex items-center space-x-1 text-[9px] text-zinc-400 font-mono">
                          <span>{formatTime(cmt.createdAt)}</span>
                          {(cmt.userId === currentUser.id || post.authorId === currentUser.id) && (
                            <button
                              id={`delete-cmt-${cmt.id}`}
                              onClick={() => handleDeleteComment(cmt.id)}
                              className="text-zinc-400 hover:text-red-500 font-sans ml-2 text-[10px] px-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition"
                              title="Delete Comment"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-zinc-700 dark:text-zinc-200 break-words pr-2">
                        <HashtagText text={cmt.text} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Form input */}
            <form onSubmit={handleAddComment} className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center space-x-2">
              <input
                id={`post-comment-input-${post.id}`}
                type="text"
                maxLength={1000}
                required
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={MM.postAddComment}
                className="flex-1 px-4 py-2 text-xs bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800/70 focus:border-lime-500 rounded-none focus:outline-none transition text-zinc-950 dark:text-zinc-100 placeholder-zinc-500"
              />
              <button
                id={`post-comment-submit-${post.id}`}
                type="submit"
                disabled={submittingComment || !newCommentText.trim()}
                className="p-2 sm:px-3 sm:py-2 bg-lime-600 hover:bg-lime-500 disabled:opacity-30 disabled:pointer-events-none text-white font-semibold rounded-none flex items-center justify-center transition"
                title={MM.postSendComment}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nice modal for delete post confirmation */}
      <AnimatePresence>
        {showDeletePostConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 max-w-sm w-full space-y-4 shadow-2xl text-center rounded-none font-sans"
            >
              <div className="w-12 h-12 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 mx-auto flex items-center justify-center rounded-none">
                <Trash2 className="w-5 h-5 animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                Are you sure you want to delete this post?
              </p>
              <p className="text-xs text-zinc-400">
                This action is permanent and cannot be undone.
              </p>
              <div className="flex justify-center space-x-3 pt-2">
                <button
                  id={`confirm-delete-post-cancel-${post.id}`}
                  onClick={() => setShowDeletePostConfirm(false)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-400 text-xs font-semibold cursor-pointer rounded-none"
                >
                  Cancel
                </button>
                <button
                  id={`confirm-delete-post-btn-${post.id}`}
                  onClick={confirmDeletePost}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold border border-red-700 cursor-pointer rounded-none shadow-sm"
                >
                  Delete Post
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Nice modal for delete comment confirmation */}
      <AnimatePresence>
        {commentToDeleteId !== null && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 max-w-sm w-full space-y-4 shadow-2xl text-center rounded-none font-sans"
            >
              <div className="w-12 h-12 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 mx-auto flex items-center justify-center rounded-none">
                <Trash2 className="w-5 h-5 animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                Are you sure you want to delete this comment?
              </p>
              <p className="text-xs text-zinc-400">
                This will permanently remove the comment from the post.
              </p>
              <div className="flex justify-center space-x-3 pt-2">
                <button
                  id={`confirm-delete-cmt-cancel-${post.id}`}
                  onClick={() => setCommentToDeleteId(null)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-400 text-xs font-semibold cursor-pointer rounded-none"
                >
                  Cancel
                </button>
                <button
                  id={`confirm-delete-cmt-btn-${post.id}`}
                  onClick={confirmDeleteComment}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold border border-red-700 cursor-pointer rounded-none shadow-sm"
                >
                  Delete Comment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
export { PostCard };
