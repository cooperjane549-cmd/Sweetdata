import { useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  ref, 
  onValue, 
  runTransaction, 
  get 
} from 'firebase/database';
import { auth, db, googleProvider } from './firebase';
import { 
  Play, 
  Gift, 
  ShoppingBag, 
  LogOut, 
  TrendingUp, 
  Users, 
  ShieldCheck,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

interface UserData {
  balance: number;
  ads_watched: number;
  trust_pack_claimed: boolean;
  referral_code: string;
  referred_by?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adLoading, setAdLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Handle Referral from URL
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');

        const userRef = ref(db, `users/${currentUser.uid}`);
        
        // Initial check/setup
        const snapshot = await get(userRef);
        if (!snapshot.exists()) {
          const newUserData: UserData = {
            balance: 0,
            ads_watched: 0,
            trust_pack_claimed: false,
            referral_code: currentUser.uid.substring(0, 8),
            referred_by: refCode || undefined
          };
          await runTransaction(userRef, () => newUserData);
        }

        // Listen for real-time updates
        onValue(userRef, (snapshot) => {
          setUserData(snapshot.val());
        });
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
      showToast("Login failed. Please try again.", "error");
    }
  };

  const handleLogout = () => signOut(auth);

  const showToast = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const watchAd = async () => {
    if (!user) return;
    setAdLoading(true);
    
    // Simulate Video Ad Placeholder
    setTimeout(async () => {
      const userRef = ref(db, `users/${user.uid}`);
      try {
        await runTransaction(userRef, (currentData) => {
          if (currentData) {
            currentData.balance = (currentData.balance || 0) + 0.8;
            currentData.ads_watched = (currentData.ads_watched || 0) + 1;
          }
          return currentData;
        });
        showToast("Ad completed! +0.8 MB added.", "success");
      } catch (error) {
        showToast("Error updating balance.", "error");
      } finally {
        setAdLoading(false);
      }
    }, 2000);
  };

  const redeemTrustPack = async () => {
    if (!user || !userData || userData.ads_watched < 25 || userData.trust_pack_claimed) return;

    const userRef = ref(db, `users/${user.uid}`);
    try {
      await runTransaction(userRef, (currentData) => {
        if (currentData && !currentData.trust_pack_claimed) {
          currentData.balance = (currentData.balance || 0) + 15;
          currentData.trust_pack_claimed = true;
          
          // If referred, give bonus to inviter
          if (currentData.referred_by) {
            const inviterRef = ref(db, `users/${currentData.referred_by}`);
            runTransaction(inviterRef, (inviterData) => {
              if (inviterData) {
                inviterData.balance = (inviterData.balance || 0) + 2.5;
              }
              return inviterData;
            });
          }
        }
        return currentData;
      });
      showToast("Trust Pack Redeemed! +15 MB added.", "success");
    } catch (error) {
      showToast("Error redeeming pack.", "error");
    }
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(`Hello SweetData, I want to buy cheap bundles. My UID: ${user?.uid}`);
    window.open(`https://wa.me/254789574046?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-neon-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black text-white">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8 text-center"
        >
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tighter text-neon-red italic">
              SWEET<span className="text-white">DATA</span>
            </h1>
            <p className="text-zinc-400 font-medium">Earn Data Rewards Daily</p>
          </div>

          <div className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 backdrop-blur-sm space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-neon-red/10 flex items-center justify-center text-neon-red">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="font-bold">Fast Rewards</p>
                  <p className="text-xs text-zinc-500">Earn MBs by watching simple ads</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <p className="font-bold">Cheap Bundles</p>
                  <p className="text-xs text-zinc-500">Buy data at the best market rates</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogin}
              className="w-full py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-zinc-200 transition-colors"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Sign in with Google
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const trustProgress = Math.min((userData?.ads_watched || 0) / 25 * 100, 100);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-zinc-900 sticky top-0 bg-black/80 backdrop-blur-md z-50">
        <h1 className="text-2xl font-black tracking-tighter text-neon-red italic">
          SWEET<span className="text-white">DATA</span>
        </h1>
        <button 
          onClick={handleLogout}
          className="p-2 text-zinc-500 hover:text-white transition-colors"
        >
          <LogOut size={20} />
        </button>
      </header>

      <main className="p-6 max-w-lg mx-auto space-y-8">
        {/* Balance Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden bg-gradient-to-br from-zinc-900 to-black p-8 rounded-[2.5rem] border border-zinc-800 shadow-2xl shadow-neon-red/5"
        >
          <div className="relative z-10 space-y-1">
            <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">Available Balance</p>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black text-white tracking-tighter">
                {userData?.balance.toFixed(1) || '0.0'}
              </span>
              <span className="text-neon-red font-bold text-xl">MB</span>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-5">
            <TrendingUp size={160} />
          </div>
        </motion.div>

        {/* Marketing Text */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900/40 rounded-3xl border border-zinc-800/50">
            <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Daily Rewards</p>
            <p className="text-sm font-medium text-white">Watch Ads, Earn <span className="text-neon-red">20 MBs</span> daily</p>
          </div>
          <div className="p-4 bg-zinc-900/40 rounded-3xl border border-zinc-800/50">
            <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Best Rates</p>
            <p className="text-sm font-medium text-white">Buy MBs without <span className="text-gold">Expiry</span> cheaper</p>
          </div>
        </div>

        {/* AdSense Placeholder */}
        <div className="w-full h-48 bg-zinc-900/20 rounded-3xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-600 space-y-2">
          <ShieldCheck size={32} />
          <p className="text-xs font-medium uppercase tracking-widest">Premium Ad Space</p>
        </div>

        {/* Trust Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
            <span className="text-zinc-500">Trust Pack Progress</span>
            <span className="text-neon-red">{userData?.ads_watched || 0} / 25 Ads</span>
          </div>
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${trustProgress}%` }}
              className="h-full bg-neon-red shadow-[0_0_10px_rgba(255,49,49,0.5)]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <button
            onClick={watchAd}
            disabled={adLoading}
            className={cn(
              "w-full py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95",
              adLoading ? "bg-zinc-800 text-zinc-500" : "bg-neon-red text-white shadow-lg shadow-neon-red/20"
            )}
          >
            {adLoading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play size={24} fill="currentColor" />
                WATCH AD (+0.8 MB)
              </>
            )}
          </button>

          {userData && userData.ads_watched >= 25 && !userData.trust_pack_claimed && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={redeemTrustPack}
              className="w-full py-5 bg-white text-black rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95"
            >
              <Gift size={24} />
              REDEEM 15MB TRUST PACK
            </motion.button>
          )}

          <button
            onClick={openWhatsApp}
            className="w-full py-5 bg-gold text-black rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-gold/10 active:scale-95"
          >
            <ShoppingBag size={24} />
            BUY CHEAP BUNDLES
          </button>
        </div>

        {/* Referral Section */}
        <div className="p-6 bg-zinc-900/30 rounded-3xl border border-zinc-800/50 space-y-4">
          <div className="flex items-center gap-3">
            <Users className="text-neon-red" size={20} />
            <h3 className="font-bold">Refer & Earn</h3>
          </div>
          <p className="text-xs text-zinc-500">
            Get <span className="text-white font-bold">2.5 MB</span> for every friend who completes their Trust Pack.
          </p>
          <div className="flex items-center gap-2">
            <input 
              readOnly 
              value={`${window.location.origin}?ref=${userData?.referral_code}`}
              className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono text-zinc-400"
            />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}?ref=${userData?.referral_code}`);
                showToast("Link copied!", "success");
              }}
              className="px-4 py-2 bg-zinc-800 rounded-xl text-xs font-bold hover:bg-zinc-700 transition-colors"
            >
              COPY
            </button>
          </div>
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-bold text-sm z-[100] shadow-2xl",
              message.type === 'success' ? "bg-white text-black" : "bg-neon-red text-white"
            )}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
