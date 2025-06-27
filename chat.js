// تهيئة Firebase
const database = firebase.database();
const auth = firebase.auth();

// عناصر DOM
const elements = {
    appTitle: document.getElementById('app-title'),
    userName: document.getElementById('userName'),
    roomSelect: document.getElementById('roomSelect'),
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    onlineCount: document.getElementById('onlineCount'),
    messageCount: document.getElementById('messageCount'),
    currentRoomTitle: document.getElementById('currentRoomTitle'),
    logoutBtn: document.getElementById('logoutBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.querySelector('.modal'),
    modalClose: document.querySelector('.modal-close'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalSaveBtn: document.getElementById('modalSaveBtn'),
    usernameInput: document.getElementById('usernameInput'),
    themeSelect: document.getElementById('themeSelect'),
    soundEnabled: document.getElementById('soundEnabled'),
    messageSound: document.getElementById('messageSound')
};

// متغيرات التطبيق
let currentUser = null;
let currentRoom = 'general';
let settings = JSON.parse(localStorage.getItem('chatSettings')) || {};

// تهيئة التطبيق
function initApp() {
    // تحميل بيانات المستخدم
    const userData = JSON.parse(localStorage.getItem('userData'));
    
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = {
        uid: userData.uid,
        displayName: userData.displayName,
        email: userData.email
    };
    
    // تحديث واجهة المستخدم
    elements.userName.textContent = currentUser.displayName;
    elements.appTitle.textContent = `GOSEM Chat - ${currentUser.displayName}`;
    
    // تحميل الإعدادات
    loadSettings();
    
    // إعداد الأحداث
    initEvents();
    
    // تحميل الرسائل
    loadMessages();
    
    // تحديث حالة المستخدم
    updateUserPresence();
}

// تحميل الإعدادات
function loadSettings() {
    if (settings.username) {
        elements.usernameInput.value = settings.username;
    }
    
    if (settings.theme) {
        elements.themeSelect.value = settings.theme;
        document.body.setAttribute('data-theme', settings.theme);
    }
    
    if (settings.soundEnabled !== undefined) {
        elements.soundEnabled.checked = settings.soundEnabled;
    }
}

// إعداد الأحداث
function initEvents() {
    // إرسال الرسالة
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // تغيير الغرفة
    elements.roomSelect.addEventListener('change', () => {
        currentRoom = elements.roomSelect.value;
        elements.currentRoomTitle.textContent = `غرفة ${getRoomName(currentRoom)}`;
        elements.chatMessages.innerHTML = '';
        loadMessages();
    });
    
    // تسجيل الخروج
    elements.logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            localStorage.removeItem('userData');
            window.location.href = 'index.html';
        });
    });
    
    // فتح/إغلاق الإعدادات
    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsModal.classList.add('active');
    });
    
    elements.modalClose.addEventListener('click', closeSettings);
    elements.modalCancelBtn.addEventListener('click', closeSettings);
    
    // حفظ الإعدادات
    elements.modalSaveBtn.addEventListener('click', saveSettings);
}

// تحديث حالة التواجد
function updateUserPresence() {
    if (!currentUser) return;
    
    const userStatusRef = database.ref('status/' + currentUser.uid);
    const connectedRef = database.ref('.info/connected');
    
    connectedRef.on('value', (snap) => {
        if (snap.val()) {
            userStatusRef.onDisconnect().set({
                status: 'offline',
                lastChanged: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                userStatusRef.set({
                    displayName: currentUser.displayName,
                    status: 'online',
                    lastChanged: firebase.database.ServerValue.TIMESTAMP
                });
            });
        }
    });
    
    // استمع للمستخدمين المتصلين
    const usersRef = database.ref('status');
    usersRef.on('value', (snapshot) => {
        let onlineCount = 0;
        snapshot.forEach(user => {
            if (user.val().status === 'online') onlineCount++;
        });
        elements.onlineCount.textContent = onlineCount;
    });
}

// إرسال الرسالة
function sendMessage() {
    const messageText = elements.messageInput.value.trim();
    if (!messageText) return;
    
    const message = {
        text: messageText,
        sender: currentUser.displayName,
        senderId: currentUser.uid,
        room: currentRoom,
        timestamp: Date.now()
    };
    
    // إرسال الرسالة إلى Firebase
    database.ref('messages').push(message)
        .then(() => {
            elements.messageInput.value = '';
            if (settings.soundEnabled !== false) {
                elements.messageSound.currentTime = 0;
                elements.messageSound.play().catch(e => console.log('خطأ في تشغيل الصوت:', e));
            }
        })
        .catch(error => {
            console.error('خطأ في إرسال الرسالة:', error);
        });
}

// تحميل الرسائل
function loadMessages() {
    let messageCount = 0;
    
    database.ref('messages').orderByChild('room').equalTo(currentRoom).on('value', (snapshot) => {
        elements.chatMessages.innerHTML = '';
        messageCount = 0;
        
        snapshot.forEach(childSnapshot => {
            const message = childSnapshot.val();
            displayMessage(message);
            messageCount++;
        });
        
        elements.messageCount.textContent = messageCount;
        scrollToBottom();
    });
}

// عرض الرسالة
function displayMessage(message) {
    const isCurrentUser = message.senderId === currentUser.uid;
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isCurrentUser ? 'user-message' : 'other-message');
    
    messageElement.innerHTML = `
        <div class="sender">${message.sender}</div>
        <div class="text">${message.text}</div>
        <div class="timestamp">${formatTime(message.timestamp)}</div>
    `;
    
    elements.chatMessages.appendChild(messageElement);
}

// التمرير إلى الأسفل
function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// إغلاق الإعدادات
function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

// حفظ الإعدادات
function saveSettings() {
    // حفظ اسم المستخدم
    const newUsername = elements.usernameInput.value.trim();
    if (newUsername) {
        currentUser.displayName = newUsername;
        settings.username = newUsername;
        elements.userName.textContent = newUsername;
    }
    
    // حفظ السمة
    settings.theme = elements.themeSelect.value;
    document.body.setAttribute('data-theme', settings.theme);
    
    // حفظ إعدادات الصوت
    settings.soundEnabled = elements.soundEnabled.checked;
    
    // حفظ في localStorage
    localStorage.setItem('chatSettings', JSON.stringify(settings));
    
    closeSettings();
    alert('تم حفظ الإعدادات بنجاح!');
}

// تنسيق الوقت
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// اسم الغرفة
function getRoomName(roomId) {
    const rooms = {
        general: 'العامة',
        tech: 'التقنية',
        entertainment: 'الترفيه',
        news: 'الأخبار'
    };
    return rooms[roomId] || roomId;
}

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initApp);