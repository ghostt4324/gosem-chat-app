// تهيئة Firebase
const database = firebase.database();
const auth = firebase.auth();

// متغيرات التطبيق
let currentUser = null;
let currentRoom = 'general';
let isAdmin = false;
let settings = JSON.parse(localStorage.getItem('chatSettings')) || {};

// عناصر DOM
const elements = {
    appTitle: document.getElementById('app-title'),
    roomSelect: document.getElementById('roomSelect'),
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    adminPanel: document.getElementById('adminPanel'),
    adminMessages: document.getElementById('adminMessages'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.querySelector('.modal'),
    modalBody: document.querySelector('.modal-body'),
    modalSaveBtn: document.getElementById('modalSaveBtn'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    onlineCount: document.getElementById('onlineCount'),
    messageCount: document.getElementById('messageCount'),
    currentRoomTitle: document.getElementById('currentRoomTitle'),
    scrollToBottomBtn: document.getElementById('scrollToBottomBtn'),
    scrollIndicator: document.querySelector('.scroll-indicator'),
    roomInviteBtn: document.getElementById('roomInviteBtn'),
    roomFavoriteBtn: document.getElementById('roomFavoriteBtn'),
    messageSound: document.getElementById('messageSound'),
    notificationSound: document.getElementById('notificationSound'),
    appLoader: document.querySelector('.app-loader'),
    appContainer: document.querySelector('.app-container')
};

// دالة تهيئة التطبيق
function initApp() {
    // تسجيل الدخول المجهول
    auth.signInAnonymously()
        .then(() => {
            console.log("تم تسجيل الدخول كمستخدم مجهول");
        })
        .catch(error => {
            console.error("خطأ في تسجيل الدخول:", error);
        });
    
    // استمع لتغير حالة المصادقة
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = {
                uid: user.uid,
                displayName: settings.username || `مستخدم_${Math.floor(Math.random() * 1000)}`
            };
            elements.appTitle.textContent = `GOSEM Chat (${currentUser.displayName})`;
            isAdmin = currentUser.displayName.toLowerCase() === 'admin';
            if (isAdmin) {
                elements.adminPanel.classList.remove('hidden');
            }
            
            // إخفاء شاشة التحميل وإظهار التطبيق
            setTimeout(() => {
                elements.appLoader.style.opacity = '0';
                setTimeout(() => {
                    elements.appLoader.classList.add('hidden');
                    elements.appContainer.classList.add('active');
                }, 500);
            }, 1000);
        } else {
            console.log("المستخدم غير مسجل الدخول");
        }
    });
    
    // تهيئة الأحداث
    initEvents();
    
    // تحميل الرسائل
    loadMessages();
    
    // تحديث حالة المستخدم
    updateUserPresence();
}

