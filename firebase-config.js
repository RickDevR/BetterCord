// Firebase Configuration & Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB5aAwZNWcJEbVBUXu3S_Q68drt1mZ20bE",
    authDomain: "bettercord-52166.firebaseapp.com",
    projectId: "bettercord-52166",
    storageBucket: "bettercord-52166.firebasestorage.app",
    messagingSenderId: "31822010107",
    appId: "1:31822010107:web:fb7a95036abe214e0d425e",
    measurementId: "G-83JVF5WXP4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);