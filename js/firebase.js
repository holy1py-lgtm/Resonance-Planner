const firebaseConfig = {
  apiKey: "AIzaSyD7acO5wL0f0nY-a2zrPqV1E8V3F5f2kftk",
  authDomain: "novel-planner-5df6b.firebaseapp.com",
  projectId: "novel-planner-5df6b",
  storageBucket: "novel-planner-5df6b.firebasestorage.app",
  messagingSenderId: "952443176568",
  appId: "1:952443176568:web:1b5b8cf97f5fcaa57ccf8d"
};

const COLLECTION_NAME = 'planner';

const createLocalStorageAdapter = () => ({
  async get(key, _unused) {
    const value = localStorage.getItem(key);
    return value === null ? null : { value };
  },
  async set(key, value, _unused) {
    localStorage.setItem(key, String(value));
    return true;
  },
  async delete(key, _unused) {
    localStorage.removeItem(key);
    return true;
  },
  async list(prefix, _unused) {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(prefix));
    return { keys };
  }
});

let initializationPromise = null;
let activeAdapter = null;

function createFirestoreAdapter(plannerCollection, firestoreHelpers) {
  const { doc, getDoc, setDoc, deleteDoc, getDocs } = firestoreHelpers;

  return {
    async get(key, _unused) {
      const snapshot = await getDoc(doc(plannerCollection, key));
      if (!snapshot.exists()) {
        return null;
      }
      const data = snapshot.data();
      return { value: data && Object.prototype.hasOwnProperty.call(data, 'value') ? data.value : null };
    },
    async set(key, value, _unused) {
      await setDoc(doc(plannerCollection, key), { value: String(value) });
      return true;
    },
    async delete(key, _unused) {
      await deleteDoc(doc(plannerCollection, key));
      return true;
    },
    async list(prefix, _unused) {
      const snapshot = await getDocs(plannerCollection);
      const keys = snapshot.docs
        .filter((document) => !prefix || document.id.startsWith(prefix))
        .map((document) => document.id);
      return { keys };
    }
  };
}

async function ensureStorageAdapter() {
  if (activeAdapter) {
    return activeAdapter;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        const firebaseAppModule = await import('https://www.gstatic.com/firebasejs/10.14.2/firebase-app.js');
        const firebaseFirestoreModule = await import('https://www.gstatic.com/firebasejs/10.14.2/firebase-firestore.js');

        const { initializeApp } = firebaseAppModule;
        const {
          getFirestore,
          collection,
          doc,
          getDoc,
          setDoc,
          deleteDoc,
          getDocs
        } = firebaseFirestoreModule;

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const plannerCollection = collection(db, COLLECTION_NAME);
        const firestoreAdapter = createFirestoreAdapter(plannerCollection, {
          doc,
          getDoc,
          setDoc,
          deleteDoc,
          getDocs
        });

        activeAdapter = firestoreAdapter;
        window.storage = firestoreAdapter;
        return firestoreAdapter;
      } catch (error) {
        console.warn('Firebase Firestore is unavailable. Falling back to localStorage.', error);
        const fallbackAdapter = createLocalStorageAdapter();
        activeAdapter = fallbackAdapter;
        window.storage = fallbackAdapter;
        return fallbackAdapter;
      }
    })();
  }

  return initializationPromise;
}

const initialAdapter = createLocalStorageAdapter();
window.storage = initialAdapter;
window.storageReady = ensureStorageAdapter();
