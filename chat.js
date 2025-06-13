document.addEventListener('DOMContentLoaded', () => {
    // تحميل الإعدادات من localStorage أو القيم الافتراضية
    const settings = JSON.parse(localStorage.getItem('chatSettings')) || {};
    let currentUser = settings.username || 'مستخدم غير مسجل'; // اسم افتراضي
    let isAdmin = currentUser.toLowerCase() === 'admin';

    // تطبيق الإعدادات الأولية
    document.documentElement.lang = settings.language || 'ar';
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    document.body.setAttribute('data-theme', settings.theme || 'default');

    // عناصر واجهة المستخدم
    const appTitle = document.getElementById('app-title');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const roomSelect = document.getElementById('roomSelect');
    const adminPanel = document.getElementById('adminPanel');
    const adminMessages = document.getElementById('adminMessages');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const messageSound = document.getElementById('messageSound');
    const notificationSound = document.getElementById('notificationSound'); // الصوت الجديد

    // تحديث عنوان التطبيق ليعرض اسم المستخدم
    appTitle.textContent = `GOSEM Chat (${currentUser})`;

    // متغيرات الحالة
    let currentRoom = 'general';
    let incognitoMode = false; // لوضع الاختفاء
    let selectedNotificationSound = settings.notificationSound || 'notification.mp3'; // صوت إشعار مخصص

    // إظهار لوحة المشرف إذا كان المستخدم مسؤولاً
    if (isAdmin) {
        adminPanel.classList.remove('hidden');
    }

    // إعداد Firebase (نستخدم المتغير 'database' من firebase-config.js)
    const messagesRef = database.ref('messages'); // مرجع للرسائل في قاعدة البيانات

    // استمع للرسائل الجديدة
    messagesRef.on('child_added', snapshot => {
        const message = snapshot.val();
        displayMessage(message);

        // تشغيل صوت الإشعار إذا كانت الرسالة ليست من المستخدم الحالي
        if (message.sender !== currentUser && settings.soundEnabled !== false) {
            notificationSound.src = selectedNotificationSound;
            notificationSound.currentTime = 0;
            notificationSound.play().catch(e => console.log('خطأ في تشغيل صوت الإشعار:', e));
        }

        // تحديث لوحة المشرف
        if (isAdmin) {
            updateAdminPanel(message);
        }
    });

    // حدث إرسال الرسالة
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });

    // حدث تغيير الغرفة
    roomSelect.addEventListener('change', () => {
        currentRoom = roomSelect.value;
        loadRoomMessages();
    });

    // أحداث الإعدادات
    settingsBtn.addEventListener('click', () => {
        openSettingsModal();
    });

    // تحميل رسائل الغرفة الحالية عند البدء
    loadRoomMessages();

    // === الدوال المساعدة ===

    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        const senderName = incognitoMode ? 'مجهول' : currentUser;

        const message = {
            text: messageText,
            sender: senderName,
            room: currentRoom,
            timestamp: Date.now()
        };

        // إرسال الرسالة إلى Firebase
        messagesRef.push(message);

        // تشغيل صوت الإرسال إذا كان مفعلاً
        if (settings.soundEnabled !== false) {
            messageSound.currentTime = 0;
            messageSound.play().catch(e => console.log('خطأ في تشغيل صوت الإرسال:', e));
        }

        // مسح حقل الإدخال
        messageInput.value = '';
    }

    function displayMessage(message) {
        // لا تعرض الرسالة إلا إذا كانت للغرفة الحالية
        if (message.room !== currentRoom) return;

        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.classList.add(message.sender === currentUser || (incognitoMode && message.sender === 'مجهول') ? 'user-message' : 'other-message');

        messageElement.innerHTML = `
            <div class="sender">${message.sender}</div>
            <div class="text">${message.text}</div>
            <div class="timestamp">${formatTime(message.timestamp)}</div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // التمرير إلى الأسفل تلقائياً
    }

    function loadRoomMessages() {
        chatMessages.innerHTML = ''; // مسح الرسائل القديمة عند تغيير الغرفة
        messagesRef.once('value', snapshot => {
            snapshot.forEach(childSnapshot => {
                const message = childSnapshot.val();
                if (message.room === currentRoom) {
                    displayMessage(message);
                }
            });
        });
    }

    function updateAdminPanel(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('admin-message');
        messageElement.innerHTML = `
            <strong>${message.sender}</strong> (${message.room}):
            ${message.text}
            <small>${formatTime(message.timestamp)}</small>
        `;
        adminMessages.appendChild(messageElement);
        adminMessages.scrollTop = adminMessages.scrollHeight; // التمرير إلى الأسفل تلقائياً
    }

    function exportChat() {
        let chatText = `==== محادثة GOSEM - ${currentRoom} ====\n\n`;

        const messages = chatMessages.querySelectorAll('.message');
        messages.forEach(msg => {
            const sender = msg.querySelector('.sender').textContent;
            const text = msg.querySelector('.text').textContent;
            const time = msg.querySelector('.timestamp').textContent;
            chatText += `[${time}] ${sender}: ${text}\n`;
        });

        const blob = new Blob([chatText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gosem-chat-${currentRoom}-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // وظيفة جديدة: استيراد محادثة (عرض فقط، لا تضاف إلى Firebase)
    function importChat() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'text/plain';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = event => {
                const importedText = event.target.result;
                // يمكنك اختيار كيفية عرض المحادثة المستوردة
                // هنا، سنعرضها كرسالة واحدة في الدردشة
                const importedMessage = {
                    sender: 'نظام (مستورد)',
                    text: 'تم استيراد المحادثة: \n' + importedText,
                    room: currentRoom,
                    timestamp: Date.now()
                };
                displayMessage(importedMessage);
                alert('تم استيراد المحادثة بنجاح وعرضها في سجل الدردشة.');
            };
            reader.readAsText(file);
        };
        input.click();
    }

    // وظيفة جديدة: مسح سجل الدردشة (للمشرفين)
    function clearCurrentRoomChat() {
        if (!isAdmin) {
            alert('ليس لديك صلاحيات لمسح الدردشة.');
            return;
        }
        if (confirm(`هل أنت متأكد من مسح جميع الرسائل في غرفة "${currentRoom}"؟ لا يمكن التراجع عن هذا الإجراء!`)) {
            // ملاحظة: مسح الرسائل في Firebase يجب أن يتم بفلترة حسب الغرفة
            // هذا يتطلب تكرار الرسائل في Firebase أو تنظيمها بالغرف
            // لتبسيط المثال، سنحذف جميع الرسائل (هذا ليس مثالياً لبيئة إنتاج)
            // الحل الأفضل هو تنظيم Firebase هكذا: messages/{roomName}/{messageId}
            messagesRef.once('value', snapshot => {
                snapshot.forEach(childSnapshot => {
                    if (childSnapshot.val().room === currentRoom) {
                        childSnapshot.ref.remove();
                    }
                });
            }).then(() => {
                alert(`تم مسح سجل الدردشة لغرفة "${currentRoom}" بنجاح.`);
                chatMessages.innerHTML = ''; // مسح الواجهة
            }).catch(error => {
                console.error('خطأ في مسح الرسائل:', error);
                alert('حدث خطأ أثناء مسح الرسائل.');
            });
        }
    }

    // وظيفة جديدة: البحث في المحادثة
    function searchChat() {
        const searchTerm = prompt('أدخل كلمة للبحث عنها في المحادثة:');
        if (!searchTerm) return;

        const messages = chatMessages.querySelectorAll('.message');
        messages.forEach(msg => {
            const textContent = msg.querySelector('.text').textContent;
            if (textContent.includes(searchTerm)) {
                msg.style.backgroundColor = 'yellow'; // تمييز الرسائل المطابقة
                msg.scrollIntoView({ behavior: 'smooth', block: 'center' }); // التمرير إليها
            } else {
                msg.style.backgroundColor = ''; // إزالة التمييز عن غير المطابقة
            }
        });
        alert('تم تمييز الرسائل التي تحتوي على كلمة البحث.');
    }

    // وظيفة جديدة: فتح شاشة الإعدادات
    function openSettingsModal() {
        const modalContent = document.querySelector('#settingsModal .modal-content');
        modalContent.innerHTML = `
            <span class="close">&times;</span>
            <h2>الإعدادات</h2>
            <div class="settings-section">
                <h3>تسجيل الدخول / اسم المستخدم</h3>
                <div class="form-group">
                    <label for="modal-username">اسم المستخدم:</label>
                    <input type="text" id="modal-username" value="${currentUser}" placeholder="أدخل اسمك">
                    <small>استخدم "admin" للوصول إلى لوحة التحكم</small>
                </div>
                <button id="saveUsernameBtn" class="btn-primary">حفظ اسم المستخدم</button>
            </div>

            <div class="settings-section">
                <h3>إعدادات العرض</h3>
                <div class="form-group">
                    <label for="modal-language">اللغة:</label>
                    <select id="modal-language">
                        <option value="ar" ${settings.language === 'ar' ? 'selected' : ''}>العربية</option>
                        <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="modal-theme">السمة:</label>
                    <select id="modal-theme">
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

            <div class="settings-section">
                <h3>التحكم بالدردشات</h3>
                <div class="form-group">
                    <button id="clearChatBtn" class="btn-primary">مسح سجل الدردشة الحالي</button>
                    <small> (للمشرفين فقط - يحذف رسائل الغرفة الحالية)</small>
                </div>
                <div class="form-group">
                    <button id="blockUserBtn" class="btn-primary">حظر مستخدم</button>
                    <small> (وظيفة تحتاج تطبيق منطق الحظر في Firebase)</small>
                </div>
            </div>

            <div class="settings-section">
                <h3>التخزين</h3>
                <div class="form-group">
                    <button id="exportChatBtn" class="btn-primary">تصدير المحادثة الحالية</button>
                </div>
                <div class="form-group">
                    <button id="importChatBtn" class="btn-primary">استيراد وعرض محادثة</button>
                    <small>(لا يتم رفعها إلى Firebase)</small>
                </div>
            </div>

            <div class="settings-section">
                <h3>إعدادات Firebase</h3>
                <div class="form-group">
                    <label for="firebaseConfigDisplay">إعدادات Firebase (للعرض فقط):</label>
                    <textarea id="firebaseConfigDisplay" rows="6" disabled>${JSON.stringify(firebaseConfig, null, 2)}</textarea>
                    <small> هذه الإعدادات مدمجة في التطبيق ولا يمكن تغييرها من هنا.</small>
                </div>
            </div>

            <div class="settings-section">
                <h3>ميزات إضافية</h3>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="incognitoMode" ${incognitoMode ? 'checked' : ''}>
                        وضع الاختفاء (إرسال رسائل باسم "مجهول")
                    </label>
                </div>
                <div class="form-group">
                    <label for="notificationSoundSelect">صوت إشعار الرسائل الجديدة:</label>
                    <select id="notificationSoundSelect">
                        <option value="notification.mp3" ${selectedNotificationSound === 'notification.mp3' ? 'selected' : ''}>صوت افتراضي 1</option>
                        <option value="message-sent.mp3" ${selectedNotificationSound === 'message-sent.mp3' ? 'selected' : ''}>صوت افتراضي 2</option>
                        </select>
                </div>
                <div class="form-group">
                    <button id="searchChatBtn" class="btn-primary">البحث في المحادثة</button>
                </div>
                 <div class="form-group">
                    <button id="usersInRoomBtn" class="btn-primary">عرض المستخدمين في الغرفة</button>
                    <small>(تتطلب منطقًا إضافيًا لتتبع المستخدمين النشطين)</small>
                </div>
                <div class="form-group">
                    <button id="messageExpiryBtn" class="btn-primary">تحديد وقت انتهاء صلاحية للرسائل</button>
                    <small>(تتطلب منطقًا متقدمًا في Firebase)</small>
                </div>
            </div>

            <button id="saveSettings" class="btn-primary">حفظ الإعدادات الأخرى</button>
        `;

        settingsModal.classList.remove('hidden');

        // إعداد أحداث العناصر الجديدة داخل المودال
        document.querySelector('#settingsModal .close').addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });

        document.getElementById('saveUsernameBtn').addEventListener('click', () => {
            const newUsername = document.getElementById('modal-username').value.trim();
            if (newUsername) {
                currentUser = newUsername;
                isAdmin = currentUser.toLowerCase() === 'admin';
                settings.username = currentUser;
                localStorage.setItem('chatSettings', JSON.stringify(settings));
                appTitle.textContent = `GOSEM Chat (${currentUser})`;
                alert('تم حفظ اسم المستخدم بنجاح!');
                if (isAdmin) {
                    adminPanel.classList.remove('hidden');
                } else {
                    adminPanel.classList.add('hidden');
                }
            } else {
                alert('الرجاء إدخال اسم مستخدم صالح.');
            }
        });

        document.getElementById('saveSettings').addEventListener('click', () => {
            settings.language = document.getElementById('modal-language').value;
            settings.theme = document.getElementById('modal-theme').value;
            settings.soundEnabled = document.getElementById('modal-sound').checked;
            selectedNotificationSound = document.getElementById('notificationSoundSelect').value;
            settings.notificationSound = selectedNotificationSound; // حفظ الصوت المخصص

            localStorage.setItem('chatSettings', JSON.stringify(settings));

            // إعادة تطبيق الإعدادات
            document.documentElement.lang = settings.language;
            document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
            document.body.setAttribute('data-theme', settings.theme);
            notificationSound.src = selectedNotificationSound; // تحديث الصوت في المشغل

            alert('تم حفظ الإعدادات بنجاح!');
            settingsModal.classList.add('hidden');
        });

        document.getElementById('exportChatBtn').addEventListener('click', exportChat);
        document.getElementById('importChatBtn').addEventListener('click', importChat);
        document.getElementById('clearChatBtn').addEventListener('click', clearCurrentRoomChat);
        document.getElementById('searchChatBtn').addEventListener('click', searchChat);
        // أحداث الوظائف الجديدة الأخرى
        document.getElementById('incognitoMode').addEventListener('change', (e) => {
            incognitoMode = e.target.checked;
        });

        // مثال لزر حظر المستخدم (يتطلب منطقًا backend)
        document.getElementById('blockUserBtn').addEventListener('click', () => {
            alert('وظيفة حظر المستخدم تحتاج إلى تطوير منطق على جانب الخادم وقاعدة البيانات.');
        });
        // مثال لزر عرض المستخدمين في الغرفة (يتطلب منطقًا backend)
        document.getElementById('usersInRoomBtn').addEventListener('click', () => {
            alert('وظيفة عرض المستخدمين في الغرفة تحتاج إلى تطوير لتتبع المستخدمين النشطين.');
        });
        // مثال لزر انتهاء صلاحية الرسائل (يتطلب منطقًا backend)
        document.getElementById('messageExpiryBtn').addEventListener('click', () => {
            alert('وظيفة تحديد انتهاء صلاحية الرسائل تحتاج إلى منطق متقدم في Firebase لحذف الرسائل تلقائياً.');
        });
    }
});