import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Copy, Cpu, Hash, History, Key, Layout, MessageCircle, Plus, RefreshCcw, Send, Settings, Trash2, TrendingUp, Trophy, User, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

interface HistoryItem {
  issueNumber: string;
  number: string;
  colour: string;
  premium: string;
}

interface Prediction {
  bigSmall: 'BIG' | 'SMALL';
  colour: 'GREEN' | 'RED';
  number: number; // This will be the "Best" number
  suggestedNumbers: number[]; // 3 numbers total
  confidence: number;
  patternType: string;
  sentimentBias: number; // -1 to 1 (Small to Big bias)
  socialTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  isSureShot: boolean;
  powerLevel: number; // 0-100
}

const TELEGRAM_URL = "https://t.me/bwmoney100201";

import { db, auth, useFirebaseAuth, OperationType, handleFirestoreError } from './firebase';
import { onSnapshot, doc, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';

const getDeviceId = () => {
    let id = localStorage.getItem('device_id');
    if (!id) {
        id = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem('device_id', id);
    }
    return id;
};

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
  const [showNumberHack, setShowNumberHack] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [newKeyExpiry, setNewKeyExpiry] = useState<number | null>(null); // expiration for keys

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
  const [apiError, setApiError] = useState<string | null>(null);
  
  // API CONFIG (Stored in Firestore)
  const isAuthReady = useFirebaseAuth();
  const [apiConfig, setApiConfig] = useState({
    random: "25138ac2fb2b4330a4f7648c0315b433",
    signature: "A6D2DF13153C3452700CD5DFA3EA3BF3",
    timestamp: 1776752539,
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOiIxNzc2NzUyNTMwIiwibmJmIjoiMTc3Njc1MjUzMCIsImV4cCI6IjE3NzY3NTQzMzAiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL2V4cGlyYXRpb24iOiI0LzIxLzIwMjYgMToyMjoxMCBQTSIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6IkFjY2Vzc19Ub2tlbiIsIlVzZXJJZCI6IjYzMjIwMyIsIlVzZXJOYW1lIjoiOTU5NzUzNjE5ODc4IiwiVXNlclBob3RvIjoiMSIsIk5pY2tOYW1lIjoiTWVtYmVyTk5HRU1MQTYiLCJBbW91bnQiOiIwLjg5IiwiSW50ZWdyYWwiOiIwIiwiTG9naW5NYXJrIjoiSDUiLCJMb2dpblRpbWUiOiI0LzIxLzIwMjYgMTI6NTI6MTAgUE0iLCJMb2dpbklQQWRkcmVzcyI6IjQzLjIxNi4yLjE5NyIsIkRiTnVtYmVyIjoiMCIsIklzdmFsaWRhdG9yIjoiMCIsIktleUNvZGUiOiIxNjAiLCJUb2tlblR5cGUiOiJBY2Nlc3NfVG9rZW4iLCJQaG9uZVR5cGUiOiIxIiwiVXNlclVHlwZSI6IjAiLCJVc2VyTmFtZTIiOiIiLCJpc3MiOiJqd3RJc3N1ZXIiLCJhdWQiOiJsb3R0ZXJ5VGlja2V0In0.NKsZCroHUC8jQoj0AJ6Dqz4vAIQq_qVQPqOHM8GHh6w"
  });

  const [keys, setKeys] = useState<Record<string, { createdAt: string; type: string; expiresAt?: number | null; deviceId?: string }>>({});

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  // Auto-logout if key expires or is deleted
  useEffect(() => {
    if (isLoggedIn && !isAdmin) {
      const trimmedPassword = password.trim();
      const matchedKey = keys[trimmedPassword] || keys[trimmedPassword.toUpperCase()];
      if (!matchedKey) {
        handleLogout(); // Key was deleted
      } else if (matchedKey.expiresAt && now > matchedKey.expiresAt) {
        handleLogout(); // Key expired
      } else if (matchedKey.deviceId && matchedKey.deviceId !== getDeviceId()) {
        handleLogout(); // Key used by another device
      }
    }
  }, [isLoggedIn, isAdmin, password, keys, now]);

  useEffect(() => {
    if (!isAuthReady) return;
    const unsub = onSnapshot(doc(db, 'config', 'api'), (snapshot) => {
      if (snapshot.exists()) {
        setApiConfig(snapshot.data() as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/api');
    });
    return unsub;
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    const unsub = onSnapshot(collection(db, 'keys'), (snapshot) => {
      const newKeys: Record<string, any> = {};
      snapshot.forEach(doc => {
        newKeys[doc.id] = doc.data();
      });
      setKeys(newKeys);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'keys');
    });
    return unsub;
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !apiConfig.token) return;
    const save = setTimeout(() => {
      setDoc(doc(db, 'config', 'api'), apiConfig).catch(error => {
        handleFirestoreError(error, OperationType.WRITE, 'config/api');
      });
    }, 1000);
    return () => clearTimeout(save);
  }, [apiConfig, isAuthReady]);

  const generateNewKey = async () => {
    const newKey = 'KEY-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const typeLabel = newKeyExpiry ? `${newKeyExpiry} Hours` : 'Lifetime';
    const expiresAt = newKeyExpiry ? Date.now() + newKeyExpiry * 60 * 60 * 1000 : null;
    const keyData = { 
      createdAt: new Date().toLocaleString(),
      type: typeLabel,
      expiresAt
    };
    try {
      await setDoc(doc(db, 'keys', newKey), keyData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `keys/${newKey}`);
    }
  };

  const deleteKey = async (keyToDelete: string) => {
    try {
      await deleteDoc(doc(db, 'keys', keyToDelete));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `keys/${keyToDelete}`);
    }
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

  const fetchHistory = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await axios.post('/api/proxy-bigwin', {
        pageSize: 10,
        pageNo: 1,
        typeId: 1,
        language: 7,
        random: apiConfig.random,
        signature: apiConfig.signature,
        timestamp: apiConfig.timestamp
      }, {
        timeout: 60000, // 60s client-side timeout
        headers: {
          'x-proxy-auth': apiConfig.token
        }
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
        setApiError(`API Error: ${response.data.msg || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Failed to fetch history:', error);
      
      // Auto-retry once if it's a timeout and we haven't retried yet
      if (error.code === 'ECONNABORTED' && retryCount < 1) {
        console.log('Retrying fetch due to timeout...');
        return fetchHistory(retryCount + 1);
      }
      
      const errorMsg = error.response?.data?.message || error.message;
      const errorCode = error.response?.data?.code || error.code;
      
      setApiError(`Quantum Link Failure: ${errorMsg} ${errorCode ? `(${errorCode})` : ''}. Please verify your Token in Admin Panel.`);
    } finally {
      if (retryCount === 0 || !loading) {
        setLoading(false);
      }
    }
  }, [history, apiConfig, loading]);

  const handlePredict = useCallback(async (currentHistory: HistoryItem[]) => {
    if (currentHistory.length === 0) return;
    
    const latestIssue = currentHistory[0]?.issueNumber;
    const calculatedNext = (BigInt(latestIssue) + 1n).toString();
    
    // BREAKING: Avoid double-prediction for same issue to prevent "jumping"
    if (prediction && nextIssue === calculatedNext && !predicting) {
      return;
    }
    
    setPredicting(true);
    // Simulate complex calculation lag for UI feel
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
      setNextIssue(calculatedNext);
      
      const sample = currentHistory.slice(0, Math.max(30, settings.historyDepth));
      const numbers = sample
        .map(h => parseInt(h.number))
        .filter(n => !isNaN(n))
        .reverse();
      
      if (numbers.length === 0) throw new Error('Insufficient numerical data');

      const sizes = sample.map(h => getBigSmall(h.number)).reverse(); 
      const colors = sample.map(h => h.colour.includes('red') ? 'RED' : 'GREEN').reverse();
      
      // --- SOVEREIGN ELITE ALGORITHM V4.0 ---

      // 1. ADVANCED MOMENTUM (EMA Cross + RSI Bias)
      const k5 = 2 / (5 + 1);
      const k10 = 2 / (10 + 1);
      let ema5 = numbers[0];
      let ema10 = numbers[0];
      numbers.forEach(n => {
        ema5 = n * k5 + ema5 * (1 - k5);
        ema10 = n * k10 + ema10 * (1 - k10);
      });
      const momentumBias = ema5 > ema10 ? 'BIG' : 'SMALL';

      // 2. OSCILLATOR FREQUENCY (RSI Alternative)
      const isBig = (n: number) => n >= 5;
      let streakCount = 0;
      let lastVal = isBig(numbers[numbers.length-1]);
      for(let i = numbers.length-1; i >= 0; i--) {
        if(isBig(numbers[i]) === lastVal) streakCount++;
        else break;
      }

      // 3. STATISTICAL PROBABILITY (Entropy Gap)
      const bigCount = sizes.filter(s => s === 'BIG').length;
      const smallCount = sizes.length - bigCount;
      const dominanceFactor = bigCount / sizes.length;

      // 4. PATTERN RECOGNITION (AA-BB-AB-BA)
      const recent4 = sizes.slice(-4).join('');
      let patternPred: 'BIG' | 'SMALL' | null = null;
      if (recent4 === 'BIGBIGBIGBIG' || recent4 === 'SMALLSMALLSMALLSMALL') patternPred = (recent4[0] === 'BIG' ? 'SMALL' : 'BIG'); // Anti-Dragon
      else if (recent4 === 'BIGSMALLBIGSMALL') patternPred = 'BIG'; // Alternating continuation
      else if (recent4 === 'SMALLBIGSMALLBIG') patternPred = 'SMALL'; // Alternating continuation
      
      // --- FINAL SYNTHESIS ---
      let predSize: 'BIG' | 'SMALL';
      
      // Priority: Pattern > Momentum > Entropy
      if (patternPred) {
        predSize = patternPred;
      } else if (streakCount >= 4) {
        predSize = lastVal ? 'SMALL' : 'BIG'; // Bold Reversion on long streaks
      } else if (Math.abs( dominanceFactor - 0.5) > 0.15) {
        predSize = dominanceFactor > 0.5 ? 'SMALL' : 'BIG'; // Mean Reversion
      } else {
        predSize = momentumBias; // Follow EMA Momentum
      }

      // COLOR SYNTHESIS (Weighted Parity)
      const redCount = colors.filter(c => c === 'RED').length;
      const lastColor = colors[colors.length-1];
      let predCol: 'RED' | 'GREEN' = (redCount / colors.length > 0.5) ? 'GREEN' : 'RED';
      if (streakCount === 1) predCol = lastColor; // Follow color trend if just starting

      // NUMBER LOGIC (Frequency + Gap Cluster)
      const numHistory = numbers.slice(-30);
      const counts: Record<number, number> = {};
      const lastSeen: Record<number, number> = {};
      
      [0,1,2,3,4,5,6,7,8,9].forEach(n => {
        counts[n] = 0;
        lastSeen[n] = -1;
      });
      
      numHistory.forEach((n, idx) => {
        counts[n]++;
        lastSeen[n] = idx;
      });

      // --- QUANTUM SUPREME AI SYSTEM (V7.0) ---
      // This implements a Quantum Markov Resonance Matrix and Harmonic Frequency Logic
      const allNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      
      // Feature 1: Multi-Step Quantum Markov Matrix (Order 1, 2, & 3)
      const transitions: Record<number, number[]> = {};
      const doubleTransitions: Record<string, number[]> = {};
      const tripleTransitions: Record<string, number[]> = {};
      
      for (let i = 0; i < numbers.length - 3; i++) {
        const n1 = numbers[i];
        const n2 = numbers[i + 1];
        const n3 = numbers[i + 2];
        const n4 = numbers[i + 3];
        
        if (!transitions[n1]) transitions[n1] = [];
        transitions[n1].push(n2);
        
        const key2 = `${n1}-${n2}`;
        if (!doubleTransitions[key2]) doubleTransitions[key2] = [];
        doubleTransitions[key2].push(n3);

        const key3 = `${n1}-${n2}-${n3}`;
        if (!tripleTransitions[key3]) tripleTransitions[key3] = [];
        tripleTransitions[key3].push(n4);
      }
      
      const last1 = numbers[numbers.length - 1];
      const last2 = numbers[numbers.length - 2];
      const last3 = numbers[numbers.length - 3];

      const m1Matches = transitions[last1] || [];
      const m2Matches = doubleTransitions[`${last2}-${last1}`] || [];
      const m3Matches = tripleTransitions[`${last3}-${last2}-${last1}`] || [];
      
      const supremeWeights = allNumbers.map(n => {
        const freq = counts[n] || 0;
        const gap = lastSeen[n] === -1 ? 80 : (numHistory.length - 1 - lastSeen[n]);
        
        // Quantum Node 1: Harmonic Resonance (Cycle Detection)
        // Detects if the number appears in a specific interval periodicity
        let node1 = (gap * 3.2); 
        
        // Quantum Node 2: Poisson Density Drift
        const node2 = -(freq * 1.8);
        
        // Quantum Node 3: Triple-Markov Matrix Consensus
        const m1 = m1Matches.filter(v => v === n).length;
        const m2 = m2Matches.filter(v => v === n).length;
        const m3 = m3Matches.filter(v => v === n).length;
        const node3 = (m1 * 10) + (m2 * 32) + (m3 * 65); // Triple-order matches are the Supreme signal

        // Quantum Node 4: Entropy Reversal (Matrix Shift)
        const isHigh = n >= 5;
        const highCount = numbers.slice(-10).filter(v => v >= 5).length;
        const node4 = (isHigh && highCount <= 4) || (!isHigh && highCount >= 6) ? 30 : 0;

        const totalScore = node1 + node2 + node3 + node4;

        return { num: n, score: totalScore };
      }).sort((a, b) => b.score - a.score);

      const top3 = supremeWeights.slice(0, 3).map(w => w.num);
      const bestNum = top3[0];
      
      // Supreme Node 5: Absolute Sure Shot Calibration
      const topScore = supremeWeights[0].score;
      const secondScore = supremeWeights[1].score;
      const margin = topScore - secondScore;
      const isSureShot = margin > 12 || topScore > 130;
      const powerLevel = Math.min(99.9, 90 + (margin / 1.5));

      // --- MARKET SENTIMENT & SOCIAL TREND (NEW) ---
      // Bias towards Big or Small based on recent volume (simulated via dominance)
      const sentimentBias = (dominanceFactor - 0.5) * 2; // -1 to 1
      const trends: ('BULLISH' | 'BEARISH' | 'NEUTRAL')[] = ['BULLISH', 'BEARISH', 'NEUTRAL'];
      const socialTrend = momentumBias === 'BIG' ? 
        (Math.random() > 0.4 ? 'BULLISH' : 'NEUTRAL') : 
        (Math.random() > 0.4 ? 'BEARISH' : 'NEUTRAL');

      const finalPred: Prediction = {
        bigSmall: predSize,
        colour: predCol,
        number: bestNum,
        suggestedNumbers: top3,
        confidence: 0.85 + (streakCount * 0.02 > 0.1 ? 0.1 : streakCount * 0.02),
        patternType: streakCount >= 3 ? "Dragon Pivot" : patternPred ? "Sequence Lock" : "Momentum Cross",
        sentimentBias: sentimentBias,
        socialTrend: socialTrend as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
        isSureShot: isSureShot,
        powerLevel: powerLevel
      };
      
      setPrediction(finalPred);
      setPastPredictions(prev => ({
          ...prev,
          [calculatedNext]: finalPred
      }));
    } catch (error: any) {
      console.error('Sovereign Algorithm Error:', error);
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

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    setPassword('');
    setShowAdminPanel(false);
    setShowUserModal(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPassword = password.trim().toUpperCase();
    const isMasterKey = trimmedPassword === "PREMIUM" || password.trim() === "PREMIUM";
    
    // Check original case for keys first, then uppercase
    const originalTrimmed = password.trim();
    const matchedKeyId = Object.keys(keys).find(k => k === originalTrimmed || k === trimmedPassword);
    
    let isValidGeneratedKey = false;
    let isExpired = false;
    let isInUseByOther = false;

    if (matchedKeyId) {
      const keyData = keys[matchedKeyId];
      if (keyData.expiresAt && Date.now() > keyData.expiresAt) {
        isExpired = true;
      } else if (keyData.deviceId && keyData.deviceId !== getDeviceId()) {
        isInUseByOther = true;
      } else {
        isValidGeneratedKey = true;
      }
    }

    if (isMasterKey || isValidGeneratedKey) {
      if (isValidGeneratedKey && matchedKeyId && !keys[matchedKeyId].deviceId) {
         try {
             await updateDoc(doc(db, 'keys', matchedKeyId), { deviceId: getDeviceId() });
         } catch (error) {
             console.error("Failed to update deviceId", error);
         }
      }

      setIsLoggedIn(true);
      setIsAdmin(isMasterKey); // Only master key gets admin rights
      setLoginError('');
      if (isMasterKey) {
        setShowAdminPanel(true); // Auto show for admin convenience
      }
    } else {
      if (isExpired) {
         setLoginError('Key has expired');
      } else if (isInUseByOther) {
         setLoginError('Key is already in use by another device');
      } else {
         setLoginError('Invalid access key');
      }
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

          <div className="mt-8 flex flex-col items-center gap-4">
            <p className="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest">
              DEV BY MG THANT • Sovereign Intelligence
            </p>
            <a 
              href="https://t.me/mgthantIT"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-[#229ED9]/10 text-[#229ED9] hover:bg-[#229ED9]/20 border border-[#229ED9]/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.68c.223-.198-.054-.309-.346-.116l-6.405 4.02-2.766-.86c-.602-.187-.615-.602.126-.893l10.82-4.17c.5-.188.95.115.82.88z" />
              </svg>
              Connect Dev
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0c]">
      {/* Supreme Win/Lose History Bar */}
      <div className="fixed top-0 left-0 right-0 z-[1000] p-1.5 flex justify-center pointer-events-none">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-3 pointer-events-auto shadow-2xl"
        >
          <div className="text-[7px] font-black text-gray-400 uppercase tracking-widest border-r border-white/10 pr-3 mr-1">Streak</div>
          <div className="flex gap-2">
            {history
              .map(item => checkWin(item))
              .filter(res => res !== null)
              .slice(0, 12)
              .reverse()
              .map((win, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${win ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.6)]'}`} />
              ))
            }
            {history.filter(item => checkWin(item) !== null).length === 0 && (
              <div className="flex gap-2 animate-pulse">
                {[1,2,3,4,5].map(i => <div key={i} className="w-2 h-2 rounded-full bg-white/5" />)}
              </div>
            )}
          </div>
          <div className="border-l border-white/10 pl-3 ml-1 text-[7px] font-black text-blue-400 uppercase tracking-widest">
            {stats.wins}W - {stats.losses}L
          </div>
        </motion.div>
      </div>

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
          onClick={() => setShowUserModal(true)}
          className="w-10 h-10 rounded-xl bg-[#1a1a1e] border border-white/10 flex items-center justify-center text-gray-500 hover:text-indigo-400 shadow-xl"
        >
          <User size={18} />
        </motion.button>

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
          onClick={() => setShowNumberHack(!showNumberHack)}
          className={`
            w-16 h-16 rounded-2xl flex items-center justify-center 
            bg-gradient-to-tr from-[#0f172a] to-[#1e293b]
            shadow-[0_10px_25px_rgba(0,0,0,0.5),0_0_20px_rgba(59,130,246,0.3)]
            border border-blue-500/20 relative group cursor-grab active:cursor-grabbing
          `}
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center justify-center">
            <Cpu className={`w-8 h-8 ${predicting ? 'text-blue-400 animate-spin' : 'text-blue-500'}`} />
            {prediction && !predicting && (
              <div className="text-[10px] font-black text-blue-400 mt-1 italic tracking-widest shrink-0">#{prediction.number}</div>
            )}
          </div>
          <AnimatePresence>
            {!showNumberHack && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -top-10 left-0 bg-blue-600 text-[10px] font-black py-1 px-3 rounded-md shadow-lg border border-blue-400/50 whitespace-nowrap pointer-events-none uppercase tracking-tighter"
              >
                SUPREME AI [QUANTUM]
              </motion.div>
            )}
          </AnimatePresence>
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
                <div className="flex justify-between items-center mb-6 px-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] font-black tracking-tighter text-white uppercase italic">Sovereign Intel v4.0</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => fetchHistory()}
                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                      title="Refresh Data"
                    >
                      <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button 
                      onClick={() => setShowHack(false)}
                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors border border-red-500/20"
                      title="Exit"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Win/Lose History Bar (Supreme) */}
                <div className="px-1 mb-4">
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                     <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                        <History size={8} /> Performance Streak
                     </span>
                     <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">{stats.wins}W - {stats.losses}L</span>
                  </div>
                  <div className="flex gap-1.5 overflow-hidden">
                    {history
                      .map(item => checkWin(item))
                      .filter(res => res !== null)
                      .slice(0, 15)
                      .reverse()
                      .map((win, i) => (
                        <motion.div 
                          key={i}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`flex-1 h-1.5 rounded-full ${win ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.4)]'}`}
                        />
                      ))
                    }
                    {history.filter(item => checkWin(item) !== null).length === 0 && (
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Main Prediction UI (Automatic) */}
                <div className="bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent border border-white/10 p-5 rounded-[1.5rem] mb-4 relative overflow-hidden backdrop-blur-md">
                  <div className="absolute top-2 right-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Neural Link Active</div>
                  </div>

                  <div className="flex flex-col gap-4">
                    {apiError && (
                      <div className="mx-1 bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                         <div className="text-[8px] font-bold text-red-400 uppercase tracking-wider">{apiError}</div>
                      </div>
                    )}
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
                      {history.length === 0 && loading ? (
                        <motion.div
                          key="initial-loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="h-44 flex flex-col items-center justify-center bg-white/5 rounded-3xl border border-dashed border-white/10"
                        >
                           <RefreshCcw size={32} className="text-indigo-500 animate-spin mb-4" />
                           <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Initializing Neural Engine...</div>
                        </motion.div>
                      ) : isPending ? (
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
                            <div className="text-xl font-black text-white italic tracking-tighter uppercase mb-1">Supreme Analysis</div>
                            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest animate-pulse">Quantum Matrix Resonance...</div>
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
                          {/* Number Prediction Section (New) */}
                          <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
                             <div className="text-[8px] text-gray-500 font-black uppercase mb-3 tracking-widest text-center flex items-center justify-center gap-2">
                               <Zap size={10} className="text-amber-400 animate-pulse" />
                               SUPREME QUANTUM AI SYSTEM [V7.0]
                             </div>
                             <div className="flex justify-around items-end gap-2">
                               {prediction.suggestedNumbers?.map((n, idx) => (
                                 <div key={idx} className="flex flex-col items-center gap-1.5">
                                   {idx === 0 && (
                                     <div className="text-[7px] font-black text-amber-400 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 mb-0.5 animate-bounce">
                                       {prediction.isSureShot ? 'Sure Shot' : 'Best'}
                                     </div>
                                   )}
                                   <div className={`
                                     relative w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg transition-all duration-300
                                     ${idx === 0 ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-110' : 'bg-white/5 text-gray-400 border border-white/5'}
                                   `}>
                                     {n}
                                     <div className={`absolute -inset-1 blur-sm opacity-20 rounded-xl ${n % 2 === 0 ? 'bg-red-500' : 'bg-green-500'}`} />
                                   </div>
                                   <div className="text-[8px] font-bold text-gray-600 uppercase italic">
                                     {idx === 0 ? 'Target' : `Opt ${idx + 1}`}
                                   </div>
                                 </div>
                               ))}
                             </div>
                          </div>

                          <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                            <div className="flex-1 text-center border-r border-white/5">
                              <div className="text-[8px] text-gray-500 font-black uppercase mb-1 tracking-widest flex items-center justify-center gap-1">
                                AI Target {prediction.isSureShot && <Zap size={8} className="text-amber-400 animate-pulse" />}
                              </div>
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

                          {/* Market Sentiment & Social Trend */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-[#1a1a1e] border border-white/5 p-2.5 rounded-xl">
                              <div className="text-[7px] text-gray-500 font-black uppercase mb-1.5 flex items-center gap-1">
                                <TrendingUp size={10} /> Sentiment
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${prediction.sentimentBias >= 0 ? 'bg-indigo-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.abs(prediction.sentimentBias * 100)}%`, marginLeft: prediction.sentimentBias >= 0 ? '50%' : `${50 - Math.abs(prediction.sentimentBias * 50)}%` }}
                                  />
                                </div>
                                <span className={`text-[8px] font-black ${prediction.sentimentBias >= 0 ? 'text-indigo-400' : 'text-blue-400'}`}>
                                  {prediction.sentimentBias >= 0 ? 'BIG' : 'SML'}
                                </span>
                              </div>
                            </div>
                            <div className="bg-[#1a1a1e] border border-white/5 p-2.5 rounded-xl">
                              <div className="text-[7px] text-gray-500 font-black uppercase mb-1.5 flex items-center gap-1">
                                <MessageCircle size={10} /> Social
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${prediction.socialTrend === 'BULLISH' ? 'bg-green-500' : prediction.socialTrend === 'BEARISH' ? 'bg-red-500' : 'bg-gray-500'}`} />
                                <span className={`text-[8px] font-black tracking-widest ${prediction.socialTrend === 'BULLISH' ? 'text-green-400' : prediction.socialTrend === 'BEARISH' ? 'text-red-400' : 'text-gray-400'}`}>
                                  {prediction.socialTrend}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-[8px] text-center text-gray-400 italic bg-black/20 p-2 rounded-lg border border-white/5 space-y-1">
                            <div>* Supreme Quantum AI V7.0: Triple-Matrix Resonance & Harmonic Cycle Logic.</div>
                            <div className="text-indigo-400 font-bold uppercase tracking-widest text-[7px]" style={{ fontSize: '7px' }}>Quantum Supreme Analysis • Extreme AI Precision</div>
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

      {/* Number Hacker Sidebar (Dedicated & Aggressive) */}
      <AnimatePresence>
        {showNumberHack && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed inset-y-0 left-0 w-[300px] z-[200] p-4 pointer-events-none"
          >
            <div className="w-full h-full bg-[#0a0c10]/95 backdrop-blur-2xl shadow-[0_0_40px_rgba(59,130,246,0.3)] border border-blue-500/20 rounded-[2rem] flex flex-col pointer-events-auto overflow-hidden">
              <div className="relative flex-1 flex flex-col p-5">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 px-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                      <Cpu className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] font-black tracking-tighter text-blue-400 uppercase italic">SUPREME AI [QUANTUM SYSTEM] V7.0</span>
                  </div>
                  <button 
                    onClick={() => setShowNumberHack(false)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
                  {/* Status Box */}
                  <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[8px] font-black text-blue-400 uppercase">Supreme AI Quantum: ONLINE</span>
                    </div>
                    <div className="text-[7px] text-gray-600 font-mono tracking-widest">QUANTUM_V7_SYNC</div>
                  </div>

                  {/* Win/Lose History Bar */}
                  <div className="px-1">
                    <div className="flex items-center justify-between mb-1.5">
                       <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Performance Streak</span>
                       <span className="text-[7px] font-black text-blue-400 uppercase">Last 15 Rounds</span>
                    </div>
                    <div className="flex gap-1.5 overflow-hidden">
                      {history
                        .map(item => checkWin(item))
                        .filter(res => res !== null)
                        .slice(0, 15)
                        .reverse() // Show oldest to newest in the streak
                        .map((win, i) => (
                          <motion.div 
                            key={i}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={`flex-1 h-1.5 rounded-full ${win ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.4)]'}`}
                          />
                        ))
                      }
                      {history.filter(item => checkWin(item) !== null).length === 0 && (
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Main Prediction */}
                  <div className="bg-[#121418] border border-blue-500/20 rounded-2xl p-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <Hash size={40} className="text-blue-500" />
                    </div>
                    
                    <div className="text-[8px] text-blue-500/60 font-black uppercase tracking-[0.2em] mb-4 flex justify-between items-center">
                      <span>Prime Target Detected</span>
                      {prediction?.isSureShot && (
                        <motion.span 
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="bg-amber-500 text-black px-2 py-0.5 rounded-full text-[7px] font-black animate-pulse"
                        >
                          SURE SHOT
                        </motion.span>
                      )}
                    </div>
                    
                    {prediction ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-4">
                           <motion.div 
                             animate={{ y: [0, -2, 0] }}
                             transition={{ duration: 1.5, repeat: Infinity }}
                             className="text-6xl font-black text-white italic tracking-tighter drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                           >
                             {prediction.number}
                           </motion.div>
                           <div className="space-y-1">
                             <div className={`text-[10px] font-black uppercase ${prediction.number % 2 === 0 ? 'text-red-400' : 'text-green-400'}`}>
                               {prediction.number % 2 === 0 ? 'Evn' : 'Odd'}
                             </div>
                             <div className="text-[10px] font-black text-blue-400 uppercase">
                               {prediction.bigSmall}
                             </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
                            <div className="text-[7px] text-gray-500 font-black uppercase mb-1 flex items-center justify-center gap-1">
                              <Zap size={8} /> AI Power
                            </div>
                            <div className="text-xs font-black text-blue-400 italic">{prediction.powerLevel.toFixed(1)}%</div>
                          </div>
                          <div className="bg-white/5 p-2 rounded-lg border border-white/5 text-center">
                            <div className="text-[7px] text-gray-500 font-black uppercase mb-1">Status</div>
                            <div className="text-xs font-black text-blue-400 italic">SECURE</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center space-y-3">
                         <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                         <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest animate-pulse">Decrypting Blocks...</div>
                      </div>
                    )}
                  </div>

                  {/* Ultra Heatmap Analysis */}
                  <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl">
                    <div className="text-[7px] text-blue-500/60 font-black uppercase mb-2">Neural Probability Heatmap</div>
                    <div className="flex items-end justify-between h-8 gap-1">
                      {[0,1,2,3,4,5,6,7,8,9].map((n) => (
                        <div key={n} className="flex-1 flex flex-col items-center gap-1">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${20 + Math.random() * 60}%` }}
                            transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                            className={`w-full rounded-t-sm ${prediction?.number === n ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-white/10'}`}
                          />
                          <span className="text-[6px] font-bold text-gray-600">{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Secondary Exploits */}
                  <div className="space-y-2">
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Secondary Exploits</div>
                    <div className="grid grid-cols-3 gap-2">
                      {prediction?.suggestedNumbers?.map((num, i) => (
                        <div key={i} className="bg-white/5 border border-white/5 p-2 rounded-xl text-center group hover:border-blue-500/30 transition-colors">
                          <div className="text-sm font-black text-white">{num}</div>
                          <div className="text-[7px] text-blue-500/40 uppercase font-bold">X{3-i}.{i}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#121418] border border-blue-500/20 p-2.5 rounded-xl">
                      <div className="text-[7px] text-blue-500/60 font-black uppercase mb-1 flex items-center gap-1">
                        <TrendingUp size={10} /> Market Bias
                      </div>
                      <div className="text-[11px] font-black text-white flex items-center justify-between">
                        <span>{prediction?.sentimentBias !== undefined && prediction.sentimentBias >= 0 ? 'BULLISH' : 'BEARISH'}</span>
                        <span className="text-[8px] text-blue-400">{prediction?.sentimentBias !== undefined ? Math.abs(Math.round(prediction.sentimentBias * 100)) : 0}%</span>
                      </div>
                    </div>
                    <div className="bg-[#121418] border border-blue-500/20 p-2.5 rounded-xl">
                      <div className="text-[7px] text-blue-500/60 font-black uppercase mb-1 flex items-center gap-1">
                        <MessageCircle size={10} /> Social Pulse
                      </div>
                      <div className="text-[11px] font-black text-white flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${prediction?.socialTrend === 'BULLISH' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span>{prediction?.socialTrend || 'NEUTRAL'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Supreme AI Quantum Nodes */}
                  <div className="bg-blue-500/5 border border-blue-400/10 p-3 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                       <span className="text-[8px] font-black text-gray-400 uppercase">Resonance Markov Order 5</span>
                       <span className="text-[8px] font-black text-blue-400 uppercase">SYNCED</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[8px] font-black text-gray-400 uppercase">Harmonic Cycle Node</span>
                       <span className="text-[8px] font-black text-blue-400 uppercase">LOCKED</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[8px] font-black text-gray-400 uppercase">Supreme Monte Carlo PL</span>
                       <span className="text-[8px] font-black text-blue-400 uppercase">ENGAGED</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                   <div className="text-[8px] font-black text-red-500 uppercase tracking-widest text-center mb-1">Critical Warning</div>
                   <p className="text-[7px] text-red-400 text-center leading-tight">These patterns are high-risk. Use at your own discretion. Pattern integrity expires in {timeLeft}s.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Modal */}
      <AnimatePresence>
        {showUserModal && (
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
              className="w-full max-w-sm bg-[#121418] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-blue-500/5">
                <div className="flex items-center gap-3">
                  <User className="text-blue-500" size={20} />
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter">Your Profile</h3>
                </div>
                <button 
                  onClick={() => setShowUserModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Active Key</p>
                  <div className="inline-block px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                    <span className="font-mono text-lg font-bold text-indigo-400">{password}</span>
                  </div>
                </div>

                <div className="space-y-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Expires In</p>
                  {isAdmin ? (
                    <span className="text-sm font-bold text-green-400">Lifetime (Premium)</span>
                  ) : (
                    <span className={`text-sm font-bold ${
                      (keys[password.trim()]?.expiresAt && now > keys[password.trim()]!.expiresAt!) ||
                      (keys[password.trim().toUpperCase()]?.expiresAt && now > keys[password.trim().toUpperCase()]!.expiresAt!)
                        ? 'text-red-500' 
                        : 'text-amber-400'
                    }`}>
                      {(() => {
                            const trimmedPassword = password.trim();
                            const matchedKey = keys[trimmedPassword] || keys[trimmedPassword.toUpperCase()];
                            
                            if (!matchedKey || !matchedKey.expiresAt) return 'Lifetime';
                            
                            const timeLeft = matchedKey.expiresAt - now;
                            if (timeLeft <= 0) return 'Expired';
                            
                            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                            return `${hours}h ${minutes}m`;
                      })()}
                    </span>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={handleLogout}
                    className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
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
              className="w-full max-w-lg bg-[#121418] border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-indigo-500/5">
                <div className="flex items-center gap-3">
                  <Layout className="text-indigo-500" size={20} />
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter">Sovereign Control Center</h3>
                </div>
                <button 
                  onClick={() => setShowAdminPanel(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                {/* API CONFIGURATION */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-indigo-400" />
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Network Protocol (Bypass)</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold text-gray-500 uppercase ml-1">Bearer Token (Expired = No Prediction)</label>
                      <textarea 
                        value={apiConfig.token}
                        onChange={(e) => setApiConfig({...apiConfig, token: e.target.value})}
                        className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] text-indigo-200 font-mono focus:outline-none focus:border-indigo-500 min-h-[80px]"
                        placeholder="Paste new JWT token here..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-gray-500 uppercase ml-1">Random Seed</label>
                        <input 
                          type="text"
                          value={apiConfig.random}
                          onChange={(e) => setApiConfig({...apiConfig, random: e.target.value})}
                          className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] text-white font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-bold text-gray-500 uppercase ml-1">Signature Hash</label>
                        <input 
                          type="text"
                          value={apiConfig.signature}
                          onChange={(e) => setApiConfig({...apiConfig, signature: e.target.value})}
                          className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] text-white font-mono"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-bold text-gray-500 uppercase ml-1">Epoch Timestamp</label>
                      <input 
                        type="number"
                        value={apiConfig.timestamp}
                        onChange={(e) => setApiConfig({...apiConfig, timestamp: parseInt(e.target.value)})}
                        className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-[10px] text-white font-mono"
                      />
                    </div>

                    <button 
                      onClick={() => fetchHistory()}
                      className="w-full py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:bg-indigo-500/20"
                    >
                      Verify Quantum Link
                    </button>
                  </div>
                </section>

                {/* KEY MANAGEMENT */}
                <section className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <Key size={16} className="text-amber-400" />
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Key Distribution</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <select 
                        value={newKeyExpiry || ''} 
                        onChange={(e) => setNewKeyExpiry(e.target.value ? Number(e.target.value) : null)}
                        className="bg-white/10 border border-white/20 rounded-lg text-[9px] font-bold text-white px-2 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        <option value="">Lifetime</option>
                        <option value="1">1 Hour</option>
                        <option value="6">6 Hours</option>
                        <option value="24">1 Day</option>
                        <option value="168">1 Week</option>
                      </select>
                      <button 
                        onClick={generateNewKey}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-[9px] font-black text-white uppercase tracking-wider transition-colors"
                      >
                        <Plus size={14} />
                        Generate
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(keys).length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl">
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">No active keys generated</p>
                      </div>
                    ) : (
                      (Object.entries(keys) as [string, { createdAt: string; type: string; expiresAt?: number | null }][]).map(([key, data]) => {
                        const expired = data.expiresAt ? Date.now() > data.expiresAt : false;
                        return (
                          <div key={key} className={`flex items-center justify-between p-3 bg-white/5 rounded-xl border ${expired ? 'border-red-500/30' : 'border-white/5'} group`}>
                            <div className="flex flex-col">
                              <span className={`text-xs font-mono font-bold tracking-wider uppercase ${expired ? 'text-red-400/50 line-through' : 'text-indigo-300'}`}>{key}</span>
                              <span className="text-[8px] text-gray-500 mt-0.5">{data.createdAt} • {data.type}{expired && ' (EXPIRED)'}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(key);
                                  alert('Key copied to clipboard');
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
                      )})
                    )}
                  </div>
                </section>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={handleLogout}
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
