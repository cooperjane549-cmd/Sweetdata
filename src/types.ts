export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  balance: number;
  adsWatched: number;
  trustPackClaimed: boolean;
  referralCode: string;
  referredBy?: string;
  tasksCompleted: string[];
  createdAt: any;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: any;
}

export interface SocialTask {
  id: string;
  title: string;
  reward: number;
  url: string;
  type: 'tiktok' | 'youtube';
}
