import {
  initializeApp
} from
"https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";


import {
  getFirestore
} from
"https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

import {
  getAuth
} from
"https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";


const firebaseConfig = {

  apiKey:
    "AIzaSyDT3SdjAPUq659m8T0eL0LT0pwkcIw1sT8",

  authDomain:
    "hajin-family-album.firebaseapp.com",

  projectId:
    "hajin-family-album",

  storageBucket:
    "hajin-family-album.firebasestorage.app",

  messagingSenderId:
    "28540425787",

  appId:
    "1:28540425787:web:89293bf62ad395e7ecee1e"

};


const app =
  initializeApp(
    firebaseConfig
  );


export const db =
  getFirestore(app);


export const auth =
  getAuth(app);
