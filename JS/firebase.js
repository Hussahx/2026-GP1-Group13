// ============================================================
//  RASID – Firebase Initialization + Auth Helper
// ============================================================

import { initializeApp }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics }         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase config ─────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyD7_kFQDxLRMHYFuyiwcOuyZmApVLS-kl0",
  authDomain:        "rasid-1bb06.firebaseapp.com",
  projectId:         "rasid-1bb06",
  storageBucket:     "rasid-1bb06.firebasestorage.app",
  messagingSenderId: "668525115587",
  appId:             "1:668525115587:web:e017be3b5cbf4ac3b30a76",
  measurementId:     "G-MZ3KB7WBK4"
};

// ── Initialize ───────────────────────────────────────────────
const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth      = getAuth(app);
const db        = getFirestore(app);

// ── Sign-in with role check ──────────────────────────────────
/**
 * Signs in the user and redirects based on their Firestore role.
 *
 * Firestore structure expected:
 *   Collection: "User"  →  Document ID: uid
 *   Fields: { role: "admin" | "volunteer" | ... }
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function loginAndRedirect(email, password) {
  try {
    // 1. Sign in with Firebase Auth
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid        = credential.user.uid;

    // 2. Fetch user document from Firestore to get role
    const userRef  = doc(db, "User", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Document missing → treat as unauthorised
      await signOut(auth);
      return { success: false, error: "لم يتم العثور على بيانات المستخدم. تواصل مع الإدارة." };
    }

    const { role } = userSnap.data();

    // 3. Redirect based on role
    switch (role) {
      case "admin":
        window.location.href = "../Pages/AdminControlPanel.html";
        break;
      case "volunteer":
        window.location.href = "../Pages/Control-panel.html";
        break;
      default:
        // Unknown role – sign out and inform user
        await signOut(auth);
        return { success: false, error: "صلاحياتك غير كافية للوصول إلى النظام." };
    }

    return { success: true };

  } catch (err) {
    // Map Firebase error codes to Arabic messages
    const msg = firebaseErrorToArabic(err.code);
    return { success: false, error: msg };
  }
}

// ── Auth state helper (used on protected pages) ──────────────
/**
 * Redirects to home if the user is NOT logged in,
 * OR redirects to home if their role doesn't match `requiredRole`.
 *
 * Call this at the top of every protected page's script.
 *
 * @param {string} [requiredRole]  e.g. "admin" – omit to allow any authenticated user
 */
export async function requireAuth(requiredRole) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "../Pages/index.html";
        return;
      }
      if (requiredRole) {
        const snap = await getDoc(doc(db, "User", user.uid));
        const role = snap.exists() ? snap.data().role : null;
        if (role !== requiredRole) {
          window.location.href = "../Pages/index.html";
          return;
        }
      }
      resolve(user);
    });
  });
}

// ── Sign-out helper ──────────────────────────────────────────
export async function logout() {
  await signOut(auth);
  window.location.href = "../Pages/index.html";
}

// ── Error code → Arabic message ──────────────────────────────
function firebaseErrorToArabic(code) {
  const map = {
    "auth/invalid-email":          "البريد الإلكتروني غير صالح.",
    "auth/user-not-found":         "لا يوجد حساب بهذا البريد الإلكتروني.",
    "auth/wrong-password":         "كلمة المرور غير صحيحة.",
    "auth/invalid-credential":     "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/too-many-requests":      "تم تجاوز عدد المحاولات. حاول مجددًا لاحقًا.",
    "auth/network-request-failed": "خطأ في الاتصال بالشبكة. تحقق من اتصالك بالإنترنت.",
    "auth/user-disabled":          "هذا الحساب موقوف. تواصل مع الإدارة.",
  };
  return map[code] || "حدث خطأ غير متوقع. حاول مجددًا.";
}

export { auth, db };
