import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Copy, History, Key, Layout, MessageCircle, Plus, RefreshCcw, Send, Settings, Trash2, TrendingUp, Trophy, User, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";

// Initialization for Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface HistoryItem {
  issueNumber: string;
  number: string;
  colour: string;
  premium: string;
}

interface Prediction {
  bigSmall: 'BIG' | 'SMALL';
  colour: 'GREEN' | 'RED';
  number: number;
  confidence: number;
  patternType: string;
}

const TELEGRAM_URL = "https://t.me/bwmoney100201";

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pastPredictions, setPastPredictions] = useState<Record<string, Prediction>>({});
  const [stats, setStats] = useState({ wins: 0, losses: 0 });
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [nextIssue, setNextIssue] = useState<string>('');
  const [isPending, setIsPending] = useState(false);
  const [lastCountedIssue, setLastCountedIssue] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showHack, setShowHack] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    historyDepth: 15,
    emaPeriod: 5,
    autoRefresh: true
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [keys, setKeys] = useState<Record<string, { createdAt: string; type: string }>>(() => {
    const saved = localStorage.getItem('sovereign_keys');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('sovereign_keys', JSON.stringify(keys));
  }, [keys]);

  const generateNewKey = () => {
    const newKey = 'KEY-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setKeys(prev => ({
      ...prev,
      [newKey]: { 
        createdAt: new Date().toLocaleString(),
        type: 'Temporary'
      }
    }));
  };

  const deleteKey = (keyToDelete: string) => {
    setKeys(prev => {
      const newKeys = { ...prev };
      delete newKeys[keyToDelete];
      return newKeys;
    });
  };

  const GAME_URL = "https://bigwingame.win/#/register?invitationCode=66347100201";

  const getBigSmall = (numStr: string) => {
    const num = parseInt(numStr);
    return num >= 5 ? 'BIG' : 'SMALL';
  };

  const checkWin = useCallback((item: HistoryItem) => {
    const pred = pastPredictions[item.issueNumber];
    if (!pred) return null;

    const actualSize = getBigSmall(item.number);
    
    // Win logic strictly depends on BIG/SMALL as per user request
    return actualSize === pred.bigSmall;
  }, [pastPredictions]);

  // Update Stats when history changes
  useEffect(() => {
    if (history.length > 0) {
      const latest = history[0];
      // Prevent duplicate counting for the same issue
      if (latest.issueNumber === lastCountedIssue) return;

      const result = checkWin(latest);
      if (result !== null) {
        setStats(prev => ({
          wins: result ? prev.wins + 1 : prev.wins,
          losses: !result ? prev.losses + 1 : prev.losses
        }));
        setLastCountedIssue(latest.issueNumber);
        
        // Clean up old predictions to prevent memory leak
        setPastPredictions(prev => {
          const keys = Object.keys(prev);
          if (keys.length > 50) {
            const newPrev = { ...prev };
            const oldestKey = keys[0];
            delete newPrev[oldestKey];
            return newPrev;
          }
          return prev;
        });
      }
    }
  }, [history, checkWin, lastCountedIssue]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Using the EXACT WORKING PARAMETERS provided by the user to ensure 100% connectivity
      const response = await axios.post('/api/proxy-bigwin', {
        pageSize: 10,
        pageNo: 1,
        typeId: 1,
        language: 7,
        random: "25138ac2fb2b4330a4f7648c0315b433",
        signature: "A6D2DF13153C3452700CD5DFA3EA3BF3",
        timestamp: 1776752539
      });

      if (response.data.code === 0 && response.data.data && response.data.data.list) {
        const newList = response.data.data.list;
        // Only update if history is different
        if (JSON.stringify(newList) !== JSON.stringify(history)) {
          setHistory(newList);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      } else {
        console.warn('API returned non-zero code or empty list:', response.data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  }, [history]);

  const handlePredict = useCallback(async (currentHistory: HistoryItem[]) => {
    if (currentHistory.length === 0) return;
    
    const latestIssue = currentHistory[0]?.issueNumber;
    const calculatedNext = (BigInt(latestIssue) + 1n).toString();
    
    // BREAKING: Avoid double-prediction for same issue to prevent "jumping"
    if (prediction && nextIssue === calculatedNext && !predicting) {
      return;
    }
    
    setPredicting(true);
    try {
      setNextIssue(calculatedNext);
      
      // Technical Indicator Calculations based on Settings
      const sample = currentHistory.slice(0, settings.historyDepth);
      const numbers = sample.map(h => parseInt(h.number));
      
      // 1. EMA (Exponential Moving Average)
      const k = 2 / (settings.emaPeriod + 1);
      let ema = numbers[0];
      for(let i = 1; i < numbers.length; i++) {
        ema = numbers[i] * k + ema * (1 - k);
      }

      // 2. Relative Strength Index (RSI) concept for BI-BI Trend
      const binaryTrend = sample.map(h => parseInt(h.number) >= 5 ? 1 : 0);
      let gains = 0;
      let losses = 0;
      for (let i = 0; i < binaryTrend.length - 1; i++) {
        const diff = binaryTrend[i] - binaryTrend[i+1];
        if (diff > 0) gains += diff;
        else losses -= diff;
      }
      const rs = gains / (losses || 1);
      const rsi = 100 - (100 / (1 + rs));

      // Analyze history based on depth setting
      const historySummary = currentHistory.slice(0, settings.historyDepth).map(h => 
        `Issue: ...${h.issueNumber.slice(-4)}, No: ${h.number}, Size: ${getBigSmall(h.number)}, Col: ${h.colour}`
      ).join('\n');
      
      const prompt = `
        System: Sovereign Intelligence Pattern Recognition Engine
        Game: Win-Go 1 Minute
        Dataset (Last ${settings.historyDepth} Results):
        ${historySummary}

        Technical Indicators:
        - EMA (${settings.emaPeriod}-period): ${ema.toFixed(2)}
        - RSI (Bias): ${rsi.toFixed(2)}

        Deep Analysis Requirements:
        1. Hidden Markov Model (HMM): Estimate latent game states based on high-order transitions.
        2. Sequence Overfitting Check: Validate momentum against historical mean-reversion metrics.
        3. Harmonic Pattern Detection: identify periodic parity shifts and cyclical bias.
        4. Trans Dimensional Mapping: Cross-correlate color streaks with size probability clusters.
        5. Quantum Probability Field: Analyze pseudo-random distribution for entropy gaps.

        Task: Synthesize patterns and predict outcome for Issue: ${calculatedNext.slice(-4)}.
        
        Strict JSON Output:
        {
          "bigSmall": "BIG" | "SMALL",
          "colour": "RED" | "GREEN",
          "number": integer 0-9,
          "confidence": float 0.0-1.0,
          "patternType": "Dragon streak" | "Alternating" | "State Pivot" | "HMM Reversion" | "EMA Bounce" | "RSI Overbought"
        }
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      if (result && result.text) {
        const text = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const predictionData: Prediction = JSON.parse(text);
        
        setPrediction(predictionData);
        setPastPredictions(prev => ({
          ...prev,
          [calculatedNext]: predictionData
        }));
      } else {
        throw new Error('Empty result from AI');
      }
    } catch (error) {
      console.error('AI Analysis failed, shifting to Sovereign Fallback:', error);
      
      const latestFromState = history[0]?.issueNumber;
      const computedNext = (BigInt(latestFromState || '0') + 1n).toString();
      setNextIssue(computedNext);
      
      const sample = history.slice(0, 15);
      const sizes = sample.map(h => getBigSmall(h.number)).reverse(); 
      const colors = sample.map(h => h.colour.includes('red') ? 'RED' : 'GREEN').reverse();
      
      // 1. Hidden State Estimation (Latent Pattern Detection)
      // We simulate HMM by checking the 'stability' of the last 5 vs last 15
      const recent5 = sizes.slice(-5);
      const isRecentStable = recent5.every(v => v === recent5[0]);
      
      // 2. Markov Order-1 Transition
      const lastSize = sizes[sizes.length - 1];
      let transitionsToSmall = 0;
      let transitionsToBig = 0;
      for (let i = 0; i < sizes.length - 1; i++) {
        if (sizes[i] === lastSize) {
          if (sizes[i+1] === 'SMALL') transitionsToSmall++;
          else transitionsToBig++;
        }
      }
      
      // Rolling Stats
      const numbers = sample.map(h => parseInt(h.number));
      const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
      const variance = numbers.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numbers.length;
      
      // DECISION LOGIC (HMM Influenced)
      let predSize: 'BIG' | 'SMALL';
      if (isRecentStable && recent5.length >= 4) {
        // High stability streak -> HMM Latent State "Trending" -> Expect Reversion or Continuation
        predSize = (recent5[0] === 'BIG') ? 'SMALL' : 'BIG'; // Bold Reversion
      } else {
        const totalTrans = transitionsToSmall + transitionsToBig;
        if (totalTrans > 0 && transitionsToSmall / totalTrans > 0.6) predSize = 'SMALL';
        else if (totalTrans > 0 && transitionsToBig / totalTrans > 0.6) predSize = 'BIG';
        else predSize = (mean >= 5) ? 'SMALL' : 'BIG';
      }
      
      // Color Logic (Sequence Probability)
      const lastCol = colors[colors.length - 1];
      let colFlips = 0;
      for (let i = 0; i < colors.length - 1; i++) {
        if (colors[i] !== colors[i+1]) colFlips++;
      }
      
      let predCol: 'RED' | 'GREEN';
      if (colFlips / colors.length > 0.55) {
        predCol = lastCol === 'RED' ? 'GREEN' : 'RED'; // Counter-trend
      } else {
        predCol = lastCol === 'RED' ? 'RED' : 'GREEN'; // Trend follow
      }
      
      // Number indexing with noise reduction
      let predNum: number;
      const offset = Math.round(variance % 4);
      if (predSize === 'BIG') {
        predNum = [5, 6, 7, 8, 9][(Math.round(mean) + offset) % 5];
      } else {
        predNum = [0, 1, 2, 3, 4][(Math.round(mean) + offset) % 5];
      }
      
      const fallbackPred: Prediction = {
        bigSmall: predSize,
        colour: predCol,
        number: isNaN(predNum) ? (predSize === 'BIG' ? 9 : 0) : predNum,
        confidence: 0.82,
        patternType: "Sovereign Fallback"
      };
      
      setPrediction(fallbackPred);
      setPastPredictions(prev => ({
          ...prev,
          [computedNext]: fallbackPred
      }));
    } finally {
      setPredicting(false);
    }
  }, [history, prediction, nextIssue, predicting, settings]);

  // AUTO PREDICTION EFFECT
  useEffect(() => {
    if (history.length > 0) {
      handlePredict(history);
    }
  }, [history, handlePredict]);

  // COUNTDOWN EFFECT
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const seconds = now.getSeconds();
      const remaining = 60 - seconds;
      setTimeLeft(remaining);
      
      // Handle Pending State (Result verification gap)
      if (remaining <= 5 || remaining >= 58) {
        setIsPending(true);
      } else {
        setIsPending(false);
      }
      
      // Auto fetch logic controlled by settings
      if (remaining === 59 && settings.autoRefresh) {
        setTimeout(fetchHistory, 2000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchHistory]);

  useEffect(() => {
    if (settings.autoRefresh) {
      fetchHistory();
      const interval = setInterval(fetchHistory, 15000);
      return () => clearInterval(interval);
    }
  }, [fetchHistory, settings.autoRefresh]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const isMasterKey = password === "MGTHANT";
    const isGeneratedKey = Object.keys(keys).includes(password);

    if (isMasterKey || isGeneratedKey) {
      setIsLoggedIn(true);
      setIsAdmin(isMasterKey); // Only master key gets admin rights
      setLoginError('');
    } else {
      setLoginError('Invalid access key');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-[#121418] border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-tighter">Sovereign Intel</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Quantum Prediction Matrix</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Access Key</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Key..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              {loginError && <p className="text-red-500 text-[10px] font-bold uppercase px-1">{loginError}</p>}
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-[10px] font-black text-white uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Initialize Session
            </button>
          </form>

          <p className="text-center mt-8 text-[9px] text-gray-600 font-bold uppercase tracking-widest">
            Restricted Access • Sovereign Intelligence
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0c]">
      {/* Web View (Game Iframe) */}
      <iframe 
        src={GAME_URL}
        className="w-full h-full border-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]"
        title="Bigwin Game"
        allow="fullscreen"
      />

      {/* Game Iframe */}

      {/* Floating Prediction Launcher - Draggable */}
      <motion.div 
        drag
        dragMomentum={false}
        dragElastic={0.1}
        className="fixed top-4 right-4 z-[500] flex flex-col items-end gap-3"
        whileDrag={{ scale: 1.1 }}
      >
        <motion.a 
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.1, rotate: -10 }}
          whileTap={{ scale: 0.9 }}
          className="group relative flex items-center justify-center p-0 m-0"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-tr from-[#0088cc] to-[#00aaff] shadow-xl border border-white/20 relative overflow-hidden">
            <Send className="w-5 h-5 text-white -rotate-12 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
          <div className="absolute -top-2 -right-1 px-1.5 py-0.5 bg-white text-[#0088cc] text-[7px] font-black rounded-full shadow-lg border border-[#0088cc]/20 uppercase tracking-tighter">
            JOIN
          </div>
        </motion.a>

        {isAdmin && (
          <motion.button
            whileHover={{ scale: 1.1, rotate: 15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAdminPanel(true)}
            className="w-10 h-10 rounded-xl bg-[#1a1a1e] border border-white/10 flex items-center justify-center text-gray-500 hover:text-indigo-400 shadow-xl"
          >
            <Layout size={18} />
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.1, rotate: 15 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-xl bg-[#1a1a1e] border border-white/10 flex items-center justify-center text-gray-500 hover:text-indigo-400 shadow-xl"
        >
          <Settings size={18} />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05, filter: 'brightness(1.2)' }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowHack(!showHack)}
          className={`
            w-16 h-16 rounded-2xl flex items-center justify-center 
            bg-gradient-to-tr from-[#1a1a1e] to-[#2a2a30]
            shadow-[0_10px_25px_rgba(0,0,0,0.5),0_0_20px_rgba(139,92,246,0.3)]
            border border-white/10 relative group cursor-grab active:cursor-grabbing
          `}
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative flex flex-col items-center justify-center">
            <Brain className={`transition-all duration-500 ${predicting ? 'w-8 h-8 text-indigo-400 animate-pulse' : prediction ? 'w-5 h-5 text-indigo-500/40 mb-0.5' : 'w-8 h-8 text-indigo-500'}`} />
            
            {prediction && !predicting && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-[10px] font-black italic tracking-tighter leading-none ${prediction.bigSmall === 'BIG' ? 'text-indigo-400' : 'text-blue-400'}`}
              >
                {prediction.bigSmall}
              </motion.div>
            )}
          </div>
          
          {/* Status Dot */}
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
          
          <AnimatePresence>
            {!showHack && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-10 right-0 bg-indigo-600 text-[10px] font-black py-1 px-3 rounded-md shadow-lg border border-indigo-400/50 whitespace-nowrap pointer-events-none uppercase tracking-tighter"
              >
                Auto Hack Active
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Hack Sidebar / Modal (Slimmer & Modern) */}
      <AnimatePresence>
        {showHack && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-y-0 right-0 w-[320px] z-[200] p-4 pointer-events-none"
          >
            <div className="w-full h-full bg-[#0f1115]/95 backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 rounded-[2rem] flex flex-col pointer-events-auto overflow-hidden">
              <div className="relative flex-1 flex flex-col p-5">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-black tracking-tighter text-white uppercase italic">777 Predictive Engine</span>
                  </div>
                  <button 
                    onClick={() => setShowHack(false)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-500 transition-colors"
                  >
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Main Prediction UI (Automatic) */}
                <div className="bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent border border-white/10 p-5 rounded-[1.5rem] mb-4 relative overflow-hidden backdrop-blur-md">
                  <div className="absolute top-2 right-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Neural Link Active</div>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Period & Timer */}
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 px-1">
                      <div className="flex items-center gap-1.5 bg-white/5 py-1 px-2.5 rounded-full border border-white/5">
                        <History size={10} />
                        <span>Period: <span className="text-white">...{nextIssue.slice(-4)}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-indigo-500/10 py-1 px-2.5 rounded-full border border-indigo-500/20 text-indigo-300">
                        <RefreshCcw size={10} className={timeLeft < 10 ? 'animate-spin' : ''} />
                        <span>Next Draw: <span className={timeLeft < 10 ? 'text-red-400 font-black' : 'text-indigo-300'}>{timeLeft}s</span></span>
                      </div>
                    </div>
                  
                    <AnimatePresence mode="wait">
                      {isPending ? (
                        <motion.div
                          key="pending-ui"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.1 }}
                          className="h-44 flex flex-col items-center justify-center relative overflow-hidden bg-white/5 rounded-3xl border border-indigo-500/30"
                        >
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-10 opacity-10"
                          >
                             <div className="w-full h-full border-[20px] border-dashed border-indigo-500 rounded-full" />
                          </motion.div>
                          
                          <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="z-10 text-center"
                          >
                            <Brain size={48} className="text-indigo-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                            <div className="text-xl font-black text-white italic tracking-tighter uppercase mb-1">Verifying Block</div>
                            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest animate-pulse">Scanning Quantum Entropy...</div>
                          </motion.div>

                          {/* Data Stream Simulation */}
                          <div className="absolute inset-x-0 bottom-0 flex justify-around opacity-20">
                            {[1,2,3,4,5].map(i => (
                              <motion.div 
                                key={i}
                                animate={{ y: [0, -100] }}
                                transition={{ duration: 0.5 + i*0.2, repeat: Infinity, ease: "linear" }}
                                className="w-0.5 h-10 bg-indigo-400"
                              />
                            ))}
                          </div>
                        </motion.div>
                      ) : prediction ? (
                        <motion.div
                          key="prediction-data"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                            <div className="flex-1 text-center border-r border-white/5">
                              <div className="text-[8px] text-gray-500 font-black uppercase mb-1 tracking-widest">AI Target</div>
                              <motion.div 
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className={`text-3xl font-black italic tracking-tighter ${prediction.bigSmall === 'BIG' ? 'text-indigo-400' : 'text-blue-400'}`}
                              >
                                {prediction.bigSmall}
                              </motion.div>
                            </div>
                            
                            <div className="flex-[0.5] flex flex-col items-center">
                               <div className="text-[24px] font-black text-white relative">
                                 {prediction.number}
                                 <div className={`absolute -inset-2 blur-md opacity-30 ${prediction.number % 2 === 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                               </div>
                               <div className="text-[7px] text-gray-600 font-bold uppercase mt-1">Num</div>
                            </div>

                            <div className="flex-1 text-center border-l border-white/5">
                              <div className="text-[8px] text-gray-500 font-black uppercase mb-1 tracking-widest">Trend</div>
                              <div className={`text-xl font-black ${prediction.colour === 'RED' ? 'text-red-500' : 'text-green-500'}`}>
                                {prediction.colour}
                              </div>
                            </div>
                          </div>

                          {/* Pattern Badge & Confidence */}
                          <div className="flex items-center justify-between gap-2">
                             <div className="flex-1 bg-indigo-500/10 border border-indigo-500/20 py-2 px-3 rounded-xl flex items-center gap-2">
                                <Zap size={12} className="text-amber-400" />
                                <div className="text-[9px] font-black text-indigo-300 uppercase truncate">{prediction.patternType}</div>
                             </div>
                             <div className="bg-white/5 border border-white/5 py-2 px-3 rounded-xl flex items-center gap-2">
                                <Trophy size={12} className="text-indigo-400" />
                                <div className="text-[9px] font-black text-white">{Math.round(prediction.confidence * 100)}%</div>
                             </div>
                          </div>

                          <div className="text-[8px] text-center text-gray-400 italic bg-black/20 p-2 rounded-lg border border-white/5 space-y-1">
                            <div>* Technical Analysis: EMA & RSI indicators utilized for bias detection.</div>
                            <div className="text-indigo-400 font-bold uppercase tracking-widest text-[7px]" style={{ fontSize: '7px' }}>Win/Loss condition based strictly on BIG/SMALL outcome</div>
                          </div>

                          {/* Analysis Progress Bar */}
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: '100%' }}
                              transition={{ duration: 2 }}
                              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500"
                            />
                          </div>
                        </motion.div>
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 border-2 border-indigo-500/20 rounded-full" />
                            <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-indigo-500 rounded-full animate-spin" />
                          </div>
                          <div className="text-[10px] text-gray-500 font-bold italic animate-pulse">Scanning Genetic Patterns...</div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp size={12} className="text-green-400" />
                      <span className="text-[8px] text-gray-400 font-black uppercase">Wins</span>
                    </div>
                    <div className="text-sm font-black text-white">{stats.wins}</div>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap size={12} className="text-red-400" />
                      <span className="text-[8px] text-gray-400 font-black uppercase">Losses</span>
                    </div>
                    <div className="text-sm font-black text-white">{stats.losses}</div>
                  </div>
                </div>

                {/* History List (Clean & Efficient) */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <h2 className="text-[10px] font-black uppercase tracking-tighter text-gray-500">Deep Pattern History</h2>
                    {history.length > 0 && checkWin(history[0]) !== null && (
                      <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full 
                        ${checkWin(history[0]) ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        Last: {checkWin(history[0]) ? 'WIN' : 'LOSS'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                    {history.map((item) => {
                      const winStatus = checkWin(item);
                      return (
                        <div key={item.issueNumber} className="bg-white/[0.03] p-3 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-white/[0.08] transition-all duration-300">
                          <div className="flex items-center gap-3">
                            <div className="relative group-hover:scale-110 transition-transform">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-lg
                                ${item.colour.includes('green') ? 'bg-gradient-to-br from-green-500 to-green-700' : 'bg-gradient-to-br from-red-500 to-red-700'}
                              `}>
                                {item.number}
                              </div>
                              <div className={`absolute -inset-1 blur-sm opacity-20 rounded-xl ${item.colour.includes('green') ? 'bg-green-500' : 'bg-red-500'}`} />
                            </div>
                            <div>
                              <div className="text-[10px] font-black text-gray-500 leading-none mb-1 tracking-tighter">PER: {item.issueNumber.slice(-4)}</div>
                              <div className="text-[11px] font-black text-white uppercase italic leading-none flex items-center gap-1.5">
                                <span className={getBigSmall(item.number) === 'BIG' ? 'text-indigo-400' : 'text-blue-400'}>{getBigSmall(item.number)}</span>
                                <span className="text-gray-700 font-normal scale-75">|</span>
                                <span className="text-[9px] text-gray-400 font-bold opacity-60 capitalize">{item.colour.split(',')[0]}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                             {winStatus !== null ? (
                               <motion.div
                                 initial={{ scale: 0.8, opacity: 0 }}
                                 animate={{ scale: 1, opacity: 1 }}
                                 className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border
                                   ${winStatus 
                                     ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                     : 'bg-red-500/10 text-red-400 border-red-500/20'}
                                 `}
                               >
                                 {winStatus ? 'Win' : 'Loss'}
                               </motion.div>
                             ) : (
                               <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                             )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Social (Professional Design) */}
                <div className="mt-5">
                  <a
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 bg-gradient-to-r from-[#0088cc] to-[#33a1da] rounded-xl shadow-lg shadow-[#0088cc]/20 group"
                  >
                    <MessageCircle size={16} className="text-white group-hover:scale-110 transition-transform" />
                    <span className="font-black text-[10px] uppercase tracking-wider text-white">VIP Pattern Signal</span>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdminPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#0a0a0c] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-3xl rounded-full -mr-16 -mt-16" />
              
              <div className="flex justify-between items-center mb-8 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/25">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tighter text-white">Project MGTHANT</h3>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Admin Control Board</p>
                  </div>
                </div>
                <button onClick={() => setShowAdminPanel(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-3 h-3 text-yellow-500" />
                    <span className="text-[9px] font-black text-gray-400 uppercase">Total Wins</span>
                  </div>
                  <div className="text-2xl font-black text-white italic">{stats.wins}</div>
                </div>
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3 h-3 text-indigo-500" />
                    <span className="text-[9px] font-black text-gray-400 uppercase">Total Draws</span>
                  </div>
                  <div className="text-2xl font-black text-white italic">{history.length}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Active Sessions</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[11px] font-bold text-gray-300 uppercase">Current Admin</span>
                    </div>
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">Authorized</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl opacity-50">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-gray-600" />
                      <span className="text-[11px] font-bold text-gray-400 uppercase">Server Sync</span>
                    </div>
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic">Standby</span>
                  </div>
                </div>
              </div>

              {/* Key Generator Section */}
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Key Management</div>
                  <button 
                    onClick={generateNewKey}
                    className="flex items-center gap-2 py-1.5 px-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                  >
                    <Plus size={12} />
                    <span className="text-[9px] font-black uppercase">Generate Key</span>
                  </button>
                </div>

                <div className="max-h-[160px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {Object.entries(keys).length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl">
                      <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">No active keys generated</p>
                    </div>
                  ) : (
                    (Object.entries(keys) as [string, { createdAt: string; type: string }][]).map(([key, data]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold text-indigo-300 tracking-wider uppercase">{key}</span>
                          <span className="text-[8px] text-gray-600 mt-0.5">{data.createdAt}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(key);
                              // Could add a toast here
                            }}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                          >
                            <Copy size={12} />
                          </button>
                          <button 
                            onClick={() => deleteKey(key)}
                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button 
                  onClick={() => setIsLoggedIn(false)}
                  className="flex-1 py-4 border border-white/10 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-white/5 transition-colors"
                >
                  Logout
                </button>
                <button 
                  onClick={() => setShowAdminPanel(false)}
                  className="flex-[2] py-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-[10px] font-black text-white uppercase tracking-widest shadow-xl shadow-indigo-500/20"
                >
                  Return to Matrix
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-[#121418] border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500 rounded-lg">
                    <Settings className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-tighter text-white">Quantum Engine Config</h3>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* History Depth */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Analysis Depth (Last N)</label>
                    <span className="text-[10px] font-black text-indigo-400">{settings.historyDepth} Records</span>
                  </div>
                  <input 
                    type="range" min="5" max="30" step="1"
                    value={settings.historyDepth}
                    onChange={(e) => setSettings(prev => ({ ...prev, historyDepth: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* EMA Period */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase">EMA Period Weight</label>
                    <span className="text-[10px] font-black text-indigo-400">{settings.emaPeriod} Period</span>
                  </div>
                  <input 
                    type="range" min="2" max="10" step="1"
                    value={settings.emaPeriod}
                    onChange={(e) => setSettings(prev => ({ ...prev, emaPeriod: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Auto Refresh Toggle */}
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div>
                    <div className="text-[11px] font-black text-white uppercase italic">Neural Auto-Sync</div>
                    <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Real-time Data Pulling</div>
                  </div>
                  <button 
                    onClick={() => setSettings(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${settings.autoRefresh ? 'bg-indigo-600' : 'bg-white/10'}`}
                  >
                    <motion.div 
                      animate={{ x: settings.autoRefresh ? 24 : 4 }}
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
                    />
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full mt-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-[10px] font-black text-white uppercase tracking-widest shadow-xl shadow-indigo-500/20"
              >
                Apply Quantum Parameters
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
}
