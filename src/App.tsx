/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, AppTab } from './types';
import { MM } from './lib/locale';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import FeedPage from './components/FeedPage';
import ProfilePage from './components/ProfilePage';
import NotificationSettingsPage from './components/NotificationSettingsPage';
import { Globe, Rss, User as UserIcon, Bell, Moon, Sun, Monitor, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import socialLogo from './assets/images/social_logo_1780482522011.png';

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
    
    // Initial sync
    const syncTheme = (matchesDark: boolean) => {
      setIsDark(matchesDark);
      if (matchesDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.backgroundColor = '#000000';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.backgroundColor = '#f4f4f5';
      }
    };

    syncTheme(mediaQuery.matches);

    // Watcher
    const handleThemeChange = (e: MediaQueryListEvent) => {
      syncTheme(e.matches);
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

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
              notificationSettings: data.notificationSettings || { newPost: true, newReaction: true, newComment: true }
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
        <span className="text-xs font-semibold text-lime-400 mt-6 tracking-wide animate-pulse font-myanmar">
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
                className="w-7 h-7 object-contain shrink-0 transition duration-300 hover:scale-110"
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
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden min-w-0 bg-zinc-50 dark:bg-black">
        {/* Top Header inside main view */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between px-6 sm:px-8 bg-white/70 dark:bg-black/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center space-x-3">
            {/* Show tiny logo for mobile devices when vertical sidebar gets collapsed */}
            <div className="md:hidden flex items-center space-x-2">
              <img 
                src={socialLogo} 
                alt="Logo" 
                className="w-8 h-8 object-contain shrink-0"
              />
              <span className="font-myanmar font-black text-sm bg-gradient-to-r from-lime-600 via-emerald-600 to-green-600 dark:from-lime-400 dark:via-emerald-400 dark:to-green-400 bg-clip-text text-transparent leading-relaxed drop-shadow-[0_1px_4px_rgba(132,204,22,0.15)]">
                {MM.appName}
              </span>
            </div>
            
            <h2 id="current-viewport-title" className="hidden md:block text-lg font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {activeTab === 'feed' && MM.navFeed}
              {activeTab === 'profile' && MM.navProfile}
              {activeTab === 'notifications' && MM.navNotifications}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            {profile && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-none text-xs font-semibold">
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  className="w-5 h-5 rounded-none border border-zinc-200 dark:border-zinc-800 object-cover shrink-0"
                />
                <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[100px]">
                  {profile.displayName}
                </span>
              </div>
            )}
            
            <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-none border border-zinc-200 dark:border-zinc-800">
              {isDark ? (
                <Moon className="w-4 h-4 text-lime-450 dark:text-lime-400" />
              ) : (
                <Sun className="w-4 h-4 text-lime-600" />
              )}
            </div>
          </div>
        </header>

        {/* Central Feed/Page content container */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 mb-24 md:mb-12">
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
            className="w-full mt-4 py-2 bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200/60 dark:border-zinc-800 rounded-none text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-lime-500 hover:text-lime-600 transition duration-200 cursor-pointer"
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
            </div>
          </div>
        </div>
      </aside>

      {/* Bottom Floating Navigation for Mobile screens */}
      <footer id="app-mobile-footer" className="md:hidden fixed bottom-4 left-4 right-4 z-40">
        <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur border border-zinc-200/50 dark:border-zinc-900 rounded-none h-16 pointer-events-auto shadow-2xl flex items-center justify-around px-2">
          
          <button
            id="mobile-nav-feed"
            onClick={() => setActiveTab('feed')}
            className={`flex flex-col items-center justify-center py-1.5 w-16 rounded-none transition ${
              activeTab === 'feed' ? 'text-lime-600 font-bold scale-105' : 'text-zinc-500'
            }`}
          >
            <Rss className="w-5 h-5 md:w-5.5 md:h-5.5" />
            <span className="text-[9px] font-black mt-1">{MM.navFeed}</span>
          </button>
 
          <button
            id="mobile-nav-profile"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center py-1.5 w-16 rounded-none transition ${
              activeTab === 'profile' ? 'text-lime-600 font-bold scale-105' : 'text-zinc-500'
            }`}
          >
            <UserIcon className="w-5 h-5 md:w-5.5 md:h-5.5" />
            <span className="text-[9px] font-black mt-1">{MM.navProfile}</span>
          </button>
 
          <button
            id="mobile-nav-notifications"
            onClick={() => setActiveTab('notifications')}
            className={`flex flex-col items-center justify-center py-1.5 w-16 rounded-none transition ${
              activeTab === 'notifications' ? 'text-lime-600 font-bold scale-105' : 'text-zinc-500'
            }`}
          >
            <Bell className="w-5 h-5 md:w-5.5 md:h-5.5" />
            <span className="text-[9px] font-black mt-1">{MM.navNotifications}</span>
          </button>

        </div>
      </footer>

    </div>
  );
}
