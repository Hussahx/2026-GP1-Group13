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
  collection,
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
// Strategy (no User collection):
//   1. Sign in with Firebase Auth
//   2. Check Admin collection by UID  → admin panel
//   3. Check Volunteer collection by AuthUID field (set on approval)
//      OR by document ID (legacy) → volunteer portal
export async function loginAndRedirect(email, password) {
  try {
    // 1. Sign in with Firebase Auth
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid        = credential.user.uid;

    // 2. Check Admin collection
    const adminSnap = await getDoc(doc(db, "Admin", uid));
    if (adminSnap.exists()) {
      const data          = adminSnap.data();
      const accountStatus = (data.AccountStatus || data.accountStatus || "").toLowerCase();
      if (accountStatus === "valid" || accountStatus === "active" || accountStatus === "") {
window.location.href = "/Pages/Control.html";
        return { success: true };
      }
      await signOut(auth);
      return { success: false, error: "حسابك معلّق. تواصل مع الإدارة." };
    }

    // 3. Check Volunteer collection — match on AuthUID field (set during approval)
    //    Fallback: also try doc ID = uid (for any legacy documents)
    const { query, where, getDocs } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
    );

    let volData = null;

    // 3a. Query by AuthUID field
    const volQuery = query(
      collection(db, "Volunteer"),
      where("AuthUID", "==", uid)
    );
    const volQuerySnap = await getDocs(volQuery);
    if (!volQuerySnap.empty) {
      volData = volQuerySnap.docs[0].data();
    }

    // 3b. Fallback: doc ID matches uid
    if (!volData) {
      const volDocSnap = await getDoc(doc(db, "Volunteer", uid));
      if (volDocSnap.exists()) volData = volDocSnap.data();
    }

    if (volData) {
      const approvalStatus = (
        volData.ApprovalStatus || volData.approvalStatus || ""
      ).toLowerCase();
      const accountStutes = (
        volData.AccountStutes || volData.AccountStatus || volData.accountStatus || ""
      ).toLowerCase();

      const isApproved =
        approvalStatus === "approved" ||
        approvalStatus === "active"   ||
        accountStutes  === "valid"    ||
        accountStutes  === "active";

      if (isApproved) {
        window.location.href = "/Pages/Reports.html";
        return { success: true };
      }

      await signOut(auth);
      if (approvalStatus === "pending" || approvalStatus === "") {
        return { success: false, error: "حسابك لا يزال قيد المراجعة. يرجى الانتظار حتى يتم القبول." };
      }
      return { success: false, error: "حسابك لم يتم قبوله أو غير نشط. تواصل مع الإدارة." };
    }

    // 4. UID not found in Admin or Volunteer
    await signOut(auth);
    return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };

  } catch (err) {
    console.error("Login error:", err.code, err.message);
    return { success: false, error: firebaseErrorToArabic(err.code) };
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

          // Check Admin collection
          const adminSnap = await getDoc(doc(db, "Admin", user.uid));
          if (adminSnap.exists()) {
            role = "admin";
          } else {
            // Check Volunteer collection by AuthUID field
            const { query, where, getDocs } = await import(
              "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
            );
            const volQuery = query(
              collection(db, "Volunteer"),
              where("AuthUID", "==", user.uid)
            );
            const volSnap = await getDocs(volQuery);

            if (!volSnap.empty) {
              role = "volunteer";
            } else {
              // Fallback: doc ID = uid
              const volDocSnap = await getDoc(doc(db, "Volunteer", user.uid));
              if (volDocSnap.exists()) role = "volunteer";
            }
          }

          if (role !== requiredRole.toLowerCase()) {
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
    "permission-denied":            "خطأ في صلاحيات قاعدة البيانات. تواصل مع المطور.",
  };
  return map[code] || "حدث خطأ غير متوقع. حاول مجددًا.";
}

export { auth, db };
