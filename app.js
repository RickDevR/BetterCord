import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, setDoc, getDoc, updateDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const appContainer = document.getElementById('app-container');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const authError = document.getElementById('auth-error');
const emailGroup = document.getElementById('email-group');

const myUsernameDisplay = document.getElementById('my-username-display');
const myUserAvatar = document.getElementById('my-user-avatar');
const settingsAvatarPreview = document.getElementById('settings-avatar-preview');
const settingsUsernameInput = document.getElementById('settings-username-input');
const settingsEmailInput = document.getElementById('settings-email-input');
const saveProfileBtn = document.getElementById('save-profile-btn');

const openSettingsBtn = document.getElementById('open-settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const logoutMenuBtn = document.getElementById('logout-menu-btn');

const chatInput = document.getElementById('chat-input');
const sendMsgBtn = document.getElementById('send-msg-btn');
const messagesContainer = document.getElementById('messages-container');

const startCallBtn = document.getElementById('start-call-btn');
const callModal = document.getElementById('call-modal');
const endCallBtn = document.getElementById('end-call-btn');
const toggleMicBtn = document.getElementById('toggle-mic-btn');
const toggleCamBtn = document.getElementById('toggle-cam-btn');
const localVideo = document.getElementById('local-video');

const currentPasswordInput = document.getElementById('current-password-input');
const newPasswordInput = document.getElementById('new-password-input');
const changePasswordBtn = document.getElementById('change-password-btn');

const membersList = document.getElementById('members-list');
const onlineCount = document.getElementById('online-count');
const avatarFileInput = document.getElementById('avatar-file-input');

let isSignUp = false;
let currentUser = null;
let currentChannelId = 'general';
let localStream = null;
let unsubMessages = null;

// Handle Auth Mode Switching
authSwitchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isSignUp = !isSignUp;
    if (isSignUp) {
        authSubmitBtn.textContent = 'Sign Up';
        authSwitchText.textContent = 'Already have an account?';
        authSwitchBtn.textContent = 'Log In';
    } else {
        authSubmitBtn.textContent = 'Log In';
        authSwitchText.textContent = 'Need an account?';
        authSwitchBtn.textContent = 'Sign Up';
    }
});

// Authentication Form Submit
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    const email = authEmail.value;
    const username = authUsername.value;
    const password = authPassword.value;

    try {
        if (isSignUp) {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCred.user;
            const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                username: username,
                email: email,
                avatar: defaultAvatar,
                status: 'online',
                createdAt: serverTimestamp()
            });
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
    } catch (err) {
        authError.textContent = err.message;
        authError.classList.remove('hidden');
    }
});

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        authOverlay.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        let userData = {};
        if (userDoc.exists()) {
            userData = userDoc.data();
        } else {
            userData = {
                username: user.email.split('@')[0],
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
                email: user.email
            };
            await setDoc(userDocRef, userData);
        }

        localStorage.setItem('bettercord_user', JSON.stringify(userData));
        myUsernameDisplay.textContent = userData.username;
        myUserAvatar.src = userData.avatar;
        settingsAvatarPreview.src = userData.avatar;
        settingsUsernameInput.value = userData.username;
        settingsEmailInput.value = userData.email;

        loadMessages(currentChannelId);
        loadMembers();
    } else {
        currentUser = null;
        localStorage.removeItem('bettercord_user');
        appContainer.classList.add('hidden');
        authOverlay.classList.remove('hidden');
        if (unsubMessages) unsubMessages();
    }
});

// Send Message
sendMsgBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !currentUser) return;

    const cachedUser = JSON.parse(localStorage.getItem('bettercord_user') || '{}');
    chatInput.value = '';

    try {
        await addDoc(collection(db, "messages"), {
            text: text,
            channelId: currentChannelId,
            uid: currentUser.uid,
            username: cachedUser.username || 'User',
            avatar: cachedUser.avatar || '',
            createdAt: serverTimestamp()
        });
    } catch (err) {
        console.error("Error sending message:", err);
    }
}