// تحديث حالة التواجد
function updateUserPresence() {
    if (!currentUser) return;
    
    const userStatusRef = database.ref('status/' + currentUser.uid);
    const connectedRef = database.ref('.info/connected');
    
    connectedRef.on('value', (snap) => {
        if (snap.val()) {
            userStatusRef.onDisconnect().set({
                displayName: currentUser.displayName,
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

// تهيئة الأحداث
function initEvents() {
    // إرسال الرسالة
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // تغيير الغرفة
    elements.roomSelect.addEventListener('change', () => {
        currentRoom = elements.roomSelect.value;
        elements.currentRoomTitle.textContent = `غرفة ${getRoomName(currentRoom)}`;
        elements.chatMessages.innerHTML = '';
        loadMessages();
    });
    
    // فتح الإعدادات
    elements.settingsBtn.addEventListener('click', openSettings);
    document.querySelector('.modal-close').addEventListener('click', closeSettings);
    elements.modalCancelBtn.addEventListener('click', closeSettings);
    
    // حفظ الإعدادات
    elements.modalSaveBtn.addEventListener('click', saveSettings);
    
    // التمرير إلى الأسفل
    elements.scrollToBottomBtn.addEventListener('click', scrollToBottom);
    
    // إغلاق النافذة عند النقر خارجها
    document.querySelector('.modal-overlay').addEventListener('click', closeSettings);
    
    // تحديث شارة الإشعارات عند فتح الصفحة
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            document.querySelector('.notification-badge').classList.add('hidden');
        }
    });
    
    // دعوة مستخدم
    elements.roomInviteBtn.addEventListener('click', () => {
        alert('ميزة الدعوة قريبًا!');
    });
    
    // إضافة الغرفة للمفضلة
    elements.roomFavoriteBtn.addEventListener('click', function() {
        this.classList.toggle('active');
        this.innerHTML = this.classList.contains('active') ? 
            '<i class="fas fa-star"></i> مفضلة' : 
            '<i class="far fa-star"></i> مفضلة';
    });
}

// دالة إرسال الرسالة
function sendMessage() {
    const messageText = elements.messageInput.innerText.trim();
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
            elements.messageInput.innerText = '';
            playSound('messageSound');
        })
        .catch(error => {
            console.error('خطأ في إرسال الرسالة:', error);
        });
}

// دالة تحميل الرسائل
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
    
    // إنشاء فقاعة الرسالة
    messageElement.innerHTML = `
        <div class="sender">
            <span>${message.sender}</span>
            ${!isCurrentUser ? '<span class="user-status">نشط الآن</span>' : ''}
        </div>
        <div class="text">${message.text}</div>
        <div class="timestamp">${formatTime(message.timestamp)}</div>
    `;
    
    elements.chatMessages.appendChild(messageElement);
    
    // تشغيل صوت الإشعار إذا لم تكن الرسالة من المستخدم الحالي
    if (!isCurrentUser) {
        playSound('notificationSound');
        updateNotificationBadge();
    }
}

// تحديث شارة الإشعارات
function updateNotificationBadge() {
    if (document.hidden) {
        const badge = document.querySelector('.notification-badge');
        let count = parseInt(badge.textContent) || 0;
        count++;
        badge.textContent = count;
        badge.classList.remove('hidden');
    }
}

// التمرير إلى الأسفل
function scrollToBottom() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    elements.scrollIndicator.classList.remove('visible');
}

// التحقق من الحاجة للتمرير
elements.chatMessages.addEventListener('scroll', function() {
    const scrollThreshold = 100;
    const isNearBottom = this.scrollHeight - this.scrollTop - this.clientHeight < scrollThreshold;
    
    if (!isNearBottom) {
        elements.scrollIndicator.classList.add('visible');
    } else {
        elements.scrollIndicator.classList.remove('visible');
    }
});

