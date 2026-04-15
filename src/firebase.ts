import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAr8lD08wGwjZk3Fp7BVCHyJ_T2ofERXiQ",
  authDomain: "sweetdata-85207.firebaseapp.com",
  projectId: "sweetdata-85207",
  databaseURL: "https://sweetdata-85207-default-rtdb.firebaseio.com",
  storageBucket: "sweetdata-85207.appspot.com",
  messagingSenderId: "676123277528",
  appId: "1:676123277528:web:3ebdd46817a2c69576ffad"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