// Load Messages real-time from Firestore
function loadMessages(channelId) {
    if (unsubMessages) unsubMessages();

    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    unsubMessages = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            if (msg.channelId === channelId) {
                const msgEl = document.createElement('div');
                msgEl.className = 'message';
                const timeStr = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
                
                msgEl.innerHTML = `
                    <img src="${msg.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=default'}" class="message-avatar">
                    <div class="message-content">
                        <div class="message-header">
                            <span class="message-username">${escapeHtml(msg.username)}</span>
                            <span class="message-timestamp">${timeStr}</span>
                        </div>
                        <div class="message-text">${escapeHtml(msg.text)}</div>
                    </div>
                `;
                messagesContainer.appendChild(msgEl);
            }
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

// Load Members
function loadMembers() {
    const q = query(collection(db, "users"));
    onSnapshot(q, (snapshot) => {
        membersList.innerHTML = '';
        let count = 0;
        snapshot.forEach((docSnap) => {
            count++;
            const member = docSnap.data();
            const memberEl = document.createElement('div');
            memberEl.className = 'member-item';
            memberEl.innerHTML = `
                <img src="${member.avatar}" class="member-avatar">
                <span class="member-name">${escapeHtml(member.username)}</span>
            `;
            membersList.appendChild(memberEl);
        });
        onlineCount.textContent = count;
    });
}

// Update Username in Firestore instantly without duplication
saveProfileBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    const newUsername = settingsUsernameInput.value.trim();
    if (!newUsername) return;

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
            username: newUsername
        });

        const cachedUser = JSON.parse(localStorage.getItem('bettercord_user') || '{}');
        cachedUser.username = newUsername;
        localStorage.setItem('bettercord_user', JSON.stringify(cachedUser));

        myUsernameDisplay.textContent = newUsername;
        alert("Profile updated successfully!");
        settingsModal.classList.add('hidden');
    } catch (err) {
        alert("Error updating profile: " + err.message);
    }
});

// Avatar File Reader for local base64 storage & preview
avatarFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(uploadEvent) {
            const base64Image = uploadEvent.target.result;
            settingsAvatarPreview.src = base64Image;
            myUserAvatar.src = base64Image;

            if (currentUser) {
                await updateDoc(doc(db, "users", currentUser.uid), {
                    avatar: base64Image
                });
                const cachedUser = JSON.parse(localStorage.getItem('bettercord_user') || '{}');
                cachedUser.avatar = base64Image;
                localStorage.setItem('bettercord_user', JSON.stringify(cachedUser));
            }
        };
        reader.readAsDataURL(file);
    }
});

// Change Password Feature
changePasswordBtn.addEventListener('click', async () => {
    const currentPass = currentPasswordInput.value;
    const newPass = newPasswordInput.value;

    if (!currentPass || !newPass) {
        alert("Please fill in both current and new passwords.");
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPass);
        alert("Password updated successfully!");
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
    } catch (err) {
        alert("Error updating password: " + err.message);
    }
});

// Settings & Modals
openSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
logoutMenuBtn.addEventListener('click', async () => {
    await signOut(auth);
});

// Voice / Video Call WebRTC Stream
startCallBtn.addEventListener('click', async () => {
    callModal.classList.remove('hidden');
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error("Error accessing camera/mic:", err);
        alert("Could not access camera or microphone.");
    }
});

endCallBtn.addEventListener('click', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    localVideo.srcObject = null;
    callModal.classList.add('hidden');
});

let micMuted = false;
toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
        micMuted = !micMuted;
        localStream.getAudioTracks()[0].enabled = !micMuted;
        toggleMicBtn.classList.toggle('red', micMuted);
    }
});

let camOff = false;
toggleCamBtn.addEventListener('click', () => {
    if (localStream) {
        camOff = !camOff;
        localStream.getVideoTracks()[0].enabled = !camOff;
        toggleCamBtn.classList.toggle('red', camOff);
    }
});

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}