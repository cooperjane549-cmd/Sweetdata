import React, { useState, useEffect } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, 
  doc, onSnapshot, runTransaction, setDoc, Timestamp,
  collection, addDoc, query, where, orderBy, getDocs
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { UserProfile, Withdrawal, SocialTask } from './types';
import { handleFirestoreError, OperationType } from './lib/error-handler';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wallet, Gift, ShoppingBag, User as UserIcon, 
  Play, CheckCircle2, Share2, ExternalLink, 
  LogOut, TrendingUp, ShieldCheck, AlertCircle,
  Trophy, Zap, Smartphone, Megaphone, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SOCIAL_TASKS: SocialTask[] = [
  { id: 'tiktok_follow', title: 'Follow TikTok', reward: 3.0, url: 'https://tiktok.com', type: 'tiktok' },
  { id: 'youtube_sub', title: 'Subscribe YouTube', reward: 5.0, url: 'https://youtube.com', type: 'youtube' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profileRef = doc(db, 'users', u.uid);
        const unsubProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
          } else {
            createInitialProfile(u);
          }
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        });
        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const createInitialProfile = async (u: User) => {
    const urlParams = new URLSearchParams(window.location.search);
    const referredBy = urlParams.get('ref') || undefined;

    const newProfile: Omit<UserProfile, 'uid'> = {
      email: u.email || '',
      displayName: u.displayName || 'User',
      photoURL: u.photoURL || '',
      balance: 0,
      adsWatched: 0,
      trustPackClaimed: false,
      referralCode: u.uid,
      referredBy,
      tasksCompleted: [],
      createdAt: Timestamp.now()
    };

    try {
      await setDoc(doc(db, 'users', u.uid), newProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${u.uid}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Logged in successfully!");
    } catch (err) {
      toast.error("Login failed. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  const watchAd = async () => {
    if (!profile) return;
    setIsWatchingAd(true);
    
    setTimeout(async () => {
      try {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', profile.uid);
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) return;

          const data = userSnap.data() as UserProfile;
          const newAdsCount = data.adsWatched + 1;
          const newBalance = data.balance + 0.8;

          transaction.update(userRef, {
            adsWatched: newAdsCount,
            balance: newBalance
          });

          if (newAdsCount === 25 && data.referredBy) {
            const referrerRef = doc(db, 'users', data.referredBy);
            const referrerSnap = await transaction.get(referrerRef);
            if (referrerSnap.exists()) {
              const referrerData = referrerSnap.data() as UserProfile;
              transaction.update(referrerRef, {
                balance: referrerData.balance + 2.5
              });
            }
          }
        });
        toast.success("+0.8 MB earned!");
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
      } finally {
        setIsWatchingAd(false);
      }
    }, 3000);
  };

  const claimTrustPack = async () => {
    if (!profile || profile.adsWatched < 25 || profile.trustPackClaimed) return;

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', profile.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) return;

        const data = userSnap.data() as UserProfile;
        transaction.update(userRef, {
          balance: data.balance + 15,
          trustPackClaimed: true
        });

        const withdrawalRef = doc(collection(db, 'withdrawals'));
        transaction.set(withdrawalRef, {
          userId: profile.uid,
          amount: 15,
          status: 'pending',
          createdAt: Timestamp.now()
        });
      });
      toast.success("15MB Trust Pack claimed!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const requestWithdrawal = async (amount: number) => {
    if (!profile) return;
    
    const minThreshold = profile.trustPackClaimed ? 50 : 15;
    if (amount < minThreshold) {
      toast.error(`Minimum withdrawal is ${minThreshold} MB`);
      return;
    }

    if (profile.balance < amount) {
      toast.error("Insufficient balance");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', profile.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) return;

        const data = userSnap.data() as UserProfile;
        transaction.update(userRef, {
          balance: data.balance - amount
        });

        const withdrawalRef = doc(collection(db, 'withdrawals'));
        transaction.set(withdrawalRef, {
          userId: profile.uid,
          amount,
          status: 'pending',
          createdAt: Timestamp.now()
        });
      });
      toast.success(`Withdrawal request for ${amount} MB sent!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'withdrawals');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-8 max-w-md w-full"
        >
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center neon-red-glow">
              <Smartphone className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tighter text-primary">SweetData</h1>
            <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Premium Data Rewards</p>
          </div>
          <div className="space-y-4">
            <Button onClick={handleLogin} size="lg" className="w-full h-16 text-lg font-bold neon-red-glow">
              Login with Google
            </Button>
            <p className="text-xs text-muted-foreground opacity-40">
              Secure authentication powered by Firebase
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground pb-24">
        <header className="p-6 flex justify-between items-center border-b border-border bg-black/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center neon-red-glow">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xl tracking-tight leading-none">SweetData</span>
              <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Master Edition</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="hover:text-primary">
            <LogOut className="w-6 h-6" />
          </Button>
        </header>

        <main className="p-6 max-w-lg mx-auto space-y-8">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Balance Dashboard */}
                <div className="text-center space-y-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Current Balance</span>
                  <div className="text-7xl font-black text-white tracking-tighter flex items-center justify-center gap-2">
                    {profile?.balance.toFixed(1)}
                    <span className="text-2xl text-primary">MB</span>
                  </div>
                </div>

                {/* Marketing Text */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Watch Ads, Earn 20 MBs daily</div>
                      <div className="text-xs text-muted-foreground">Quick and easy rewards</div>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Buy MBs without Expiry</div>
                      <div className="text-xs text-muted-foreground">Cheaper price, no limits</div>
                    </div>
                  </div>
                </div>

                {/* AdMob Native Ad Placeholder */}
                <div className="w-full aspect-video bg-card border border-border rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <Megaphone className="w-8 h-8 text-muted-foreground opacity-20" />
                  <span className="text-xs font-bold text-muted-foreground opacity-30 uppercase tracking-widest">Native Ad Space</span>
                </div>

                {/* Trust Progress */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold uppercase tracking-widest">Trust Pack Progress</h3>
                      <p className="text-xs text-muted-foreground">Complete 25 ads to unlock 15MB</p>
                    </div>
                    <span className="text-lg font-black text-primary">{profile?.adsWatched}/25</span>
                  </div>
                  <Progress value={(profile?.adsWatched || 0) / 25 * 100} className="h-3 bg-card border border-border" />
                  
                  {profile?.adsWatched >= 25 && !profile?.trustPackClaimed && (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <Button onClick={claimTrustPack} className="w-full h-14 text-lg font-bold neon-red-glow">
                        Redeem 15MB Trust Pack
                      </Button>
                    </motion.div>
                  )}
                </div>

                {/* Buy Button */}
                <Button 
                  onClick={() => {
                    const msg = encodeURIComponent(`Hello SweetData, I want to buy bundles. My ID: ${profile?.uid}`);
                    window.open(`https://wa.me/254789574046?text=${msg}`, '_blank');
                  }}
                  className="w-full h-16 bg-accent text-accent-foreground hover:bg-accent/90 text-xl font-black gold-glow rounded-2xl"
                >
                  BUY CHEAP BUNDLES
                </Button>
              </motion.div>
            )}

            {activeTab === 'tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <Card className="premium-card">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Play className="w-6 h-6 text-primary" />
                      Earn MBs
                    </CardTitle>
                    <CardDescription>Watch rewarded videos to grow your balance.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={watchAd} 
                      disabled={isWatchingAd}
                      className="w-full h-20 text-xl font-black neon-red-glow"
                    >
                      {isWatchingAd ? "Loading Reward..." : "Watch Video (+0.8 MB)"}
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground px-2">Bonus Tasks</h3>
                  {SOCIAL_TASKS.map(task => (
                    <div key={task.id} className="p-4 rounded-2xl bg-card border border-border flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${task.type === 'tiktok' ? 'bg-white text-black' : 'bg-red-600 text-white'}`}>
                          {task.type === 'tiktok' ? <Zap className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="font-bold">{task.title}</div>
                          <div className="text-xs text-primary">+{task.reward} MB Reward</div>
                        </div>
                      </div>
                      {profile?.tasksCompleted.includes(task.id) ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => {
                          window.open(task.url, '_blank');
                          toast.info("Click Claim after completing the task", {
                            action: {
                              label: "Claim",
                              onClick: async () => {
                                try {
                                  await runTransaction(db, async (transaction) => {
                                    const userRef = doc(db, 'users', profile!.uid);
                                    const userSnap = await transaction.get(userRef);
                                    if (!userSnap.exists()) return;
                                    const data = userSnap.data() as UserProfile;
                                    if (data.tasksCompleted.includes(task.id)) return;
                                    transaction.update(userRef, {
                                      balance: data.balance + task.reward,
                                      tasksCompleted: [...data.tasksCompleted, task.id]
                                    });
                                  });
                                  toast.success(`+${task.reward} MB earned!`);
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.UPDATE, `users/${profile!.uid}`);
                                }
                              }
                            }
                          });
                        }}>
                          Start
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'store' && (
              <motion.div
                key="store"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <Card className="premium-card">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <ShoppingBag className="w-6 h-6 text-primary" />
                      Redeem Data
                    </CardTitle>
                    <CardDescription>Minimum withdrawal: {profile?.trustPackClaimed ? '50' : '15'} MB</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    {[50, 100, 250, 500].map(amount => (
                      <Button 
                        key={amount}
                        variant="outline" 
                        className="h-24 flex flex-col border-border hover:border-primary hover:bg-primary/5"
                        onClick={() => requestWithdrawal(amount)}
                      >
                        <span className="text-2xl font-black">{amount}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">MB Pack</span>
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                <div className="p-6 rounded-3xl bg-accent/5 border border-accent/20 gold-glow space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                      <Trophy className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-accent">VIP Reseller</h3>
                      <p className="text-xs text-accent/60">Get massive discounts on bulk data.</p>
                    </div>
                  </div>
                  <Button 
                    className="w-full h-14 bg-accent text-accent-foreground hover:bg-accent/90 font-bold"
                    onClick={() => window.open('https://wa.me/254789574046', '_blank')}
                  >
                    Contact Sales
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur-2xl border-t border-border z-50">
          <div className="max-w-lg mx-auto flex justify-around items-center">
            <NavButton 
              active={activeTab === 'home'} 
              onClick={() => setActiveTab('home')} 
              icon={<Wallet className="w-7 h-7" />} 
              label="Dashboard" 
            />
            <NavButton 
              active={activeTab === 'tasks'} 
              onClick={() => setActiveTab('tasks')} 
              icon={<Gift className="w-7 h-7" />} 
              label="Earn" 
            />
            <NavButton 
              active={activeTab === 'store'} 
              onClick={() => setActiveTab('store')} 
              icon={<ShoppingBag className="w-7 h-7" />} 
              label="Store" 
            />
          </div>
        </nav>
        <Toaster position="top-center" theme="dark" />
      </div>
    </ErrorBoundary>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'text-primary' : 'text-muted-foreground opacity-40'}`}
    >
      <div className={`p-2 rounded-2xl transition-all ${active ? 'bg-primary/10 neon-red-glow' : ''}`}>
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
    </button>
  );
}
