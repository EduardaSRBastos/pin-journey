// firebase login
const firebaseConfig = {
  apiKey: "AIzaSyCglchne9dKGL8CJjSuZ70UONIFEYKDz14",
  authDomain: "pin-journey.firebaseapp.com",
  projectId: "pin-journey",
  storageBucket: "pin-journey.firebasestorage.app",
  messagingSenderId: "663523734493",
  appId: "1:663523734493:web:ac314b331d64c3c9ff7c34",
  measurementId: "G-K4XVZSWHKN",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let currentUserId;

const provider = new firebase.auth.GoogleAuthProvider();

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUserId = user.uid;
    console.log("Signed in as:", user.email);
    document.getElementById("login").style.display = "none";
    document.getElementById("logout").style.display = "block";

    loadVisitedStates().then(() => {
      recalculateStatsFromColoredStates();
      updateInfo();
      updateCountryMarkers();
      updateContinentMarkers();
    });
  } else {
    console.log("No user signed in");
    document.getElementById("login").style.display = "block";
    document.getElementById("logout").style.display = "none";
  }
});

document.getElementById("login").addEventListener("click", async () => {
  try {
    const result = await auth.signInWithPopup(provider);
    currentUserId = result.user.uid;

    loadVisitedStates().then(() => {
      recalculateStatsFromColoredStates();
      updateInfo();
      updateCountryMarkers();
      updateContinentMarkers();
    });
  } catch (err) {
    console.error("Login error:", err);
  }
});

document.getElementById("logout").addEventListener("click", () => {
  auth.signOut().then(() => {
    currentUserId = null;
    console.log("Logged out");
    document.getElementById("login").style.display = "block";
    document.getElementById("logout").style.display = "none";
  });
});

// get visited states and update stats function
async function loadVisitedStates() {
  const localData = JSON.parse(localStorage.getItem("visitedStates") || "[]");
  const localTime = Number(
    localStorage.getItem("visitedStatesLastUpdated") || 0
  );

  let cloudData = [];
  let cloudTime = 0;

  if (currentUserId) {
    try {
      const doc = await db.collection("users").doc(currentUserId).get();
      if (doc.exists) {
        const data = doc.data();
        cloudData = Array.isArray(data.visitedStates) ? data.visitedStates : [];
        cloudTime = data.lastUpdated || 0;
      }
    } catch (err) {
      console.error("Firestore load error:", err);
    }
  }

  if (cloudTime > localTime) {
    coloredStates.clear();
    cloudData.forEach((s) => coloredStates.add(s));
    localStorage.setItem("visitedStates", JSON.stringify(cloudData));
    localStorage.setItem("visitedStatesLastUpdated", cloudTime);
    console.log("Loaded from Firestore (newer data)");
  } else {
    coloredStates.clear();
    localData.forEach((s) => coloredStates.add(s));
    console.log("Loaded from LocalStorage (newer data)");
    if (currentUserId && cloudTime < localTime) {
      await saveVisitedStates();
    }
  }

  coloredCount = coloredStates.size;
}

// save visited states function
async function saveVisitedStates() {
  const data = [...coloredStates];
  const timestamp = Date.now();

  localStorage.setItem("visitedStates", JSON.stringify(data));
  localStorage.setItem("visitedStatesLastUpdated", timestamp);

  if (currentUserId) {
    try {
      await db.collection("users").doc(currentUserId).set(
        {
          visitedStates: data,
          lastUpdated: timestamp,
        },
        { merge: true }
      );
      console.log("Saved to Firestore");
    } catch (err) {
      console.error("Firestore save error:", err);
    }
  }
}
