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
  getDoc,
  query,
  where,
  getDocs
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
const app       = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth      = getAuth(app);
const db        = getFirestore(app);

// ── Get role from Firestore ──────────────────────────────────
// Reads the `role` field directly from the Admin or Volunteer document.
// Admin doc  → uses data.role field (e.g. "admin")
// Volunteer  → returns "volunteer" (field or default)
// Returns null if UID not found in either collection.
export async function getRoleFromFirestore(uid) {

  // 1. Check Admin collection — read `role` field directly
  const adminSnap = await getDoc(doc(db, "Admin", uid));
  if (adminSnap.exists()) {
    const data = adminSnap.data();
    return (data.role || "admin").toLowerCase();
  }

  // 2. Check Volunteer by AuthUID field
  const volQuery = query(collection(db, "Volunteer"), where("AuthUID", "==", uid));
  const volSnap  = await getDocs(volQuery);
  if (!volSnap.empty) {
    const data = volSnap.docs[0].data();
    return (data.role || "volunteer").toLowerCase();
  }

  // 3. Fallback: Volunteer doc ID = uid (legacy)
  const volDocSnap = await getDoc(doc(db, "Volunteer", uid));
  if (volDocSnap.exists()) {
    const data = volDocSnap.data();
    return (data.role || "volunteer").toLowerCase();
  }

  return null; // not found
}

// ── Sign-in with role-aware redirect ────────────────────────
export async function loginAndRedirect(email, password) {
  try {
    // 1. Sign in
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid        = credential.user.uid;

    // 2. Get role from Firestore (reads `role` field)
    const role = await getRoleFromFirestore(uid);

    if (!role) {
      await signOut(auth);
      return { success: false, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
    }

    // 3. Extra checks per role
    if (role === "admin") {
      const adminSnap = await getDoc(doc(db, "Admin", uid));
      if (adminSnap.exists()) {
        const accountStatus = (
          adminSnap.data().AccountStatus ||
          adminSnap.data().accountStatus || "valid"
        ).toLowerCase();
        if (accountStatus !== "valid" && accountStatus !== "active") {
          await signOut(auth);
          return { success: false, error: "حسابك معلّق. تواصل مع الإدارة." };
        }
      }
    }

    if (role === "volunteer") {
      // Find volunteer doc
      let volData = null;
      const vq = query(collection(db, "Volunteer"), where("AuthUID", "==", uid));
      const vSnap = await getDocs(vq);
      if (!vSnap.empty) {
        volData = vSnap.docs[0].data();
      } else {
        const vDoc = await getDoc(doc(db, "Volunteer", uid));
        if (vDoc.exists()) volData = vDoc.data();
      }

      if (volData) {
        const approvalStatus = (volData.ApprovalStatus || volData.approvalStatus || "").toLowerCase();
        const accountStatus  = (volData.AccountStutes  || volData.AccountStatus  || volData.accountStatus || "").toLowerCase();
        const isApproved =
          approvalStatus === "approved" ||
          approvalStatus === "active"   ||
          accountStatus  === "valid"    ||
          accountStatus  === "active";

        if (!isApproved) {
          await signOut(auth);
          return {
            success: false,
            error: approvalStatus === "pending" || approvalStatus === ""
              ? "حسابك لا يزال قيد المراجعة. يرجى الانتظار حتى يتم القبول."
              : "حسابك لم يتم قبوله أو غير نشط. تواصل مع الإدارة."
          };
        }
      }
    }

    // 4. Store role & redirect
    localStorage.setItem("role", role);
    window.location.href = role === "admin" ? "/Pages/Control.html" : "/Pages/Reports.html";
    return { success: true };

  } catch (err) {
    console.error("Login error:", err.code, err.message);
    return { success: false, error: firebaseErrorToArabic(err.code) };
  }
}

// ── Auth state helper (protected pages) ─────────────────────
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
          const role = await getRoleFromFirestore(user.uid);
          if (!role || role !== requiredRole.toLowerCase()) {
            window.location.href = "/Pages/index.html";
            return;
          }
          localStorage.setItem("role", role); // keep in sync
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
  localStorage.removeItem("role");
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