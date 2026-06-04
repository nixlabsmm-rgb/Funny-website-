import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';
import { MM } from '../lib/locale';
import { 
  Search, 
  Mic, 
  Square, 
  Circle,
  VolumeX, 
  Volume2, 
  Send, 
  Trash2, 
  User as UserIcon, 
  MessageSquare,
  ArrowLeft,
  Play, 
  Pause,
  Clock,
  Check,
  Copy,
  Download,
  Smile
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatPageProps {
  currentUser: UserProfile;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  receiverId: string;
  text: string;
  audioUrl?: string;
  audioDuration?: number;
  createdAt: any;
  reactions?: Record<string, string>;
}

// Custom voice player component for nice visual wave and controls
function VoiceMessagePlayer({ audioUrl, duration }: { audioUrl: string; duration?: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(audioUrl);
    
    const handleTimeUpdate = () => {
      if (audioRef.current) {
        const current = audioRef.current.currentTime;
        const total = audioRef.current.duration || duration || 1;
        setProgress((current / total) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('ended', handleEnded);
      }
    };
  }, [audioUrl, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Play failed", err));
      setIsPlaying(true);
    }
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '0:00';
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center gap-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 px-3 min-w-[210px] sm:min-w-[240px] select-none font-sans mt-1">
      <button 
        onClick={togglePlay}
        className="w-8 h-8 rounded-none flex items-center justify-center bg-lime-500 hover:bg-lime-600 text-black shadow-sm transition duration-150 shrink-0 cursor-pointer"
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 space-y-1">
        <div className="w-full bg-zinc-200 dark:bg-zinc-850 h-1.5 rounded-none overflow-hidden relative">
          <div 
            className="bg-lime-500 h-full transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[9px] text-zinc-400 font-mono">
          <span>{isPlaying ? 'Playing...' : MM.chatVoiceMsg}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>
      
      {/* Wave aesthetic */}
      <div className="flex items-end gap-0.5 h-6 shrink-0">
        {[4, 8, 5, 7, 3, 9, 4, 6].map((h, i) => (
          <div 
            key={i} 
            className={`w-0.5 bg-lime-500/40 rounded-none transition ${isPlaying ? 'animate-pulse' : ''}`}
            style={{ 
              height: isPlaying ? `${Math.floor(Math.random() * 16) + 4}px` : `${h + 2}px`,
              animationDelay: `${i * 100}ms`
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatPage({ currentUser }: ChatPageProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [circleUsers, setCircleUsers] = useState<Set<string>>(new Set());
  const [incomingNotiBanner, setIncomingNotiBanner] = useState<{
    senderName: string;
    senderPhoto: string;
    text: string;
    peerId: string;
  } | null>(null);

  const lastAlertedMessageIdRef = useRef<string | null>(null);
  const componentMountedAt = useRef<number>(Date.now());
  const notiBannerTimeoutRef = useRef<any>(null);

  // Request system notification permission on boot
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(err => console.log("Notification request blocked", err));
      }
    }
    return () => {
      if (notiBannerTimeoutRef.current) clearTimeout(notiBannerTimeoutRef.current);
    };
  }, []);

  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Double-bell melody (crisp and gentle like a real cozy phone message sound)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now); // B5
      osc1.frequency.exponentialRampToValueAtTime(1479.98, now + 0.12); // F#6
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);
    } catch (err) {
      console.error("Audio bell chime failed", err);
    }
  };

  const triggerPhoneVibration = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([120, 60, 120]);
    }
  };

  const triggerWebNotification = (title: string, body: string, iconUrl?: string) => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`ပေါက်ပေါက်ဖောက် • ${title}`, {
          body: body,
          icon: iconUrl || '/public/icon.png',
          tag: 'incoming-message',
          renotify: true
        } as any);
      }
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeer, setSelectedPeer] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // States for long-press message features
  const [holdMsgId, setHoldMsgId] = useState<string | null>(null);
  const [holdingMsgId, setHoldingMsgId] = useState<string | null>(null);
  const [showReactionsForId, setShowReactionsForId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const holdTimeoutRef = useRef<any>(null);

  const startHoldTimer = (msgId: string) => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    setHoldingMsgId(msgId);
    holdTimeoutRef.current = setTimeout(() => {
      setHoldMsgId(msgId);
      setHoldingMsgId(null);
    }, 600); // 0.6 seconds hold trigger
  };

  const clearHoldTimer = () => {
    setHoldingMsgId(null);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  // Clean hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    };
  }, []);

  const handleDeleteMessage = async (msgId: string) => {
    if (!selectedPeer) return;
    const chatId = currentUser.id < selectedPeer.id 
      ? `${currentUser.id}_${selectedPeer.id}`
      : `${selectedPeer.id}_${currentUser.id}`;
    
    try {
      const msgDocRef = doc(db, 'chats', chatId, 'messages', msgId);
      await deleteDoc(msgDocRef);
      setHoldMsgId(null);
    } catch (err) {
      console.error("Delete message failed:", err);
    }
  };

  const handleCopyText = (text: string, msgId: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      setTimeout(() => {
        setCopiedMessageId(null);
        setHoldMsgId(null);
      }, 1200);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const handleDownloadAudio = (audioUrl: string, msgId: string) => {
    try {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `voice-message-${msgId}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setHoldMsgId(null);
    } catch (err) {
      console.error("Audio download failed:", err);
    }
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    if (!selectedPeer) return;
    const chatId = currentUser.id < selectedPeer.id 
      ? `${currentUser.id}_${selectedPeer.id}`
      : `${selectedPeer.id}_${currentUser.id}`;
    
    try {
      const msgDocRef = doc(db, 'chats', chatId, 'messages', msgId);
      const currentMsg = messages.find(m => m.id === msgId);
      const prevReactions = currentMsg?.reactions || {};
      
      const nextReactions = { ...prevReactions };
      if (nextReactions[currentUser.id] === emoji) {
        delete nextReactions[currentUser.id];
      } else {
        nextReactions[currentUser.id] = emoji;
      }

      await setDoc(msgDocRef, { reactions: nextReactions }, { merge: true });
      
      setHoldMsgId(null);
      setShowReactionsForId(null);
    } catch (err) {
      console.error("React to message failed:", err);
    }
  };

  // Resolve active selected peer from up-to-date users list so that updates (e.g. name, photo) reflect instantly in the active chat header
  const resolvedPeer = selectedPeer ? (users.find(u => u.id === selectedPeer.id) || selectedPeer) : null;

  // Resolve up-to-date sender display details (e.g., if current user or other peers update their profile)
  const getSenderInfo = (senderId: string, fallbackName: string, fallbackPhoto: string) => {
    if (senderId === currentUser.id) {
      return {
        displayName: currentUser.displayName || fallbackName,
        photoURL: currentUser.photoURL || fallbackPhoto
      };
    }
    const foundPeer = users.find(u => u.id === senderId);
    if (foundPeer) {
      return {
        displayName: foundPeer.displayName || fallbackName,
        photoURL: foundPeer.photoURL || fallbackPhoto
      };
    }
    return {
      displayName: fallbackName,
      photoURL: fallbackPhoto
    };
  };

  // 1. Listen to all registered user profiles
  useEffect(() => {
    const q = query(collection(db, 'users'));
    return onSnapshot(q, (snapshot) => {
      const ulist: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        const u = docSnap.data();
        if (docSnap.id !== currentUser.id) {
          ulist.push({
            id: docSnap.id,
            displayName: u.displayName || '',
            photoURL: u.photoURL || '',
            bio: u.bio || '',
            onboarded: u.onboarded || false,
            createdAt: u.createdAt,
            notificationSettings: {
              newPost: u.notificationSettings?.newPost ?? true,
              newReaction: u.notificationSettings?.newReaction ?? true,
              newComment: u.notificationSettings?.newComment ?? true,
              newMessage: u.notificationSettings?.newMessage ?? true
            }
          });
        }
      });
      setUsers(ulist);
    }, (error) => {
      console.error("Error fetching peer users: ", error);
    });
  }, [currentUser.id]);

  // Keep a stable ref of circleUsers to read inside message snapshots without unsubscribing
  const circleUsersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    circleUsersRef.current = circleUsers;
  }, [circleUsers]);

  // 2. Listen to currentUser's mute configurations
  useEffect(() => {
    const mutesRef = collection(db, 'users', currentUser.id, 'muted');
    return onSnapshot(mutesRef, (snapshot) => {
      const set = new Set<string>();
      const cSet = new Set<string>();
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d) {
          if (d.muted === false) {
            cSet.add(docSnap.id);
          } else {
            set.add(docSnap.id);
          }
        }
      });
      setMutedUsers(set);
      setCircleUsers(cSet);
    }, (error) => {
      console.error("Error fetching mutes: ", error);
    });
  }, [currentUser.id]);

  // 3. Listen to message thread if a peer is selected
  useEffect(() => {
    if (!selectedPeer) {
      setMessages([]);
      return;
    }

    // Determine deterministic chat ID
    const chatId = currentUser.id < selectedPeer.id 
      ? `${currentUser.id}_${selectedPeer.id}`
      : `${selectedPeer.id}_${currentUser.id}`;

    const msgRef = collection(db, 'chats', chatId, 'messages');
    const q = query(msgRef, orderBy('createdAt', 'asc'));

    return onSnapshot(q, (snapshot) => {
      const list: Message[] = [];
      let newIncomingMsg: Message | null = null;
      const nowMs = Date.now();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

      snapshot.forEach((docSnap) => {
        const m = docSnap.data();
        
        // Auto-delete pure text messages (no audioUrl) older than 3 days directly in Firebase
        if (!m.audioUrl && m.createdAt) {
          const createdAtMs = m.createdAt.seconds ? (m.createdAt.seconds * 1000) : Date.now();
          if (nowMs - createdAtMs > threeDaysMs) {
            const expiredDocRef = doc(db, 'chats', chatId, 'messages', docSnap.id);
            deleteDoc(expiredDocRef).then(() => {
              console.log("Auto-deleted 3-day old text message from Firebase: ", docSnap.id);
            }).catch(err => {
              console.error("Auto delete error: ", err);
            });
            return; // Skip adding to the local list
          }
        }

        const msgObj: Message = {
          id: docSnap.id,
          senderId: m.senderId,
          senderName: m.senderName,
          senderPhoto: m.senderPhoto,
          receiverId: m.receiverId,
          text: m.text,
          audioUrl: m.audioUrl,
          audioDuration: m.audioDuration,
          createdAt: m.createdAt,
          reactions: m.reactions || {}
        };
        list.push(msgObj);

        // Check if there is a new incoming message from the peer for alerts
        if (m.senderId !== currentUser.id && m.createdAt) {
          const creationMs = m.createdAt.seconds ? (m.createdAt.seconds * 1000) : Date.now();
          if (creationMs > componentMountedAt.current - 5000 && docSnap.id !== lastAlertedMessageIdRef.current) {
            newIncomingMsg = msgObj;
          }
        }
      });

      setMessages(list);

      // Trigger active alert notifications
      if (newIncomingMsg) {
        const incoming = newIncomingMsg as Message;
        lastAlertedMessageIdRef.current = incoming.id;
        
        // Play sound, vibrate, and alert
        playNotificationSound();
        triggerPhoneVibration();
        
        const textToDisplay = incoming.audioUrl ? '🎤 Voice Message' : incoming.text;
        const senderDetails = getSenderInfo(incoming.senderId, incoming.senderName, incoming.senderPhoto);
        triggerWebNotification(senderDetails.displayName, textToDisplay, senderDetails.photoURL);

        setIncomingNotiBanner({
          senderName: senderDetails.displayName,
          senderPhoto: senderDetails.photoURL,
          text: textToDisplay,
          peerId: incoming.senderId
        });

        if (notiBannerTimeoutRef.current) clearTimeout(notiBannerTimeoutRef.current);
        notiBannerTimeoutRef.current = setTimeout(() => {
          setIncomingNotiBanner(null);
        }, 4500);
      }
    }, (error) => {
      console.error("Error fetching messages: ", error);
    });
  }, [selectedPeer, currentUser.id]);

  // Scroll to bottom whenever messages list grows
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Toggle peer mute configuration (Circle vs Square status)
  const handleToggleMute = async (peerId: string) => {
    const isCircle = circleUsers.has(peerId);
    const muteDocRef = doc(db, 'users', currentUser.id, 'muted', peerId);
    
    try {
      if (isCircle) {
        // Change from Circle to Square/Rectangle
        await setDoc(muteDocRef, {
          muted: true,
          createdAt: serverTimestamp()
        });
      } else {
        // Change from Square to Circle
        await setDoc(muteDocRef, {
          muted: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Style toggle failed: ", err);
    }
  };

  // Sender operation
  const handleSendMessage = async (e?: React.FormEvent, customAudio?: { url: string; duration: number }) => {
    if (e) e.preventDefault();
    if (!selectedPeer) return;

    const textPayload = inputText.trim();
    if (!textPayload && !customAudio) return;

    const chatId = currentUser.id < selectedPeer.id 
      ? `${currentUser.id}_${selectedPeer.id}`
      : `${selectedPeer.id}_${currentUser.id}`;

    const payload: any = {
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderPhoto: currentUser.photoURL,
      receiverId: selectedPeer.id,
      text: customAudio ? '🎤 Voice Message' : textPayload,
      createdAt: serverTimestamp()
    };

    if (customAudio) {
      payload.audioUrl = customAudio.url;
      payload.audioDuration = customAudio.duration;
    }

    setInputText('');

    try {
      const msgRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(msgRef, payload);
    } catch (error) {
      console.error("Failed to send message: ", error);
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages`);
    }
  };

  // Recording Actions
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const duration = Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000));
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          handleSendMessage(undefined, { url: base64Audio, duration });
        };

        // Stop the streaming inputs and cleanup
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      recordingStartTimeRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      mediaRecorder.start();
    } catch (err) {
      console.error("Mic capture failed:", err);
      alert("Microphone connection failed. Please verify site permissions in your browser.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      cleanupTimer();
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Release tracks without triggering standard message sending
      mediaRecorderRef.current.onstop = null; 
      mediaRecorderRef.current.stop();
      cleanupTimer();
    }
  };

  const cleanupTimer = () => {
    setIsRecording(false);
    setRecordingSeconds(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  // Filter list by keyword
  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="messenger-app-layout" className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 flex h-[76vh] rounded-none overflow-hidden select-none relative">
      
      {/* Top Slide-down Notification Banner Alert */}
      <AnimatePresence>
        {incomingNotiBanner && (
          <motion.div
            initial={{ opacity: 0, y: -80, x: '-50%' }}
            animate={{ opacity: 1, y: 16 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[999] bg-white dark:bg-zinc-900 border border-zinc-205 dark:border-zinc-850 p-3 min-w-[290px] max-w-[92vw] shadow-2xl flex items-center gap-3 font-sans border-l-4 border-l-lime-500 hover:scale-[1.01] transition-all"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="relative">
              <img 
                src={incomingNotiBanner.senderPhoto} 
                alt={incomingNotiBanner.senderName} 
                className="w-10 h-10 rounded-full border border-lime-500/30 object-cover shrink-0"
              />
              <span className="absolute -bottom-1 -right-1 bg-lime-500 text-black rounded-full p-0.5 border border-white dark:border-zinc-900">
                <Circle className="w-1.5 h-1.5 fill-current text-white animate-pulse" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] uppercase font-black tracking-widest text-lime-600 dark:text-lime-400 block font-mono">NEW COMM</span>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 truncate">{incomingNotiBanner.senderName}</h4>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5 leading-tight">{incomingNotiBanner.text}</p>
            </div>
            <button 
              type="button"
              onClick={() => {
                const fPeer = users.find(u => u.id === incomingNotiBanner.peerId);
                if (fPeer) setSelectedPeer(fPeer);
                setIncomingNotiBanner(null);
              }}
              className="text-[9px] uppercase font-black px-2.5 py-1.5 bg-lime-500 hover:bg-lime-600 text-black border border-lime-600/20 text-center shrink-0 cursor-pointer rounded-none"
            >
              Reply
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 1. Sidebar contacts listing panel (responsive layout) */}
      <div className={`w-full md:w-[280px] flex-col border-r border-zinc-200 dark:border-zinc-800 ${selectedPeer ? 'hidden md:flex' : 'flex'} shrink-0 bg-zinc-50/50 dark:bg-zinc-950/20`}>
        {/* Search header container */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
          <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">{MM.navChat}</h3>
          
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
            <input 
              type="text"
              placeholder={MM.chatSearchPlaceholder}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-850 rounded-none text-xs focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20 text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* Contacts scrolling body */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/50 dark:divide-zinc-850/50">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400 font-mono">
              No contacts found
            </div>
          ) : (
            filteredUsers.map(peer => {
              const isCircle = circleUsers.has(peer.id);
              return (
                <div 
                  key={peer.id}
                  onClick={() => setSelectedPeer(peer)}
                  className={`flex items-center gap-3 p-3 transition duration-150 cursor-pointer ${
                    selectedPeer?.id === peer.id 
                      ? 'bg-lime-500/10 border-l-2 border-l-lime-500 dark:bg-lime-500/5' 
                      : 'hover:bg-zinc-100/70 dark:hover:bg-zinc-900/40 border-l-2 border-l-transparent'
                  }`}
                >
                  <img 
                    src={peer.photoURL} 
                    alt={peer.displayName} 
                    className={`w-10 h-10 object-cover border transition-all duration-300 ${
                      isCircle 
                        ? 'rounded-full border-lime-500 shadow-sm shadow-lime-500/20' 
                        : 'rounded-none border-zinc-300 dark:border-zinc-700'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{peer.displayName}</span>
                      
                      {/* Circle/Square Status Toggle Button */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleMute(peer.id);
                        }}
                        title={isCircle ? "Set Rectangle (Restrict)" : "Set Circle (Allow)"}
                        className={`p-1.5 border transition-all duration-300 scale-90 cursor-pointer ${
                          isCircle 
                            ? 'rounded-full bg-lime-500/20 border-lime-500/40 text-lime-600 dark:text-lime-400 hover:bg-lime-500/30' 
                            : 'rounded-none bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-650'
                        }`}
                      >
                        {isCircle ? <Circle className="w-3.5 h-3.5 fill-current" /> : <Square className="w-3.5 h-3.5 fill-current" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-zinc-400 truncate flex-1 block">{peer.bio || 'Cozy peer'}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Chat discussion thread column (responsive viewport split) */}
      <div className={`flex-1 flex flex-col bg-zinc-50/20 dark:bg-zinc-950/5 ${selectedPeer ? 'flex' : 'hidden md:flex'}`}>
        {selectedPeer ? (
          <>
            {/* Conversation Header */}
            <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between shrink-0 bg-white/70 dark:bg-black/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back button for mobile preview */}
                <button 
                  onClick={() => setSelectedPeer(null)}
                  className="md:hidden p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-none text-zinc-600 dark:text-zinc-400 mr-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <img 
                  src={resolvedPeer?.photoURL || selectedPeer.photoURL} 
                  alt={resolvedPeer?.displayName || selectedPeer.displayName}
                  className={`w-10 h-10 object-cover border transition-all duration-300 ${
                    circleUsers.has(selectedPeer.id)
                      ? 'rounded-full border-lime-500 shadow-sm shadow-lime-500/20'
                      : 'rounded-none border-zinc-350 dark:border-zinc-700'
                  }`}
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-50 truncate">{resolvedPeer?.displayName || selectedPeer.displayName}</h4>
                  <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                    <Check className="w-3 h-3 text-lime-500 shrink-0 animate-pulse" /> Real-time Connected
                  </span>
                </div>
              </div>
              
              {/* Top Active configurations status widget */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0 select-none shadow-xs">
                {circleUsers.has(selectedPeer.id) ? (
                  <Circle className="w-3.5 h-3.5 text-lime-500 shrink-0 fill-current" />
                ) : (
                  <Square className="w-3 h-3 text-amber-500 shrink-0 fill-current" />
                )}
              </div>
            </div>

            {/* Conversation list segment */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans bg-zinc-50/10 dark:bg-black/10">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="w-12 h-12 rounded-none border border-zinc-200 dark:border-zinc-850 flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 text-zinc-400">
                    <MessageSquare className="w-5 h-5 text-lime-500" />
                  </div>
                  <p className="text-xs text-zinc-500 max-w-xs">{MM.chatNoMessages}</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwn = msg.senderId === currentUser.id;
                  // If we are currently muting / rectangle this user, display placeholder instead of actual text/voice
                  const shouldHideContent = !isOwn && !circleUsers.has(selectedPeer.id);
                  
                  // Dynamically resolve up-to-date sender name and photo!
                  const senderInfo = getSenderInfo(msg.senderId, msg.senderName, msg.senderPhoto);

                  // Smart dynamic positioning: render action box below current bubble if close to top header
                  const showBelow = idx < 3;

                  return (
                    <div 
                      key={msg.id}
                      className={`flex gap-2.5 max-w-[85%] sm:max-w-[75%] relative transition-all duration-100 ${isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto'} ${
                        holdMsgId === msg.id ? 'z-[100]' : 'z-10'
                      }`}
                    >
                      <img 
                        src={senderInfo.photoURL} 
                        alt={senderInfo.displayName} 
                        className="w-8 h-8 rounded-none object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                      />
                      <div className="space-y-1 relative">
                        <div 
                          className={`p-3 border text-xs leading-relaxed break-words rounded-none select-none relative cursor-pointer active:scale-[0.98] transition-all duration-100 ease-out origin-center ${
                            isOwn 
                              ? 'bg-lime-500 border-lime-600/20 text-black font-semibold hover:bg-lime-400' 
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-850'
                          }`}
                          onMouseDown={() => startHoldTimer(msg.id)}
                          onMouseUp={clearHoldTimer}
                          onMouseLeave={clearHoldTimer}
                          onTouchStart={() => startHoldTimer(msg.id)}
                          onTouchEnd={clearHoldTimer}
                          onTouchMove={clearHoldTimer}
                          title="Hold for 0.6 seconds to copy, delete or react"
                        >

                          {/* Held Message Action absolute popover box */}
                          <AnimatePresence>
                            {holdMsgId === msg.id && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.96, y: showBelow ? -4 : 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: showBelow ? -4 : 4 }}
                                transition={{ duration: 0.08, ease: 'easeOut' }}
                                className={`absolute z-30 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xl shadow-black/15 dark:shadow-black/60 p-1.5 flex flex-col gap-1 min-w-[160px] font-sans text-zinc-900 dark:text-zinc-100 ${
                                  showBelow ? 'top-full mt-2' : 'bottom-full mb-2'
                                } ${isOwn ? 'right-0' : 'left-0'}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-850 pb-1.5 mb-1 px-1.5">
                                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 font-mono tracking-widest uppercase">OPTIONS</span>
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setHoldMsgId(null); 
                                      setShowReactionsForId(null);
                                    }}
                                    className="text-[10px] text-zinc-400 hover:text-red-500 hover:scale-110 transition shrink-0 cursor-pointer p-0.5 font-mono font-bold"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {showReactionsForId === msg.id ? (
                                  <div className="flex items-center justify-between gap-1 p-1 bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/50">
                                    {['👍', '😆', '❤️', '😡'].map(emoji => {
                                      // Check if current user already reacted with this emoji
                                      const hasReactedThis = msg.reactions?.[currentUser.id] === emoji;
                                      return (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReactToMessage(msg.id, emoji);
                                          }}
                                          className={`text-base hover:scale-130 transition duration-150 cursor-pointer p-1.5 filter drop-shadow-sm active:scale-95 ${
                                            hasReactedThis ? 'bg-lime-500/20 px-2 border border-lime-500/40' : ''
                                          }`}
                                        >
                                          {emoji}
                                        </button>
                                      );
                                    })}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowReactionsForId(null);
                                      }}
                                      className="text-[8px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 px-1.5 font-mono uppercase font-bold"
                                    >
                                      Back
                                    </button>
                                  </div>
                                ) : (
                                  <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
                                    {/* React Menu */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowReactionsForId(msg.id);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 w-full text-left transition duration-100"
                                    >
                                      <Smile className="w-3.5 h-3.5 text-orange-550 shrink-0" />
                                      <span>React...</span>
                                    </button>

                                    {/* Copy option for text messages */}
                                    {!msg.audioUrl && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopyText(msg.text, msg.id);
                                        }}
                                        className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 w-full text-left transition duration-100"
                                      >
                                        <Copy className="w-3.5 h-3.5 text-blue-500 shrink-0" /> 
                                        <span>{copiedMessageId === msg.id ? 'Copied!' : 'Copy text'}</span>
                                      </button>
                                    )}

                                    {/* Download option for voice/audio messages */}
                                    {msg.audioUrl && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadAudio(msg.audioUrl!, msg.id);
                                        }}
                                        className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 w-full text-left transition duration-100"
                                      >
                                        <Download className="w-3.5 h-3.5 text-emerald-550 shrink-0" />
                                        <span>Download</span>
                                      </button>
                                    )}

                                    {/* Delete Message */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteMessage(msg.id);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-500/10 w-full text-left transition duration-100 border-t border-zinc-100 dark:border-zinc-900 mt-1 pt-1.5"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {shouldHideContent ? (
                            <span className="italic text-zinc-400 font-mono flex items-center gap-1.5 leading-relaxed text-[11px] select-none py-1.5">
                              <Square className="w-3.5 h-3.5 text-amber-500 inline shrink-0 fill-current animate-pulse" /> Restricted message
                            </span>
                          ) : msg.audioUrl ? (
                            <div className="space-y-1">
                              <span className="font-semibold block text-[10px] opacity-75">🎤 {MM.chatVoiceMsg}</span>
                              <VoiceMessagePlayer audioUrl={msg.audioUrl} duration={msg.audioDuration} />
                            </div>
                          ) : (
                            <span>{msg.text}</span>
                          )}
                        </div>

                        {/* Reaction badges pill below the bubble */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`flex items-center gap-1 p-0.5 px-1.5 border text-[10px] bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-750 select-none shadow-xs relative -mt-1 rounded-none max-w-max ${
                            isOwn ? 'ml-auto mr-1' : 'mr-auto ml-1'
                          }`}>
                            {Object.entries(msg.reactions).map(([userId, emo], idx) => {
                              const reactor = users.find(u => u.id === userId) || (userId === currentUser.id ? currentUser : null);
                              return (
                                <span 
                                  key={userId} 
                                  title={reactor ? reactor.displayName : 'User'}
                                  className="scale-115 cursor-help select-none hover:scale-130 transition duration-100"
                                >
                                  {emo}
                                </span>
                              );
                            })}
                            {Object.keys(msg.reactions).length > 1 && (
                              <span className="text-[8px] font-mono font-black text-zinc-500 dark:text-zinc-400 ml-0.5">
                                {Object.keys(msg.reactions).length}
                              </span>
                            )}
                          </div>
                        )}

                        <div className={`flex items-center gap-1.5 text-[9px] text-zinc-400 font-mono ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <span>{senderInfo.displayName}</span>
                          <span>•</span>
                          <span>
                            {msg.createdAt ? (msg.createdAt.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending') : 'Sending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollRef} />
            </div>

            {/* Clear 3-day text auto-deletion warning banner */}
            <div className="px-4 py-2 bg-amber-500/5 dark:bg-amber-500/10 border-t border-b border-zinc-200 dark:border-zinc-800 text-[10px] text-amber-600 dark:text-amber-400 font-mono flex items-center select-none shrink-0 justify-between gap-2">
              <div className="flex items-center gap-1.5 leading-none">
                <Clock className="w-3.5 h-3.5 animate-pulse shrink-0" />
                <span>Text messages are automatically deleted 3 days after being sent. Voice messages are kept.</span>
              </div>
            </div>

            {/* Input interaction bar */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-white dark:bg-black">
              {!circleUsers.has(selectedPeer.id) ? (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-zinc-500 select-none">
                  <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px] sm:text-xs">
                    <Square className="w-4 h-4 text-amber-500 shrink-0 animate-pulse fill-current" />
                    <span>This peer is restricted from sending messages. Enable them to chat.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleMute(selectedPeer.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-lime-500/30 text-lime-600 dark:text-lime-400 bg-lime-500/10 hover:bg-lime-500/20 text-[10px] font-black uppercase transition duration-150 rounded-full cursor-pointer hover:border-lime-500"
                  >
                    <Circle className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>Allow</span>
                  </button>
                </div>
              ) : isRecording ? (
                <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-500 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 animate-ping rounded-none shrink-0" />
                    <span>{MM.chatRecording}</span>
                    <span className="font-bold font-mono">({recordingSeconds}s)</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    {/* Trash voice record / Cancel */}
                    <button 
                      onClick={handleCancelRecording}
                      className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 cursor-pointer transition flex items-center gap-1 font-bold text-[10px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> CANCEL
                    </button>
                    {/* Done / Stop & Send */}
                    <button 
                      onClick={handleStopRecording}
                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white border border-red-700 cursor-pointer transition flex items-center gap-1 font-bold text-[10px]"
                    >
                      <Square className="w-3 h-3 fill-current" /> STOP & SEND
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-2">
                  {/* microphone action */}
                  <button 
                    type="button"
                    onClick={handleStartRecording}
                    title="Record voice message"
                    className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 hover:border-lime-500 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 transition shrink-0 cursor-pointer relative"
                  >
                    <Mic className="w-4 h-4 text-lime-500 hover:scale-110 transition duration-150" />
                  </button>

                  <input 
                    type="text"
                    placeholder={MM.chatTypeMessagePlaceholder}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-none text-xs focus:outline-none focus:border-lime-500 text-zinc-900 dark:text-zinc-100"
                  />

                  <button 
                    type="submit"
                    disabled={!inputText.trim()}
                    className="p-2.5 bg-lime-500 hover:bg-lime-600 disabled:opacity-50 disabled:hover:bg-lime-500 border border-lime-600/20 text-black transition shrink-0 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-none border border-zinc-100 dark:border-zinc-900 flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-950/10 text-zinc-400">
              <MessageSquare className="w-8 h-8 text-lime-500 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-200 tracking-wider font-myanmar leading-relaxed">ပေါက်ပေါက်ဖောက်ရန် Messenger</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
                သူငယ်ချင်းများကို ရွေးချယ်ပြီး တိုက်ရိုက် မက်ဆေ့ခ်ျနှင့် အသံမက်ဆေ့ခ်ျများ ပို့လိုက်ပါ!
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