// دالة فتح الإعدادات
function openSettings() {
    elements.modalBody.innerHTML = `
        <div class="setting-section">
            <h3><i class="fas fa-user"></i> حساب المستخدم</h3>
            <div class="form-group">
                <label>اسم المستخدم</label>
                <input type="text" id="usernameInput" value="${currentUser.displayName}" class="input-field">
            </div>
            <button id="saveUsernameBtn" class="btn-primary">حفظ</button>
        </div>
        
        <div class="setting-section">
            <h3><i class="fas fa-palette"></i> المظهر</h3>
            <div class="form-group">
                <label>السمة</label>
                <select id="themeSelect" class="input-field">
                    <option value="default" ${settings.theme === 'default' ? 'selected' : ''}>افتراضي</option>
                    <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>داكن</option>
                    <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>فاتح</option>
                    <option value="blue" ${settings.theme === 'blue' ? 'selected' : ''}>أزرق</option>
                    <option value="green" ${settings.theme === 'green' ? 'selected' : ''}>أخضر</option>
                    <option value="purple" ${settings.theme === 'purple' ? 'selected' : ''}>بنفسجي</option>
                    <option value="red" ${settings.theme === 'red' ? 'selected' : ''}>أحمر</option>
                </select>
            </div>
        </div>
        
        <div class="setting-section">
            <h3><i class="fas fa-volume-up"></i> الأصوات</h3>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="soundEnabled" ${settings.soundEnabled !== false ? 'checked' : ''}>
                    تفعيل الأصوات
                </label>
            </div>
            <div class="form-group">
                <label>صوت الإشعارات</label>
                <select id="notificationSoundSelect" class="input-field">
                    <option value="1">نغمة 1</option>
                    <option value="2">نغمة 2</option>
                    <option value="3">نغمة 3</option>
                </select>
            </div>
        </div>
        
        <div class="setting-section">
            <h3><i class="fas fa-shield-alt"></i> الخصوصية</h3>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="incognitoMode" ${settings.incognitoMode ? 'checked' : ''}>
                    وضع الاختفاء (إرسال كـ "مجهول")
                </label>
            </div>
        </div>
        
        <div class="setting-section">
            <h3><i class="fas fa-language"></i> اللغة</h3>
            <div class="form-group">
                <label>
                    <input type="radio" name="language" id="langAr" ${settings.language !== 'en' ? 'checked' : ''}>
                    العربية
                </label>
                <label>
                    <input type="radio" name="language" id="langEn" ${settings.language === 'en' ? 'checked' : ''}>
                    English
                </label>
            </div>
        </div>
    `;
    
    // أحداث الإعدادات
    document.getElementById('saveUsernameBtn').addEventListener('click', saveUsername);
    document.getElementById('themeSelect').addEventListener('change', updateThemePreview);
    
    elements.settingsModal.classList.add('active');
}

// إغلاق الإعدادات
function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

// حفظ الإعدادات
function saveSettings() {
    // حفظ اسم المستخدم
    const newUsername = document.getElementById('usernameInput').value.trim();
    if (newUsername) {
        currentUser.displayName = newUsername;
        settings.username = newUsername;
        elements.appTitle.textContent = `GOSEM Chat (${newUsername})`;
    }
    
    // حفظ السمة
    settings.theme = document.getElementById('themeSelect').value;
    document.body.setAttribute('data-theme', settings.theme);
    
    // حفظ إعدادات الصوت
    settings.soundEnabled = document.getElementById('soundEnabled').checked;
    settings.notificationSound = document.getElementById('notificationSoundSelect').value;
    
    // حفظ وضع الاختفاء
    settings.incognitoMode = document.getElementById('incognitoMode').checked;
    
    // حفظ اللغة
    settings.language = document.getElementById('langEn').checked ? 'en' : 'ar';
    
    // حفظ في localStorage
    localStorage.setItem('chatSettings', JSON.stringify(settings));
    
    closeSettings();
    alert('تم حفظ الإعدادات بنجاح!');
}

// حفظ اسم المستخدم
function saveUsername() {
    const newUsername = document.getElementById('usernameInput').value.trim();
    if (newUsername) {
        currentUser.displayName = newUsername;
        settings.username = newUsername;
        localStorage.setItem('chatSettings', JSON.stringify(settings));
        elements.appTitle.textContent = `GOSEM Chat (${newUsername})`;
        isAdmin = newUsername.toLowerCase() === 'admin';
        elements.adminPanel.classList.toggle('hidden', !isAdmin);
        alert('تم حفظ اسم المستخدم بنجاح!');
    } else {
        alert('الرجاء إدخال اسم مستخدم صالح.');
    }
}

// معاينة السمة
function updateThemePreview() {
    const theme = document.getElementById('themeSelect').value;
    document.body.setAttribute('data-theme', theme);
}

// تشغيل الصوت
function playSound(id) {
    if (settings.soundEnabled !== false) {
        const sound = document.getElementById(id);
        sound.currentTime = 0;
        sound.play().catch(e => console.log('خطأ في تشغيل الصوت:', e));
    }
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
        news: 'الأخبار',
        support: 'الدعم الفني'
    };
    return rooms[roomId] || roomId;
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initApp);