// ============================================================
//  RASID – Firebase Initialization + Auth Helper
// ============================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics }           from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
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

// ── Initialize (نتجنب duplicate-app إذا شُغّل مرتين) ────────
const app       = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth      = getAuth(app);
const db        = getFirestore(app);

// ── Sign-in with role check ──────────────────────────────────
export async function loginAndRedirect(email, password) {
  try {
    // 1. Sign in with Firebase Auth
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid        = credential.user.uid;

    // 2. ندور في User أول (الأدمن والفولنتير اللي في User)
    const userSnap = await getDoc(doc(db, "User", uid));
    if (userSnap.exists()) {
      const data          = userSnap.data();
      const role          = data.role          || "";
      const accountStatus = data.accountStatus || "";

      if (role === "admin") {
        window.location.href = "/Pages/AdminControlPanel.html";
        return { success: true };
      }

      if (role === "volunteer" && accountStatus === "approved") {
        window.location.href = "/Pages/Control-panel.html";
        return { success: true };
      }

      await signOut(auth);
      return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
    }

    // 3. مو في User → ندور في Volunteer
    const volSnap = await getDoc(doc(db, "Volunteer", uid));
    if (volSnap.exists()) {
      const data           = volSnap.data();
      const approvalStatus = data.ApprovalStatus || "";
      const status         = data.Status         || "";

      if (approvalStatus === "approved" && status === "active") {
        window.location.href = "/Pages/Control-panel.html";
        return { success: true };
      }

      await signOut(auth);
      return { success: false, error: "حسابك لم يتم قبوله بعد أو غير نشط." };
    }

    // 4. مو موجود في أي جدول
    await signOut(auth);
    return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };

  } catch (err) {
    const msg = firebaseErrorToArabic(err.code);
    return { success: false, error: msg };
  }
}

// ── Auth state helper (used on protected pages) ──────────────
export async function requireAuth(requiredRole) {
  return new Promise((resolve) => {

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();

      if (!user) {
        window.location.href = "/Pages/index.html";
        return;
      }

      if (requiredRole) {
        try {
          let role = null;

          const userSnap = await getDoc(doc(db, "User", user.uid));
          if (userSnap.exists()) {
            role = userSnap.data().role || null;
          } else {
            const volSnap = await getDoc(doc(db, "Volunteer", user.uid));
            if (volSnap.exists()) {
              role = "volunteer";
            }
          }

          if (role !== requiredRole) {
            window.location.href = "/Pages/index.html";
            return;
          }

        } catch (error) {
          console.error("Auth Error:", error);
          window.location.href = "/Pages/index.html";
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
  window.location.href = "/Pages/index.html";
}

// ── Error code → Arabic message ──────────────────────────────
function firebaseErrorToArabic(code) {
  const map = {
    "auth/invalid-email":          "البريد الإلكتروني غير صالح.",
    "auth/user-not-found":         "لا يوجد حساب بهذا البريد الإلكتروني.",
    "auth/wrong-password":         "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/invalid-credential":     "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/too-many-requests":      "تم تجاوز عدد المحاولات. حاول مجددًا لاحقًا.",
    "auth/network-request-failed": "خطأ في الاتصال بالشبكة. تحقق من اتصالك بالإنترنت.",
    "auth/user-disabled":          "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  };
  return map[code] || "حدث خطأ غير متوقع. حاول مجددًا.";
}

export { auth, db };