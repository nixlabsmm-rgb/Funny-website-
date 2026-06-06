/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, AppTab } from './types';
import { MM } from './lib/locale';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import FeedPage from './components/FeedPage';
import ProfilePage from './components/ProfilePage';
import NotificationSettingsPage from './components/NotificationSettingsPage';
import { Globe, Rss, User as UserIcon, Bell, Monitor, AlertTriangle, MessageSquare, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import socialLogo from './assets/images/social_logo_1780482522011.png';
import ChatPage from './components/ChatPage';
import MorePage from './components/MorePage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>('feed');
  
  // Theme syncing state
  const [isDark, setIsDark] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // 1. Listen to system preference for theme auto toggle
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial theme state
    setIsDark(mediaQuery.matches);

    // Watcher for system theme change
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  // Sync state to DOM whenever isDark changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#000000';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '#f4f4f5';
    }
  }, [isDark]);

  // 2. Watch User Authenticated state & retrieve realtime UserProfile Document
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (firebaseUser) {
        setProfileLoading(true);
        const profileRef = doc(db, 'users', firebaseUser.uid);

        unsubscribeProfile = onSnapshot(profileRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setProfile({
              id: snapshot.id,
              displayName: data.displayName || '',
              photoURL: data.photoURL || '',
              bio: data.bio || '',
              onboarded: data.onboarded || false,
              createdAt: data.createdAt,
              lastActiveAt: data.lastActiveAt,
              notificationSettings: {
                newPost: data.notificationSettings?.newPost ?? true,
                newReaction: data.notificationSettings?.newReaction ?? true,
                newComment: data.notificationSettings?.newComment ?? true,
                newMessage: data.notificationSettings?.newMessage ?? true
              }
            });
          } else {
            setProfile(null);
          }
          setProfileLoading(false);
        }, (error) => {
          console.error("Error subscribing to profile stream:", error);
          setProfile(null);
          setProfileLoading(false);
        });
      } else {
        setProfile(null);
        setProfileLoading(false);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Real-time presence heartbeat to track active website usage
  useEffect(() => {
    if (!user || !profile || !profile.onboarded) return;

    const userRef = doc(db, 'users', user.uid);
    const updatePresence = () => {
      updateDoc(userRef, { lastActiveAt: Date.now() }).catch((err) => {
        console.error("Presence update error:", err);
      });
    };

    // Update immediately on mount/login
    updatePresence();

    // Pulse heartbeat every 15 seconds to stay fresh (max 45 seconds tolerance)
    const interval = setInterval(updatePresence, 15000);

    // Also update on window focus to feel incredibly fast and responsive
    const handleFocus = () => {
      updatePresence();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, profile?.onboarded]);

  // Handle Loading Screen
  if (authLoading || (user && profileLoading)) {
    return (
      <div id="app-global-loader" className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-lime-500/20 border-t-lime-600 rounded-none animate-spin" />
          <img 
            src={socialLogo} 
            alt="Logo" 
            className="w-8 h-8 object-contain absolute left-4 top-4"
          />
        </div>
        <span className="text-xs font-semibold text-lime-400 mt-6 tracking-wide animate-pulse font-myanmar leading-relaxed">
          {MM.appName} is loading...
        </span>
      </div>
    );
  }

  // 1. Show custom login view if unauthenticated
  if (!user) {
    return (
      <Login
        onLoginStart={() => setLoginError(null)}
        onLoginError={(err) => setLoginError(err)}
        error={loginError}
      />
    );
  }

  // 2. Render onboarding steps if profile was not created yet
  if (!profile || !profile.onboarded) {
    return (
      <Onboarding
        userId={user.uid}
        defaultEmail={user.email}
        defaultPhoto={user.photoURL}
        defaultName={user.displayName}
        onComplete={() => {
          // Firebase onSnapshot listener will catch up and re-render
        }}
      />
    );
  }

  // 3. User is fully authenticated & onboarded -> main responsive pages
  return (
    <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 flex font-sans transition-colors duration-300">
      
      {/* Left Sidebar Navigation (Geometric Balance) */}
      <nav id="desktop-sidebar-nav" className="hidden md:flex w-[240px] border-r border-zinc-200 dark:border-zinc-800 flex-col p-6 sticky top-0 h-screen bg-zinc-50/50 dark:bg-black shrink-0 z-30">
        <div className="mb-10">
          <h1 className="text-xl font-bold flex flex-col gap-1.5 text-zinc-900 dark:text-zinc-50">
            <div className="flex items-center gap-1.5 justify-start">
              <img 
                src={socialLogo} 
                alt="Logo" 
                className="w-9 h-9 object-contain shrink-0 transition duration-300 hover:scale-110"
              />
              <span className="text-[10px] tracking-widest font-mono text-zinc-400 dark:text-zinc-500 font-bold">COMMUNITY</span>
            </div>
            <span className="font-myanmar font-black text-lg bg-gradient-to-r from-lime-600 via-emerald-600 to-green-600 dark:from-lime-400 dark:via-emerald-400 dark:to-green-400 bg-clip-text text-transparent leading-relaxed pt-1 drop-shadow-sm">
              {MM.appName}
            </span>
          </h1>
        </div>
        
        <div className="space-y-2">
          <button
            id="sidebar-nav-feed"
            onClick={() => setActiveTab('feed')}
            className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-none border transition duration-150 ${
              activeTab === 'feed'
                ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20 font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Rss className="w-4.5 h-4.5 shrink-0" />
            <span className="font-semibold text-sm">{MM.navFeed}</span>
          </button>

          <button
            id="sidebar-nav-messenger"
            onClick={() => setActiveTab('messenger')}
            className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-none border transition duration-150 ${
              activeTab === 'messenger'
                ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20 font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-4.5 h-4.5 shrink-0" />
            <span className="font-semibold text-sm">{MM.navChat}</span>
          </button>

          <button
            id="sidebar-nav-notifications"
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-none border transition duration-150 ${
              activeTab === 'notifications'
                ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20 font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Bell className="w-4.5 h-4.5 shrink-0" />
            <span className="font-semibold text-sm">{MM.navNotifications}</span>
          </button>

          <button
            id="sidebar-nav-profile"
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-none border transition duration-150 ${
              activeTab === 'profile'
                ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20 font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <UserIcon className="w-4.5 h-4.5 shrink-0" />
            <span className="font-semibold text-sm">{MM.navProfile}</span>
          </button>

          <button
            id="sidebar-nav-more"
            onClick={() => setActiveTab('more')}
            className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-none border transition duration-150 ${
              activeTab === 'more'
                ? 'bg-lime-500/10 text-lime-600 dark:text-lime-400 border-lime-500/20 font-semibold'
                : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <MoreHorizontal className="w-4.5 h-4.5 shrink-0" />
            <span className="font-semibold text-sm">{MM.navMore}</span>
          </button>
        </div>

        <div className="mt-auto">
          <div className="bg-zinc-100/70 dark:bg-zinc-900/40 p-4 rounded-none border border-zinc-200/50 dark:border-zinc-800/80">
            <p className="text-xs text-zinc-500 tracking-tight mb-2 font-medium">{MM.themeSystem}</p>
            <div className="flex bg-zinc-200/85 dark:bg-black p-1 rounded-none border border-zinc-300 dark:border-zinc-800 text-[11px]">
              <div className="flex-1 py-1 text-center bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-none shadow-sm font-semibold">
                Auto
              </div>
              <div className={`flex-1 py-1 text-center ${isDark ? 'text-lime-500 font-bold' : 'text-zinc-400'}`}>
                Dark
              </div>
              <div className={`flex-1 py-1 text-center ${!isDark ? 'text-lime-600 font-bold' : 'text-zinc-500'}`}>
                Light
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 bg-zinc-50 dark:bg-black">
        {/* Top Header inside main view */}
        <header className="h-14 z-45 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between px-4 sm:px-8 bg-white/80 dark:bg-black/70 backdrop-blur-md sticky top-0 shrink-0 select-none">
          <div className="flex items-center space-x-3 relative top-[4px]">
            {/* Show tiny logo for mobile devices when vertical sidebar gets collapsed */}
            <div className="md:hidden flex items-center space-x-2">
              <img 
                src={socialLogo} 
                alt="Logo" 
                className="w-9 h-9 object-contain shrink-0"
              />
              <span className="font-myanmar font-black text-xs bg-gradient-to-r from-lime-600 via-emerald-600 to-green-600 dark:from-lime-400 dark:via-emerald-400 dark:to-green-400 bg-clip-text text-transparent leading-relaxed py-0.5">
                {MM.appName}
              </span>
            </div>
            
            {/* Divider on mobile */}
            <span className="md:hidden text-zinc-300 dark:text-zinc-800 font-light text-xs">/</span>

            {/* Custom page title and icon container for matched layout */}
            <div id="current-viewport-title" className="flex items-center gap-2">
              {activeTab === 'feed' && (
                <>
                  <Rss className="w-4.5 h-4.5 text-lime-600 dark:text-lime-400 shrink-0" />
                  <span className="text-sm md:text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{MM.navFeed}</span>
                </>
              )}
              {activeTab === 'profile' && (
                <>
                  <UserIcon className="w-4.5 h-4.5 text-lime-600 dark:text-lime-400 shrink-0" />
                  <span className="text-sm md:text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{MM.navProfile}</span>
                </>
              )}
              {activeTab === 'notifications' && (
                <>
                  <Bell className="w-4.5 h-4.5 text-lime-600 dark:text-lime-400 shrink-0" />
                  <span className="text-sm md:text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{MM.navNotifications}</span>
                </>
              )}
              {activeTab === 'messenger' && (
                <>
                  <MessageSquare className="w-4.5 h-4.5 text-lime-600 dark:text-lime-400 shrink-0" />
                  <span className="text-sm md:text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{MM.navChat}</span>
                </>
              )}
              {activeTab === 'more' && (
                <>
                  <MoreHorizontal className="w-4.5 h-4.5 text-lime-600 dark:text-lime-400 shrink-0" />
                  <span className="text-sm md:text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{MM.navMore}</span>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Central Feed/Page content container */}
        <main className={`flex-1 w-full mx-auto px-4 py-8 pb-32 md:pb-20 overflow-y-auto ${activeTab === 'messenger' ? 'max-w-4xl' : 'max-w-2xl'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'feed' && <FeedPage currentUser={profile} />}
              {activeTab === 'profile' && <ProfilePage currentUser={profile} />}
              {activeTab === 'notifications' && <NotificationSettingsPage currentUser={profile} />}
              {activeTab === 'messenger' && <ChatPage currentUser={profile} />}
              {activeTab === 'more' && <MorePage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Right aside panel (Profile Quick Viewer & Real-time Settings indicator) */}
      <aside className="hidden lg:flex w-[280px] border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex-col sticky top-0 h-screen shrink-0 overflow-y-auto z-30 font-sans">
        {/* Profile Quick Viewer widget */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col items-center text-center">
          {profile?.photoURL ? (
            <img
              src={profile.photoURL}
              alt={profile.displayName}
              className="w-20 h-20 rounded-none object-cover mb-4 border-2 border-zinc-200 dark:border-zinc-800 shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-none bg-lime-600 flex items-center justify-center text-white text-2xl font-bold mb-4 border border-lime-700 shadow-sm">
              {profile?.displayName ? profile.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{profile?.displayName}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 max-w-[200px] line-clamp-2 leading-relaxed h-[36px]">
            {profile?.bio || MM.bioPlaceholder}
          </p>
          <button
            onClick={() => setActiveTab('profile')}
            className="w-full mt-4 py-2 bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-800 rounded-none text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-lime-500 hover:text-lime-600 transition duration-200 cursor-pointer"
          >
            {MM.profileEditBtn}
          </button>
        </div>

        {/* Real-time sync options summary */}
        <div className="p-6 flex-1 flex flex-col justify-between">
          <div>
            <h4 className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mb-4">
              {MM.notifTitle}
            </h4>
            <div className="space-y-4">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setActiveTab('notifications')}
              >
                <span className="text-xs text-zinc-600 dark:text-zinc-300 group-hover:text-lime-500 transition duration-150">
                  {MM.notifNewPost}
                </span>
                <div className={`w-8 h-4.5 rounded-none border border-zinc-300 dark:border-zinc-700 p-0.5 flex transition ${profile?.notificationSettings?.newPost ? 'bg-lime-600 justify-end' : 'bg-zinc-300 dark:bg-zinc-800 justify-start'}`}>
                  <div className="w-3.5 h-3.5 rounded-none bg-white shadow-sm" />
                </div>
              </div>

              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setActiveTab('notifications')}
              >
                <span className="text-xs text-zinc-600 dark:text-zinc-300 group-hover:text-lime-500 transition duration-150">
                  {MM.notifNewReact}
                </span>
                <div className={`w-8 h-4.5 rounded-none border border-zinc-300 dark:border-zinc-700 p-0.5 flex transition ${profile?.notificationSettings?.newReaction ? 'bg-lime-600 justify-end' : 'bg-zinc-300 dark:bg-zinc-800 justify-start'}`}>
                  <div className="w-3.5 h-3.5 rounded-none bg-white shadow-sm" />
                </div>
              </div>

              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setActiveTab('notifications')}
              >
                <span className="text-xs text-zinc-600 dark:text-zinc-300 group-hover:text-lime-500 transition duration-150">
                  {MM.notifNewComment}
                </span>
                <div className={`w-8 h-4.5 rounded-none border border-zinc-300 dark:border-zinc-700 p-0.5 flex transition ${profile?.notificationSettings?.newComment ? 'bg-lime-600 justify-end' : 'bg-zinc-300 dark:bg-zinc-800 justify-start'}`}>
                  <div className="w-3.5 h-3.5 rounded-none bg-white shadow-sm" />
                </div>
              </div>

              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setActiveTab('notifications')}
              >
                <span className="text-xs text-zinc-600 dark:text-zinc-300 group-hover:text-lime-500 transition duration-150 capitalize">
                  {MM.notifNewMessage}
                </span>
                <div className={`w-8 h-4.5 rounded-none border border-zinc-300 dark:border-zinc-700 p-0.5 flex transition ${profile?.notificationSettings?.newMessage ? 'bg-lime-600 justify-end' : 'bg-zinc-300 dark:bg-zinc-800 justify-start'}`}>
                  <div className="w-3.5 h-3.5 rounded-none bg-white shadow-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Bottom Floating Navigation for Mobile screens */}
      <footer id="app-mobile-footer" className="md:hidden fixed bottom-4 left-4 right-4 z-40">
        <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur border border-zinc-200/50 dark:border-zinc-900 rounded-none h-16 pointer-events-auto shadow-2xl flex items-center justify-around px-1">
          
          <button
            id="mobile-nav-feed"
            onClick={() => setActiveTab('feed')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-none transition whitespace-nowrap ${
              activeTab === 'feed' ? 'text-lime-600 font-bold scale-105' : 'text-zinc-500'
            }`}
          >
            <Rss className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">{MM.navFeed}</span>
          </button>

          <button
            id="mobile-nav-messenger"
            onClick={() => setActiveTab('messenger')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-none transition whitespace-nowrap ${
              activeTab === 'messenger' ? 'text-lime-600 font-bold scale-105' : 'text-zinc-500'
            }`}
          >
            <MessageSquare className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">{MM.navChat}</span>
          </button>
 
          <button
            id="mobile-nav-notifications"
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-none transition whitespace-nowrap ${
              activeTab === 'notifications' ? 'text-lime-600 font-bold scale-105' : 'text-zinc-500'
            }`}
          >
            <Bell className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">{MM.navNotifications}</span>
          </button>

          <button
            id="mobile-nav-profile"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-none transition whitespace-nowrap ${
              activeTab === 'profile' ? 'text-lime-600 font-bold scale-105' : 'text-zinc-500'
            }`}
          >
            <UserIcon className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">{MM.navProfile}</span>
          </button>

          <button
            id="mobile-nav-more"
            onClick={() => setActiveTab('more')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-none transition whitespace-nowrap ${
              activeTab === 'more' ? 'text-lime-600 font-bold scale-105' : 'text-zinc-500'
            }`}
          >
            <MoreHorizontal className="w-5 h-5 shrink-0" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">{MM.navMore}</span>
          </button>

        </div>
      </footer>

    </div>
  );
}
