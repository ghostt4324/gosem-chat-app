// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBuu8nb0NVeR95WQ1En-gs_pH8kJpwQrm4",
    authDomain: "myappchat-b7894.firebaseapp.com",
    databaseURL: "https://myappchat-b7894-default-rtdb.firebaseio.com",
    projectId: "myappchat-b7894",
    storageBucket: "myappchat-b7894.firebasestorage.app",
    messagingSenderId: "751116646298",
    appId: "1:751116646298:web:d998d5e6a14fe4901b6c23",
    measurementId: "G-SYC0179PD8"
};

// Initialize Firebase
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized with new config");
}

// Get database reference
const database = firebase.database();