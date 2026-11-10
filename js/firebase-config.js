import { initializeApp } from
"https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth } from
"https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from
"https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBr9l6OfQvKDhjIriLouC9lZz4C8KT_124",
    authDomain: "hogarfix-f9f56.firebaseapp.com",
    projectId: "hogarfix-f9f56",
    storageBucket: "hogarfix-f9f56.firebasestorage.app",
    messagingSenderId: "599874947268",
    appId: "1:599874947268:web:7beb4997ae19880e89e191"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("HogarFix conectado a Firebase");
