import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Info, 
  ShieldCheck, 
  Send, 
  Smile, 
  ChevronLeft, 
  ChevronRight,
  Clipboard,
  Check,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function MorePage() {
  const [activeSubTab, setActiveSubTab] = useState<'slang' | 'ai' | 'about' | 'privacy' | 'help' | null>(null);
  const [helpMessage, setHelpMessage] = useState('');
  const [isSendingHelp, setIsSendingHelp] = useState(false);
  const [helpSuccess, setHelpSuccess] = useState(false);

  // AI Chat States
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'model'; content: string }>>([
    {
      role: 'model',
      content: "Hi,I am your Pauk AI Partner!"
    }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Word/Character count limit of 30 (treating each character as a unit, e.g. Apple = 5, banana = 6)
  const wordCount = chatInput.length;
  const isOverLimit = wordCount > 30;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 30) {
      setChatInput(value);
    } else {
      setChatInput(value.slice(0, 30));
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeSubTab === 'ai') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeSubTab]);

  // Run AI query
  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || aiLoading || isOverLimit) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setAiLoading(true);

    try {
      // Fetch response from Express backend Gemini chat route
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: chatHistory
        })
      });

      if (!response.ok) {
        throw new Error("Local dev server error or offline mode");
      }

      const data = await response.json();
      setChatHistory(prev => [...prev, { role: 'model', content: data.text || "Sorry, I couldn't understand that." }]);
    } catch (err) {
      console.error(err);
      // Fallback answers in case Gemini API is offline/unavailable or key is mock
      setTimeout(() => {
        let fallbackAnswer = "Mingalarpar! I'm here but experiencing a slight network connection issue. Let's chat anyway! What can I help you find? 😊";
        if (userMsg.toLowerCase().includes('bae')) {
          fallbackAnswer = "Bae is derived from English Bae. It's Myanmar youth slang for your sweetheart or lover! 💕 E.g. 'Bae lay ko Lwan nay p' (I am missing my Bae).";
        } else if (userMsg.toLowerCase().includes('gyin')) {
          fallbackAnswer = "Gyin (ဂျင်) is Myanmar slang for getting scammed or getting bad advice! E.g. 'Nga tot gyin mi thwar p' (We got trapped/scammed). Be careful with Gyin!";
        } else if (userMsg.toLowerCase().includes('fa')) {
          fallbackAnswer = "FA stands for Forever Alone! Singles who celebrate singlehood lovingly on Pauk Pauk. Don't worry, you'll find your destined Bae soon! 😊";
        }
        setChatHistory(prev => [...prev, { role: 'model', content: fallbackAnswer }]);
      }, 1000);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSendHelp = async () => {
    if (!helpMessage.trim() || isSendingHelp) return;
    setIsSendingHelp(true);
    setHelpSuccess(false);
    try {
      const supportColRef = collection(db, 'support');
      const payload: { message: string; createdAt: any; userId?: string } = {
        message: helpMessage.trim(),
        createdAt: serverTimestamp()
      };
      if (auth.currentUser?.uid) {
        payload.userId = auth.currentUser.uid;
      }
      await addDoc(supportColRef, payload);
      setHelpMessage('');
      setHelpSuccess(true);
    } catch (err) {
      console.error("Failed to send help ticket anonymously:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'support/auto_id');
      } catch (firestoreErr) {
        alert("Failed to send support request automatically. Please try again later.");
      }
    } finally {
      setIsSendingHelp(false);
    }
  };

  return (
    <div id="more-page-root" className="max-w-4xl mx-auto px-4 py-8">
      <AnimatePresence mode="wait">
        {activeSubTab === null ? (
          <motion.div
            key="chatgpt-extra-menu"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-xl mx-auto"
          >
            {/* Elegant list items stack */}
            <div className="bg-white dark:bg-zinc-900 rounded-none border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800 shadow-sm">
              
              {/* 1. Pauk Course Option */}
              <button
                id="more-menu-slang"
                onClick={() => setActiveSubTab('slang')}
                className="w-full flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-none bg-lime-500/10 text-lime-500 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-800">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">
                      Pauk Course
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 2. Pauk AI Partner Option */}
              <button
                id="more-menu-ai"
                onClick={() => setActiveSubTab('ai')}
                className="w-full flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-none bg-lime-500/10 text-lime-500 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-800">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">
                      Pauk AI Partner
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 3. About App Option */}
              <button
                id="more-menu-about"
                onClick={() => setActiveSubTab('about')}
                className="w-full flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-955 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-none bg-lime-500/10 text-lime-500 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-800">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">
                      About App
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 4. Privacy & Policy Option */}
              <button
                id="more-menu-privacy"
                onClick={() => setActiveSubTab('privacy')}
                className="w-full flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-955 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-none bg-lime-500/10 text-lime-500 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-800">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">
                      Privacy & Policy
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 5. Help Option */}
              <button
                id="more-menu-help"
                onClick={() => setActiveSubTab('help')}
                className="w-full flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-955 transition text-left cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-none bg-lime-500/10 text-lime-500 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-800">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">
                      Help
                    </h3>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

            </div>
          </motion.div>
        ) : (
          <motion.div
            key="sub-page-wrapper"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Elegant flat header with navigation back */}
            <div id="sub-page-back-navbar" className="flex items-center gap-3.5 mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
              <button
                id="more-back-btn"
                onClick={() => setActiveSubTab(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-105 dark:hover:bg-zinc-800 hover:text-zinc-955 dark:hover:text-zinc-100 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-lime-500 shrink-0" />
                Back to Menu
              </button>
            </div>

            {/* PAUK COURSE SUB-PAGE (FORMERLY SLANG LIBRARY) */}
            {activeSubTab === 'slang' && (
              <motion.div
                key="pauk-course"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-zinc-900 rounded-none p-8 md:p-12 border border-zinc-200 dark:border-zinc-800 text-center space-y-4 shadow-sm max-w-xl mx-auto my-6">
                  <div className="w-12 h-12 rounded-none bg-lime-500/10 text-lime-500 flex items-center justify-center mx-auto border border-zinc-200/60 dark:border-zinc-800">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                      Pauk Course
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                      Our interactive language courses and study materials are currently being designed. Excellent learning guides will be added here soon, stay tuned!
                    </p>
                  </div>
                  <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800/80 text-[10px] text-zinc-400 font-bold tracking-wider uppercase">
                    Coming Soon
                  </div>
                </div>
              </motion.div>
            )}

            {/* AI CHAT PANEL */}
            {activeSubTab === 'ai' && (
              <motion.div
                key="pauk-ai-partner"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-none border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm flex flex-col h-[380px]"
              >
                {/* Messages Panel */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-zinc-50/20 dark:bg-zinc-955/20">
                  {chatHistory.map((msg, index) => {
                    const isModel = msg.role === 'model';
                    return (
                      <div 
                        key={index}
                        className={`flex gap-3 max-w-xl ${isModel ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                      >
                        <div className={`w-8 h-8 rounded-none flex items-center justify-center shrink-0 border ${
                          isModel 
                            ? 'bg-lime-500/10 border-zinc-200 dark:border-zinc-800 text-lime-500' 
                            : 'bg-zinc-950 dark:bg-zinc-100 border-zinc-950 dark:border-zinc-50 text-white dark:text-zinc-950'
                        }`}>
                          {isModel ? <Sparkles className="w-4 h-4" /> : <Smile className="w-4 h-4" />}
                        </div>
                        <div className={`rounded-none p-3.5 text-xs shadow-flat leading-relaxed relative border ${
                          isModel 
                            ? 'bg-zinc-50 dark:bg-zinc-900 text-zinc-850 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800' 
                            : 'bg-lime-500/10 text-zinc-900 dark:text-lime-300 border-lime-200 dark:border-lime-900/40 font-semibold'
                        }`}>
                          <p className="whitespace-pre-line">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}

                  {aiLoading && (
                    <div className="flex gap-3 max-w-xl mr-auto">
                      <div className="w-8 h-8 rounded-none bg-lime-500/10 text-lime-550 border border-zinc-200 dark:border-zinc-805 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 animate-spin" />
                      </div>
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 rounded-none p-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-none bg-lime-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-none bg-lime-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-none bg-lime-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat Form */}
                <form 
                  onSubmit={handleSendAiMessage}
                  className="px-2 py-1 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-955 flex items-center gap-1.5 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => setChatHistory([{ role: 'model', content: "Hi,I am your Pauk AI Partner!" }])}
                    title="Delete Chat History"
                    className="p-1.5 rounded-none bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 border border-zinc-200 dark:border-zinc-800 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition cursor-pointer shrink-0 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="relative flex-1 flex items-center">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={handleInputChange}
                      maxLength={30}
                      placeholder="Ask me anything..."
                      className={`w-full bg-white dark:bg-zinc-955 text-xs text-zinc-900 dark:text-zinc-50 pl-3 pr-16 py-1 rounded-none border focus:outline-none focus:ring-1 ${
                        wordCount >= 30 
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/25 text-red-600 dark:text-red-400 font-medium' 
                          : 'border-zinc-200 dark:border-zinc-800 focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20'
                      }`}
                    />
                    {chatInput.length > 0 && (
                      <span className={`absolute right-2.5 text-[10px] font-black select-none ${
                        wordCount >= 30 ? 'text-red-500 animate-pulse' : 'text-zinc-400 dark:text-zinc-500'
                      }`}>
                        {wordCount}/30
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || aiLoading || isOverLimit}
                    className="p-1.5 rounded-none bg-lime-500 text-zinc-950 hover:bg-lime-600 disabled:opacity-30 disabled:cursor-not-allowed border border-lime-600/20 font-bold transition cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </motion.div>
            )}

            {/* ABOUT APP PANEL */}
            {activeSubTab === 'about' && (
              <motion.div
                key="about-app"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-zinc-900 rounded-none p-6 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm">
                  <div className="space-y-4 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium font-sans">
                    <section className="space-y-1">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">1. Last Updated</h3>
                      <p>June 6, 2026</p>
                    </section>

                    <section className="space-y-1 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">2. Overview</h3>
                      <p>
                        Pauk Pauk is a social platform created to help people connect, share ideas, and express their creativity in a welcoming digital community.
                      </p>
                    </section>

                    <section className="space-y-1 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">3. Features</h3>
                      <p>
                        Users can share posts, photos, comments, and engage with others through meaningful interactions. Pauk AI Partner is also available to provide AI-powered assistance and enhance the user experience.
                      </p>
                    </section>

                    <section className="space-y-1 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">4. Our Mission</h3>
                      <p>
                        Our mission is to build a simple, enjoyable, and community-focused platform where people can discover, create, and grow together.
                      </p>
                    </section>

                    <section className="space-y-1 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">5. Developer</h3>
                      <p>
                        Pauk Pauk was designed and developed by Fimtty (Nix) with a vision of creating a modern space that encourages connection, creativity, and self-expression.
                      </p>
                    </section>
                  </div>

                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 text-right text-[10px] text-zinc-400 font-sans">
                    <span>© 2026 Pauk Pauk Social. All rights reserved.</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PRIVACY & POLICY PANEL */}
            {activeSubTab === 'privacy' && (
              <motion.div
                key="privacy-policy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-zinc-900 rounded-none p-6 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm">

                  <div className="space-y-4 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    <section className="space-y-1">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">1. Our Commitment</h3>
                      <p>
                        Your privacy is important to us. Pauk Pauk uses secure technologies, encrypted storage, and trusted cloud services to protect your information.
                      </p>
                    </section>

                    <section className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">2. Information We Collect</h3>
                      <p>
                        We may collect:
                      </p>
                      <ul className="list-disc pl-5 space-y-1.5 text-zinc-600 dark:text-zinc-400 font-medium">
                        <li>Profile information (name, bio, avatar)</li>
                        <li>Posts, photos, comments, and reactions</li>
                        <li>Basic device and usage information</li>
                      </ul>
                    </section>

                    <section className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">3. AI Services</h3>
                      <p>
                        When using Pauk AI Partner, messages may be processed through Google GenAI services. We do not share your passwords, authentication credentials, or private contacts with AI models.
                      </p>
                    </section>

                    <section className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">4. Data Security</h3>
                      <p>
                        User data is protected by secure Firebase and Cloud Firestore security rules. Only authorized users can access, modify, or delete their own content.
                      </p>
                    </section>

                    <section className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 text-xs">5. Your Control</h3>
                      <p>
                        You may update or delete your content and account information at any time.
                      </p>
                    </section>
                  </div>

                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1.5 font-bold text-lime-600 dark:text-lime-400">
                      <ShieldCheck className="w-3.5 h-3.5" /> Security for users 80%
                    </span>
                    <span>© 2026 Pauk Pauk Social. All rights reserved.</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* HELP SUB-PAGE */}
            {activeSubTab === 'help' && (
              <motion.div
                key="help-sub-page"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-zinc-900 rounded-none p-6 border border-zinc-200 dark:border-zinc-800 space-y-5 shadow-sm max-w-xl mx-auto">
                  {helpSuccess ? (
                    <div className="p-6 text-center space-y-4">
                      <div className="w-12 h-12 rounded-none bg-lime-500/10 text-lime-500 flex items-center justify-center mx-auto border border-zinc-200/60 dark:border-zinc-800">
                        <Check className="w-6 h-6 animate-bounce" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Message Sent Securely</h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Thank you! Your support request or feedback has been sent anonymously to the Pauk Pauk Team.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHelpSuccess(false)}
                        className="text-xs font-bold text-lime-600 dark:text-lime-400 hover:underline cursor-pointer focus:outline-none"
                      >
                        Send another request
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        Type your support request or question below.
                      </p>

                      <div className="space-y-2">
                        <label htmlFor="help-textarea" className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-left">
                          Your Message
                        </label>
                        <textarea
                          id="help-textarea"
                          value={helpMessage}
                          onChange={(e) => setHelpMessage(e.target.value)}
                          placeholder="Type what you need help with (e.g. login issue, feedback...)"
                          rows={4}
                          className="w-full bg-white dark:bg-zinc-955 text-xs text-zinc-900 dark:text-zinc-50 p-3.5 rounded-none border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20 resize-none text-left"
                          disabled={isSendingHelp}
                        />
                      </div>

                      <button
                        onClick={handleSendHelp}
                        disabled={!helpMessage.trim() || isSendingHelp}
                        className="w-full py-2.5 px-4 rounded-none bg-lime-500 text-zinc-950 font-bold hover:bg-lime-600 disabled:opacity-40 disabled:cursor-not-allowed border border-lime-600/20 text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Send className="w-4 h-4 animate-pulse" />
                        {isSendingHelp ? 'Sending Message...' : 'Sent to Pauk Pauk Team'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
