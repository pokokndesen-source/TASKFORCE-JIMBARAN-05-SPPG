// ============================================
// SPPG - JIMBARAN 5 - ALARM MODULE V2
// ============================================
// Role-based permissions:
// - View Only / Can Edit: Bunyi, durasi, volume only
// - Full Access: Edit timeline + all settings
// ============================================

const AlarmModule = {
    // Default MBG Schedule (can be edited by Full Access)
    DEFAULT_SCHEDULE: [
        { id: 1, jam: '02:00', label: 'Persiapan dimulai', icon: 'moon' },
        { id: 2, jam: '03:00', label: 'Tim masuk & masak', icon: 'chef' },
        { id: 3, jam: '04:30', label: 'Kloter 1 selesai', icon: 'check' },
        { id: 4, jam: '05:00', label: 'Packing & Test Food', icon: 'box' },
        { id: 5, jam: '07:45', label: 'Distribusi Kloter 1', icon: 'truck' },
        { id: 6, jam: '09:00', label: 'Distribusi Kloter 2', icon: 'truck' },
        { id: 7, jam: '10:00', label: 'Distribusi Kloter 3', icon: 'truck' },
        { id: 8, jam: '13:00', label: 'Pengambilan Alat', icon: 'download' },
        { id: 9, jam: '15:00', label: 'Closing & QC', icon: 'clipboard' }
    ],

    // Icon mapping (emoji)
    ICONS: {
        moon: '🌙',
        chef: '👨‍🍳',
        check: '✅',
        box: '📦',
        truck: '🚚',
        download: '📥',
        clipboard: '📋',
        bell: '🔔',
        clock: '⏰',
        star: '⭐'
    },

    // Sound types
    SOUNDS: {
        beep: { name: 'Beep', frequencies: [800, 1000, 800] },
        chime: { name: 'Chime', frequencies: [523, 659, 784] },
        bell: { name: 'Bell', frequencies: [440, 554, 659] },
        alert: { name: 'Alert', frequencies: [1000, 800, 1000] }
    },

    // Current schedule (loaded from storage or default)
    schedule: [],

    // User settings (stored locally per device)
    settings: {
        enabled: true,
        soundType: 'beep',
        duration: 'normal',  // short, normal, long
        volume: 0.5,
        vibrate: true,
        reminderMinutes: 5
    },

    checkInterval: null,
    lastNotified: {},

    // Initialize
    init: () => {
        console.log('🔔 AlarmModule V2 initializing...');
        AlarmModule.loadSettings();
        AlarmModule.loadSchedule();
        AlarmModule.requestPermission();
        AlarmModule.startChecking();
        console.log('✅ AlarmModule V2 ready');
    },

    // Load user settings from localStorage
    loadSettings: () => {
        const saved = localStorage.getItem('sppg_alarm_settings_v2');
        if (saved) {
            try {
                AlarmModule.settings = { ...AlarmModule.settings, ...JSON.parse(saved) };
            } catch (e) {
                console.log('Error loading alarm settings');
            }
        }
    },

    // Save user settings
    saveSettings: () => {
        localStorage.setItem('sppg_alarm_settings_v2', JSON.stringify(AlarmModule.settings));
    },

    // Load schedule (from localStorage or use default)
    loadSchedule: () => {
        const saved = localStorage.getItem('sppg_alarm_schedule');
        if (saved) {
            try {
                AlarmModule.schedule = JSON.parse(saved);
            } catch (e) {
                AlarmModule.schedule = [...AlarmModule.DEFAULT_SCHEDULE];
            }
        } else {
            AlarmModule.schedule = [...AlarmModule.DEFAULT_SCHEDULE];
        }
    },

    // Save schedule
    saveSchedule: () => {
        localStorage.setItem('sppg_alarm_schedule', JSON.stringify(AlarmModule.schedule));
    },

    // Reset schedule to default
    resetToDefault: () => {
        AlarmModule.schedule = [...AlarmModule.DEFAULT_SCHEDULE];
        AlarmModule.saveSchedule();
        if (window.App?.showToast) {
            window.App.showToast('success', '✅ Timeline direset ke default');
        }
    },

    // Request notification permission
    requestPermission: async () => {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    },

    // Start periodic checking
    startChecking: () => {
        AlarmModule.checkSchedule();
        AlarmModule.checkInterval = setInterval(() => {
            AlarmModule.checkSchedule();
        }, 30000);
    },

    // Check if any alarm should trigger
    checkSchedule: () => {
        if (!AlarmModule.settings.enabled) return;

        const now = new Date();
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMinute = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentHour}:${currentMinute}`;
        const today = now.toDateString();

        AlarmModule.schedule.forEach(item => {
            const [schedHour, schedMin] = item.jam.split(':').map(Number);
            const schedDate = new Date();
            schedDate.setHours(schedHour, schedMin, 0, 0);

            const reminderDate = new Date(schedDate.getTime() - (AlarmModule.settings.reminderMinutes * 60 * 1000));
            const reminderHour = reminderDate.getHours().toString().padStart(2, '0');
            const reminderMin = reminderDate.getMinutes().toString().padStart(2, '0');
            const reminderTime = `${reminderHour}:${reminderMin}`;

            if (currentTime === reminderTime) {
                const notifyKey = `${today}_${item.jam}`;
                if (!AlarmModule.lastNotified[notifyKey]) {
                    AlarmModule.lastNotified[notifyKey] = true;
                    AlarmModule.triggerAlarm(item);
                }
            }
        });
    },

    // Trigger alarm
    triggerAlarm: (item) => {
        console.log('🔔 Triggering alarm:', item.label);

        if (AlarmModule.settings.enabled) {
            AlarmModule.playSound();
        }

        if (AlarmModule.settings.vibrate && 'vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }

        AlarmModule.showNotification(item);

        if (window.App?.showToast) {
            const icon = AlarmModule.ICONS[item.icon] || '🔔';
            window.App.showToast('info', `${icon} ${item.jam} - ${item.label}`);
        }
    },

    // Play sound using Web Audio API
    playSound: () => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const soundConfig = AlarmModule.SOUNDS[AlarmModule.settings.soundType] || AlarmModule.SOUNDS.beep;

            // Duration settings
            const durations = { short: 0.2, normal: 0.4, long: 0.8 };
            const noteDuration = durations[AlarmModule.settings.duration] || 0.4;

            const playNote = (startTime, frequency) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = frequency;
                oscillator.type = 'sine';

                const vol = AlarmModule.settings.volume || 0.5;
                gainNode.gain.setValueAtTime(vol, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration);

                oscillator.start(startTime);
                oscillator.stop(startTime + noteDuration);
            };

            const now = audioContext.currentTime;
            soundConfig.frequencies.forEach((freq, i) => {
                playNote(now + (i * (noteDuration + 0.1)), freq);
            });

        } catch (e) {
            console.log('Audio play error:', e);
        }
    },

    // Show push notification
    showNotification: (item) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            const icon = AlarmModule.ICONS[item.icon] || '🔔';
            const notification = new Notification(`${icon} ${item.label}`, {
                body: `Jadwal: ${item.jam} - ${AlarmModule.settings.reminderMinutes} menit lagi`,
                icon: 'assets/bgn-logo.png',
                tag: `sppg-alarm-${item.jam}`,
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            setTimeout(() => notification.close(), 30000);
        }
    },

    // Check if current user is Full Access (admin role or fullAccess flag)
    isFullAccess: () => {
        const user = window.App?.state?.currentUser;
        return user?.fullAccess === true || user?.role === 'admin';
    },

    // Show settings modal (role-based)
    showSettings: () => {
        const isAdmin = AlarmModule.isFullAccess();

        const modal = document.createElement('div');
        modal.className = 'modal alarm-modal';
        modal.id = 'alarm-settings-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>🔔 Pengaturan Alarm${isAdmin ? ' (Admin)' : ''}</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    ${isAdmin ? `
                    <div class="alarm-tabs">
                        <button class="alarm-tab active" onclick="AlarmModule.switchTab('sound')">🎵 Bunyi</button>
                        <button class="alarm-tab" onclick="AlarmModule.switchTab('timeline')">📅 Timeline</button>
                    </div>
                    ` : ''}
                    
                    <div id="tab-sound" class="alarm-tab-content">
                        ${AlarmModule.renderSoundSettings()}
                    </div>
                    
                    ${isAdmin ? `
                    <div id="tab-timeline" class="alarm-tab-content" style="display:none;">
                        ${AlarmModule.renderTimelineSettings()}
                    </div>
                    ` : `
                    <div class="alarm-schedule" style="margin-top:20px;">
                        <h4>📅 Jadwal Alarm:</h4>
                        <div class="schedule-list">
                            ${AlarmModule.schedule.map(s => `
                                <div class="schedule-item">
                                    <span class="schedule-time">${s.jam}</span>
                                    <span class="schedule-label">${AlarmModule.ICONS[s.icon] || '🔔'} ${s.label}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // Render sound settings (all users)
    renderSoundSettings: () => {
        return `
            <div class="alarm-settings">
                <label class="setting-row">
                    <span>Aktifkan Alarm</span>
                    <input type="checkbox" id="alarm-enabled" 
                        ${AlarmModule.settings.enabled ? 'checked' : ''} 
                        onchange="AlarmModule.updateSetting('enabled', this.checked)">
                </label>
                
                <label class="setting-row">
                    <span>🎵 Nada Bunyi</span>
                    <select id="alarm-sound-type" onchange="AlarmModule.updateSetting('soundType', this.value)">
                        ${Object.entries(AlarmModule.SOUNDS).map(([key, val]) => `
                            <option value="${key}" ${AlarmModule.settings.soundType === key ? 'selected' : ''}>${val.name}</option>
                        `).join('')}
                    </select>
                </label>
                
                <label class="setting-row">
                    <span>⏱️ Durasi Bunyi</span>
                    <select id="alarm-duration" onchange="AlarmModule.updateSetting('duration', this.value)">
                        <option value="short" ${AlarmModule.settings.duration === 'short' ? 'selected' : ''}>Pendek</option>
                        <option value="normal" ${AlarmModule.settings.duration === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="long" ${AlarmModule.settings.duration === 'long' ? 'selected' : ''}>Panjang</option>
                    </select>
                </label>
                
                <div class="setting-row">
                    <span>🔊 Volume</span>
                    <input type="range" min="0" max="1" step="0.1" value="${AlarmModule.settings.volume}"
                        onchange="AlarmModule.updateSetting('volume', parseFloat(this.value))"
                        style="width: 120px;">
                </div>
                
                <label class="setting-row">
                    <span>📳 Getaran</span>
                    <input type="checkbox" id="alarm-vibrate" 
                        ${AlarmModule.settings.vibrate ? 'checked' : ''} 
                        onchange="AlarmModule.updateSetting('vibrate', this.checked)">
                </label>
                
                <label class="setting-row">
                    <span>⏰ Ingatkan sebelum</span>
                    <select id="alarm-reminder" onchange="AlarmModule.updateSetting('reminderMinutes', parseInt(this.value))">
                        <option value="5" ${AlarmModule.settings.reminderMinutes === 5 ? 'selected' : ''}>5 menit</option>
                        <option value="10" ${AlarmModule.settings.reminderMinutes === 10 ? 'selected' : ''}>10 menit</option>
                        <option value="15" ${AlarmModule.settings.reminderMinutes === 15 ? 'selected' : ''}>15 menit</option>
                        <option value="30" ${AlarmModule.settings.reminderMinutes === 30 ? 'selected' : ''}>30 menit</option>
                    </select>
                </label>
            </div>
            
            <button class="btn btn-secondary" style="width:100%; margin-top:15px;" onclick="AlarmModule.testAlarm()">
                🔊 Test Alarm
            </button>
        `;
    },

    // Render timeline settings (Full Access only)
    renderTimelineSettings: () => {
        const iconOptions = Object.entries(AlarmModule.ICONS).map(([key, emoji]) =>
            `<option value="${key}">${emoji}</option>`
        ).join('');

        return `
            <div class="timeline-editor">
                <div id="timeline-list" class="timeline-list">
                    ${AlarmModule.schedule.map((item, idx) => `
                        <div class="timeline-item" data-id="${item.id}">
                            <input type="time" value="${item.jam}" 
                                onchange="AlarmModule.updateScheduleItem(${item.id}, 'jam', this.value)"
                                class="timeline-time">
                            <select onchange="AlarmModule.updateScheduleItem(${item.id}, 'icon', this.value)" class="timeline-icon">
                                ${Object.entries(AlarmModule.ICONS).map(([key, emoji]) =>
            `<option value="${key}" ${item.icon === key ? 'selected' : ''}>${emoji}</option>`
        ).join('')}
                            </select>
                            <input type="text" value="${item.label}" 
                                onchange="AlarmModule.updateScheduleItem(${item.id}, 'label', this.value)"
                                class="timeline-label" placeholder="Label">
                            <button class="btn-icon btn-delete" onclick="AlarmModule.deleteScheduleItem(${item.id})">🗑️</button>
                        </div>
                    `).join('')}
                </div>
                
                <div class="timeline-actions">
                    <button class="btn btn-secondary" onclick="AlarmModule.addScheduleItem()">
                        ➕ Tambah Jadwal
                    </button>
                    <button class="btn btn-outline" onclick="AlarmModule.resetToDefault(); AlarmModule.refreshTimeline();">
                        🔄 Reset Default
                    </button>
                </div>
                
                <button class="btn btn-primary" style="width:100%; margin-top:15px;" onclick="AlarmModule.syncScheduleToSheet()">
                    💾 Simpan & Sync ke Semua
                </button>
            </div>
        `;
    },

    // Switch between tabs (Admin only)
    switchTab: (tab) => {
        document.querySelectorAll('.alarm-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.alarm-tab-content').forEach(c => c.style.display = 'none');

        event.target.classList.add('active');
        document.getElementById(`tab-${tab}`).style.display = 'block';
    },

    // Update setting
    updateSetting: (key, value) => {
        AlarmModule.settings[key] = value;
        AlarmModule.saveSettings();
        if (window.App?.showToast) {
            window.App.showToast('success', '✅ Pengaturan disimpan');
        }
    },

    // Update schedule item
    updateScheduleItem: (id, field, value) => {
        const item = AlarmModule.schedule.find(s => s.id === id);
        if (item) {
            item[field] = value;
            AlarmModule.saveSchedule();
            // Refresh dashboard if on dashboard
            if (window.App?.state?.currentSection === 'dashboard') {
                window.App.renderDashboard();
            }
        }
    },

    // Add new schedule item
    addScheduleItem: () => {
        const newId = Math.max(...AlarmModule.schedule.map(s => s.id), 0) + 1;
        AlarmModule.schedule.push({
            id: newId,
            jam: '12:00',
            label: 'Jadwal Baru',
            icon: 'bell'
        });
        AlarmModule.saveSchedule();
        AlarmModule.refreshTimeline();
        // Refresh dashboard
        if (window.App?.state?.currentSection === 'dashboard') {
            window.App.renderDashboard();
        }
    },

    // Delete schedule item
    deleteScheduleItem: (id) => {
        AlarmModule.schedule = AlarmModule.schedule.filter(s => s.id !== id);
        AlarmModule.saveSchedule();
        AlarmModule.refreshTimeline();
        // Refresh dashboard
        if (window.App?.state?.currentSection === 'dashboard') {
            window.App.renderDashboard();
        }
    },

    // Refresh timeline UI
    refreshTimeline: () => {
        const list = document.getElementById('timeline-list');
        if (list) {
            list.innerHTML = AlarmModule.schedule.map((item, idx) => `
                <div class="timeline-item" data-id="${item.id}">
                    <input type="time" value="${item.jam}" 
                        onchange="AlarmModule.updateScheduleItem(${item.id}, 'jam', this.value)"
                        class="timeline-time">
                    <select onchange="AlarmModule.updateScheduleItem(${item.id}, 'icon', this.value)" class="timeline-icon">
                        ${Object.entries(AlarmModule.ICONS).map(([key, emoji]) =>
                `<option value="${key}" ${item.icon === key ? 'selected' : ''}>${emoji}</option>`
            ).join('')}
                    </select>
                    <input type="text" value="${item.label}" 
                        onchange="AlarmModule.updateScheduleItem(${item.id}, 'label', this.value)"
                        class="timeline-label" placeholder="Label">
                    <button class="btn-icon btn-delete" onclick="AlarmModule.deleteScheduleItem(${item.id})">🗑️</button>
                </div>
            `).join('');
        }
    },

    // Sync schedule to Google Sheet (for all devices)
    syncScheduleToSheet: async () => {
        if (!window.Database?.isApiConfigured()) {
            window.App?.showToast('warning', 'API belum dikonfigurasi');
            return;
        }

        try {
            window.App?.showToast('info', '⏳ Menyimpan timeline...');

            // Save to a settings entry
            const response = await fetch(`${window.Database.API_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: window.Database.API_KEY,
                    action: 'update',
                    sheet: 'settings',
                    id: 'alarm_schedule',
                    data: {
                        id: 'alarm_schedule',
                        value: JSON.stringify(AlarmModule.schedule),
                        updatedAt: new Date().toISOString(),
                        updatedBy: window.App?.state?.currentUser?.nama || 'Admin'
                    }
                })
            });

            window.App?.showToast('success', '✅ Timeline disimpan ke semua perangkat!');

        } catch (e) {
            console.log('Sync error:', e);
            window.App?.showToast('error', 'Gagal sync: ' + e.message);
        }
    },

    // Test alarm
    testAlarm: () => {
        AlarmModule.triggerAlarm({
            jam: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            label: 'Test Alarm',
            icon: 'bell'
        });
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => AlarmModule.init(), 2000);
});

// Make available globally
window.AlarmModule = AlarmModule;
