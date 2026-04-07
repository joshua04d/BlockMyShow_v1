import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            "AIzaSyC3UBVGs7GUPc8-gKVXq7kdtgB09N3EnvY",
  authDomain:        "blockchain-bee35.firebaseapp.com",
  projectId:         "blockchain-bee35",
  storageBucket:     "blockchain-bee35.firebasestorage.app",
  messagingSenderId: "95701152232",
  appId:             "1:95701152232:web:59082bfbb2b9c8e45d745d"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
