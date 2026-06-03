import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { MM } from '../lib/locale';
import { LogIn, Sparkles, Globe, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import socialLogo from '../assets/images/social_logo_1780482522011.png';

interface LoginProps {
  onLoginStart: () => void;
  onLoginError: (err: string) => void;
  error?: string | null;
}

export default function Login(props: LoginProps) {
  const { onLoginStart, onLoginError, error } = props;
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    onLoginStart();
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      // Friendly, clean error reporting
      onLoginError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4 relative overflow-hidden">
      {/* Decorative background grid and lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(132,204,22,0.15),rgba(0,0,0,0))]" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-lime-600/5 rounded-none blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800/80 rounded-none p-8 shadow-2xl relative z-10"
      >
        {/* App Title & Slogan */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-24 h-24 rounded-none flex items-center justify-center mb-4 transition duration-300 hover:scale-105 select-none">
            <img 
              id="login-app-logo"
              src={socialLogo} 
              alt="ပေါက်ပေါက်ဖောက်ရန် Logo" 
              className="w-24 h-24 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-4xl font-myanmar font-black tracking-normal leading-relaxed bg-gradient-to-r from-lime-400 via-emerald-300 to-green-400 bg-clip-text text-transparent filter drop-shadow-[0_2px_8px_rgba(132,204,22,0.3)]">
            {MM.appName}
          </h1>
          <span className="text-[11px] text-lime-400 font-bold tracking-wide mt-2.5 mb-3 bg-lime-950/20 px-3 py-0.5 rounded-none border border-lime-800/30">
            Myanmar Social Net
          </span>
          <p className="text-sm text-zinc-400 max-w-xs leading-relaxed px-2 font-sans">
            {MM.appSlogan}
          </p>
        </div>

        {/* Content Box */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-base font-bold text-zinc-200">
              {MM.loginTitle}
            </h2>
            <p className="text-xs text-zinc-500 px-4 mt-1">
              {MM.loginSubtitle}
            </p>
          </div>

          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 px-6 bg-lime-600 hover:bg-lime-500 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white font-bold rounded-none shadow-lg flex items-center justify-center space-x-2.5 transition-all duration-200 cursor-pointer border border-lime-700"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs font-semibold">{MM.loggingIn}</span>
              </span>
            ) : (
              <>
                <LogIn className="w-4.5 h-4.5 stroke-[2]" />
                <span className="text-sm">{MM.continueWithGoogle}</span>
              </>
            )}
          </button>

          {/* Diagnostic assistance for any Google Login failures */}
          {error && (
            <div className="mt-4 p-4 bg-red-950/40 border border-red-900/50 rounded-none text-xs text-red-200 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="font-bold flex items-center gap-1.5 text-red-400">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span>Authentication Error</span>
              </div>
              <p className="leading-relaxed font-sans">{error}</p>
              
              {(error.includes('unauthorized-domain') || error.includes('auth/unauthorized-domain') || window.location.hostname.includes('vercel.app')) && (
                <div className="bg-black/40 p-2.5 border border-zinc-800/50 mt-2 space-y-1.5 font-sans text-[11px] text-zinc-300">
                  <p className="font-semibold text-lime-400">How to fix this in Vercel / Live Deployment:</p>
                  <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                    <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline text-lime-400 hover:text-lime-300">Firebase Console</a></li>
                    <li>Select your project, click <strong>Authentication</strong></li>
                    <li>Go to <strong>Settings</strong> tab &rarr; <strong>Authorized domains</strong></li>
                    <li>Add <code className="bg-zinc-800 px-1 text-zinc-200 rounded">{window.location.hostname}</code> to the list</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
