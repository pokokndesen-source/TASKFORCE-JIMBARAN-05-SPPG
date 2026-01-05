// ============================================
// SPPG MBG JIMBARAN 05 - V2 MAIN APP
// ============================================
// Versi 2.0 - Simplified & Timeline-Based
// ============================================

const App = {
    // ==========================================
    // STATE
    // ==========================================
    state: {
        currentUser: null,
        currentSection: 'dashboard'
    },

    // Timeline kerja harian (sesuai mekanisme SPPG)
    TIMELINE: [
        { jam: '02:00', label: 'Persiapan dimulai', icon: '🌙' },
        { jam: '03:00', label: 'Tim masuk & masak', icon: '👨‍🍳' },
        { jam: '04:30', label: 'Kloter 1 selesai', icon: '✅' },
        { jam: '05:00', label: 'Packing & Test Food', icon: '📦' },
        { jam: '07:45', label: 'Distribusi Kloter 1', icon: '🚚' },
        { jam: '09:00', label: 'Distribusi Kloter 2', icon: '🚚' },
        { jam: '10:00', label: 'Distribusi Kloter 3', icon: '🚚' },
        { jam: '13:00', label: 'Pengambilan Alat', icon: '📥' },
        { jam: '15:00', label: 'Closing & QC', icon: '🧹' }
    ],

    // ==========================================
    // INITIALIZATION
    // ==========================================
    init: () => {
        console.log('🍱 SPPG MBG V2 Starting...');

        // DISABLE SERVICE WORKER FOR NOW (cache causing issues)
        // if ('serviceWorker' in navigator) {
        //     navigator.serviceWorker.register('sw.js').catch(e => console.log('SW Error:', e));
        // }

        // Initialize database
        if (typeof Database !== 'undefined') {
            Database.init();
        }

        // Show splash then check login
        setTimeout(() => {
            document.getElementById('splash-screen')?.classList.add('fade-out');
            setTimeout(() => App.checkLogin(), 500);
        }, 1500);

        // Setup events
        App.setupEventListeners();

        // Start auto-sync polling (every 30 seconds)
        App.startAutoSync();
    },

    // Auto-sync state
    syncState: {
        lastSync: null,
        isSyncing: false,
        autoSyncInterval: null
    },

    // Start auto-sync polling
    startAutoSync: () => {
        // Sync every 30 seconds
        App.syncState.autoSyncInterval = setInterval(async () => {
            if (App.state.currentUser && !App.syncState.isSyncing) {
                await App.backgroundSync();
            }
        }, 30000);
    },

    // Background sync (silent)
    backgroundSync: async () => {
        if (!Database.isApiConfigured()) return;

        App.syncState.isSyncing = true;
        App.updateSyncIndicator('syncing');

        try {
            await Database.syncFromCloud('produksi');
            await Database.syncFromCloud('distribusi');
            await Database.syncFromCloud('logistik');

            App.syncState.lastSync = new Date();
            App.updateSyncIndicator('online');
        } catch (e) {
            App.updateSyncIndicator('offline');
        }

        App.syncState.isSyncing = false;
    },

    // Update sync indicator UI
    updateSyncIndicator: (status) => {
        let indicator = document.getElementById('sync-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'sync-indicator';
            indicator.className = 'sync-indicator';
            document.body.appendChild(indicator);
        }

        switch (status) {
            case 'online':
                indicator.className = 'sync-indicator online';
                indicator.innerHTML = '🟢 Online';
                break;
            case 'offline':
                indicator.className = 'sync-indicator offline';
                indicator.innerHTML = '🔴 Offline';
                break;
            case 'syncing':
                indicator.className = 'sync-indicator syncing';
                indicator.innerHTML = '🔄 Syncing...';
                break;
        }
    },

    // ==========================================
    // ROLE-BASED ACCESS CONTROL
    // ==========================================
    // Roles yang bisa EDIT: admin, koordinator, staff, aslab
    // Roles yang HANYA VIEW: relawan

    EDIT_ROLES: ['admin', 'koordinator', 'staff', 'aslab'],

    canEdit: () => {
        const user = App.state.currentUser;
        if (!user) return false;
        return App.EDIT_ROLES.includes(user.role?.toLowerCase());
    },

    isAdmin: () => {
        const user = App.state.currentUser;
        return user?.role?.toLowerCase() === 'admin';
    },

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    checkLogin: () => {
        // Safety check for Database
        if (typeof Database === 'undefined') {
            console.error('❌ Database not loaded!');
            App.showToast('error', 'Database tidak terload. Silakan refresh.');
            return;
        }

        const user = Database.getCurrentUser();
        if (user) {
            App.state.currentUser = user;
            App.showApp();
        } else {
            App.showLogin();
        }
    },

    showLogin: async () => {
        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('login-screen')?.classList.remove('hidden');
        document.getElementById('app-screen')?.classList.add('hidden');

        // Safety check for Database
        if (typeof Database === 'undefined') {
            console.error('❌ Database not loaded!');
            return;
        }

        // Auto-sync users from cloud when showing login
        try {
            console.log('🔄 Syncing users from cloud...');
            await Database.syncFromCloud('users');
            console.log('✅ Users synced');
        } catch (e) {
            console.log('⚠️ Sync failed, using local data:', e);
        }
    },

    showApp: () => {
        document.getElementById('splash-screen')?.classList.add('hidden');
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('app-screen')?.classList.remove('hidden');

        App.updateUserInfo();
        App.navigateTo('dashboard');
    },

    handleLogin: async (phone, pin) => {
        console.log('🔑 handleLogin called with:', phone, pin);

        // Show loading
        const btn = document.querySelector('#login-form button');
        const originalText = btn?.innerHTML;
        if (btn) btn.innerHTML = '⏳ Memuat...';

        // Sync users first if possible
        try {
            console.log('⏳ Attempting to sync users from cloud...');
            const syncResult = await Database.syncFromCloud('users');
            console.log('✅ Sync result:', syncResult);
        } catch (e) {
            console.log('❌ Sync failed:', e);
        }

        // Check what users we have now
        const usersAfterSync = Database.getAll('users');
        console.log('👥 Users after sync:', usersAfterSync.length, usersAfterSync);

        // Try login with phone + PIN
        console.log('🔐 Attempting login...');
        const result = Database.login(phone, pin);
        console.log('🔐 Login result:', result);

        if (btn) btn.innerHTML = originalText;

        if (result.success) {
            App.state.currentUser = result.user;
            App.showToast('success', `Selamat datang, ${result.user.nama}!`);
            App.showApp();
        } else {
            App.showToast('error', result.error || 'Login gagal!');
        }
    },

    handleLogout: () => {
        Database.logout();
        App.state.currentUser = null;
        App.showLogin();
        App.showToast('success', 'Berhasil logout');
    },


    // ==========================================
    // NAVIGATION
    // ==========================================
    navigateTo: (section) => {
        App.state.currentSection = section;
        const mainContent = document.getElementById('main-content');

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });

        // Render section
        switch (section) {
            case 'dashboard':
                App.renderDashboard();
                break;
            case 'produksi':
                App.renderProduksi();
                break;
            case 'distribusi':
                App.renderDistribusi();
                break;
            case 'logistik':
                App.renderLogistik();
                break;
            case 'laporan':
                App.renderLaporan();
                break;
            case 'users':
                App.renderUsers();
                break;
            case 'settings':
                App.renderSettings();
                break;
            default:
                App.renderDashboard();
        }
    },

    // ==========================================
    // DASHBOARD
    // ==========================================
    renderDashboard: () => {
        const today = App.getTodayDate();
        const user = App.state.currentUser;
        const isAdmin = user?.role === 'admin';

        // Get stats
        const produksi = Database.getByDate('produksi', today);
        const distribusi = Database.getByDate('distribusi', today);
        const logistik = Database.getByDate('logistik', today);

        const html = `
            <div class="dashboard-header">
                <h1>🍱 SPPG MBG</h1>
                <p>${App.formatDate(today)}</p>
            </div>

            <!-- Timeline Progress -->
            <div class="card">
                <h3>⏰ Timeline Hari Ini</h3>
                <div class="timeline">
                    ${App.renderTimeline()}
                </div>
            </div>

            <!-- Quick Stats -->
            <div class="stats-grid">
                <div class="stat-card" onclick="App.navigateTo('produksi')">
                    <div class="stat-icon">👨‍🍳</div>
                    <div class="stat-value">${produksi.length}</div>
                    <div class="stat-label">Produksi</div>
                </div>
                <div class="stat-card" onclick="App.navigateTo('distribusi')">
                    <div class="stat-icon">🚚</div>
                    <div class="stat-value">${distribusi.length}</div>
                    <div class="stat-label">Distribusi</div>
                </div>
                <div class="stat-card" onclick="App.navigateTo('logistik')">
                    <div class="stat-icon">📦</div>
                    <div class="stat-value">${logistik.length}</div>
                    <div class="stat-label">Logistik</div>
                </div>
                <div class="stat-card" onclick="App.navigateTo('laporan')">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">Rekap</div>
                    <div class="stat-label">Laporan</div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="card">
                <h3>🚀 Aksi Cepat</h3>
                ${App.canEdit() ? `
                <div class="quick-actions">
                    <button class="btn btn-primary" onclick="App.navigateTo('produksi')">
                        + Catat Produksi
                    </button>
                    <button class="btn btn-success" onclick="App.navigateTo('distribusi')">
                        + Catat Distribusi
                    </button>
                </div>
                ` : `
                <div class="view-only-notice">
                    <p>👁️ Mode View Only</p>
                    <small>Anda login sebagai ${user?.role || 'Relawan'}. Hanya bisa melihat data.</small>
                </div>
                `}
            </div>

            ${App.isAdmin() ? `
            <!-- Admin Section -->
            <div class="card admin-section">
                <h3>👑 Menu Admin</h3>
                <div class="admin-buttons">
                    <button class="btn btn-secondary" onclick="App.navigateTo('users')">
                        👥 Kelola User
                    </button>
                    <button class="btn btn-secondary" onclick="App.navigateTo('settings')">
                        ⚙️ Pengaturan
                    </button>
                </div>
            </div>
            ` : ''}
        `;

        document.getElementById('main-content').innerHTML = html;
    },

    renderTimeline: () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        return App.TIMELINE.map((item, index) => {
            const [h, m] = item.jam.split(':').map(Number);
            const itemMinutes = h * 60 + m;

            let status = 'pending';
            if (currentMinutes >= itemMinutes) {
                status = 'done';
            }
            if (index < App.TIMELINE.length - 1) {
                const nextItem = App.TIMELINE[index + 1];
                const [nh, nm] = nextItem.jam.split(':').map(Number);
                const nextMinutes = nh * 60 + nm;
                if (currentMinutes >= itemMinutes && currentMinutes < nextMinutes) {
                    status = 'active';
                }
            }

            return `
                <div class="timeline-item ${status}">
                    <span class="timeline-icon">${item.icon}</span>
                    <span class="timeline-time">${item.jam}</span>
                    <span class="timeline-label">${item.label}</span>
                </div>
            `;
        }).join('');
    },

    // ==========================================
    // PRODUKSI MODULE
    // ==========================================
    renderProduksi: () => {
        const today = App.getTodayDate();
        const records = Database.getByDate('produksi', today);

        const html = `
            <div class="section-header">
                <h2>👨‍🍳 Produksi</h2>
                ${App.canEdit() ? '<button class="btn btn-primary" onclick="App.showProduksiForm()">+ Tambah</button>' : '<span class="view-badge">👁️ View Only</span>'}
            </div>

            <div class="checklist-card">
                <h3>📋 Checklist Produksi Hari Ini</h3>
                ${App.renderProduksiChecklist(records)}
            </div>

            <div class="records-list">
                <h3>📝 Catatan Produksi</h3>
                ${records.length > 0 ? records.map(r => `
                    <div class="record-item">
                        <div class="record-title">${r.step || 'Catatan'}</div>
                        <div class="record-meta">
                            ${r.waktu || ''} - ${r.user || ''}
                        </div>
                    </div>
                `).join('') : '<p class="empty-state">Belum ada catatan hari ini</p>'}
            </div>
        `;

        document.getElementById('main-content').innerHTML = html;
    },

    renderProduksiChecklist: (records) => {
        // BGN SOP Produksi Steps
        const steps = [
            { id: 'sanitasi_dapur', label: 'Sanitasi Dapur', desc: 'Bersihkan area dapur sebelum mulai', icon: '🧹', needPhoto: false },
            { id: 'apd_petugas', label: 'APD Petugas', desc: 'Celemek, masker, sarung tangan, penutup kepala', icon: '👷', needPhoto: true },
            { id: 'cuci_tangan', label: 'Cuci Tangan', desc: 'Semua petugas cuci tangan dengan sabun', icon: '🖐️', needPhoto: false },
            { id: 'qc_bahan', label: 'QC Bahan Baku', desc: 'Cek kesegaran dan kondisi bahan', icon: '🔍', needPhoto: true },
            { id: 'persiapan_bahan', label: 'Persiapan Bahan', desc: 'Cuci, potong, dan siapkan bahan', icon: '🥬', needPhoto: false },
            { id: 'masak', label: 'Proses Memasak', desc: 'Masak sesuai resep dan standar', icon: '👨‍🍳', needPhoto: true },
            { id: 'test_food', label: 'Uji Rasa (Test Food)', desc: 'Tes rasa sebelum disajikan', icon: '🍴', needPhoto: false },
            { id: 'packing', label: 'Pengemasan', desc: 'Kemas dalam box dengan higienis', icon: '📦', needPhoto: true },
            { id: 'simpan_sampel', label: 'Simpan Sampel', desc: 'Simpan sampel untuk pengecekan', icon: '🧪', needPhoto: true }
        ];

        const completedSteps = records.map(r => r.step);
        const canEdit = App.canEdit();

        return steps.map((step, index) => {
            const record = records.find(r => r.step === step.id);
            const isDone = completedSteps.includes(step.id);

            return `
                <div class="checklist-step ${isDone ? 'done' : ''}" data-step="${step.id}">
                    <div class="step-number">${isDone ? '✓' : index + 1}</div>
                    <div class="step-content">
                        <div class="step-title">${step.icon} ${step.label}</div>
                        <div class="step-desc">${step.desc}</div>
                        ${isDone && record ? `
                            <div class="step-time">✅ Selesai ${record.waktu || ''} oleh ${record.user || ''}</div>
                            ${record.foto ? `<img src="${record.foto}" class="foto-thumbnail" onclick="FotoModule.showFoto('${record.foto}', '${step.label}')" alt="Foto ${step.label}">` : ''}
                        ` : ''}
                        ${!isDone && canEdit ? `
                            <div class="step-actions" style="margin-top:10px">
                                ${step.needPhoto ? `
                                    <div class="foto-capture">
                                        <label class="btn btn-secondary btn-sm">
                                            📷 Foto & Selesai
                                            <input type="file" accept="image/*" capture="environment" 
                                                onchange="App.completeProduksiWithPhoto('${step.id}', '${step.label}', this)" hidden>
                                        </label>
                                    </div>
                                ` : `
                                    <button class="btn btn-success btn-sm" onclick="App.toggleProduksiStep('${step.id}', '${step.label}')">
                                        ✓ Selesai
                                    </button>
                                `}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    // Complete produksi step with photo
    completeProduksiWithPhoto: async (stepId, stepLabel, inputElement) => {
        if (!App.canEdit()) {
            App.showToast('error', 'Anda tidak punya akses!');
            return;
        }

        App.showToast('info', '⏳ Memproses foto...');

        try {
            const fotoData = await FotoModule.captureWithWatermark(inputElement);

            const today = App.getTodayDate();
            Database.add('produksi', {
                step: stepId,
                label: stepLabel,
                tanggal: today,
                waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                user: App.state.currentUser?.nama,
                foto: fotoData
            });

            App.showToast('success', `✅ ${stepLabel} selesai dengan foto!`);
            App.renderProduksi();
        } catch (error) {
            App.showToast('error', 'Gagal mengambil foto: ' + error);
        }
    },


    toggleProduksiStep: (stepId, stepLabel) => {
        // Check permission
        if (!App.canEdit()) {
            App.showToast('error', 'Anda tidak punya akses untuk edit!');
            return;
        }

        const today = App.getTodayDate();
        const records = Database.getByDate('produksi', today);
        const existing = records.find(r => r.step === stepId);

        if (existing) {
            Database.delete('produksi', existing.id);
        } else {
            Database.add('produksi', {
                step: stepId,
                label: stepLabel,
                tanggal: today,
                waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                user: App.state.currentUser?.nama
            });
        }

        App.renderProduksi();
    },

    // ==========================================
    // DISTRIBUSI MODULE
    // ==========================================
    renderDistribusi: () => {
        const today = App.getTodayDate();
        const records = Database.getByDate('distribusi', today);

        const html = `
            <div class="section-header">
                <h2>🚚 Distribusi</h2>
                ${App.canEdit() ? '<button class="btn btn-primary" onclick="App.showDistribusiForm()">+ Tambah</button>' : '<span class="view-badge">👁️ View Only</span>'}
            </div>

            <!-- Kloter Summary -->
            <div class="kloter-grid">
                ${App.renderKloterCards(records)}
            </div>

            <!-- Today's Records -->
            <div class="records-list">
                <h3>📝 Catatan Distribusi</h3>
                ${records.length > 0 ? records.map(r => `
                    <div class="record-item">
                        <div class="record-title">${r.sekolah || 'Sekolah'}</div>
                        <div class="record-meta">
                            Kloter ${r.kloter || '-'} | ${r.jumlahBox || 0} box | ${r.driver || '-'}
                        </div>
                        <div class="record-status ${r.status || 'pending'}">
                            ${r.status === 'selesai' ? '✅ Terkirim' : '🕐 Dalam perjalanan'}
                        </div>
                    </div>
                `).join('') : '<p class="empty-state">Belum ada distribusi hari ini</p>'}
            </div>
        `;

        document.getElementById('main-content').innerHTML = html;
    },

    renderKloterCards: (records) => {
        const kloters = [
            { id: 1, label: 'TK, PAUD (07:30)', target: 'Anak usia 4-6 tahun', jam: '07:30' },
            { id: 2, label: 'SD 1-2 (09:00)', target: 'Kelas 1-2 SD', jam: '09:00' },
            { id: 3, label: 'SD 3-6 (10:00)', target: 'Kelas 3-6 SD', jam: '10:00' },
            { id: 4, label: 'SMP/SMA (12:00)', target: 'SMP dan SMA', jam: '12:00' }
        ];

        return kloters.map(k => {
            const kloterRecords = records.filter(r => r.kloter == k.id);
            const totalBox = kloterRecords.reduce((sum, r) => sum + (parseInt(r.jumlahBox) || 0), 0);
            const selesai = kloterRecords.filter(r => r.status === 'selesai').length;
            const berangkat = kloterRecords.filter(r => r.status === 'berangkat').length;

            // Determine kloter status
            let statusClass = 'pending';
            let statusText = '⏳ Belum mulai';
            if (selesai === kloterRecords.length && kloterRecords.length > 0) {
                statusClass = 'selesai';
                statusText = '✅ Selesai';
            } else if (berangkat > 0) {
                statusClass = 'berangkat';
                statusText = '🚚 Dalam perjalanan';
            }

            return `
                <div class="kloter-card">
                    <div class="kloter-header">
                        <span>Kloter ${k.id}</span>
                        <span class="kloter-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="kloter-time">🕐 ${k.jam}</div>
                    <div class="kloter-target">🎯 ${k.target}</div>
                    <div class="kloter-stats">
                        <span>📦 ${totalBox} box</span>
                        <span>✅ ${selesai}/${kloterRecords.length}</span>
                    </div>
                    ${App.canEdit() ? `
                        <button class="btn btn-primary btn-sm" onclick="App.showDistribusiForm(${k.id})" style="margin-top:10px;width:100%">
                            + Tambah Pengiriman
                        </button>
                    ` : ''}
                    ${kloterRecords.length > 0 ? `
                        <div class="kloter-list">
                            ${kloterRecords.map(r => `
                                <div class="kloter-item">
                                    <div class="kloter-item-header">
                                        <span class="kloter-sekolah">🏫 ${r.sekolah || 'Sekolah'}</span>
                                        <span class="kloter-status ${r.status || 'pending'}">
                                            ${r.status === 'selesai' ? '✅' : r.status === 'berangkat' ? '🚚' : r.status === 'sampai' ? '📍' : '⏳'}
                                        </span>
                                    </div>
                                    <div class="kloter-item-detail">
                                        📦 ${r.jumlahBox || 0} box | 🚗 ${r.driver || '-'}
                                    </div>
                                    ${r.foto ? `<img src="${r.foto}" class="foto-thumbnail" onclick="FotoModule.showFoto('${r.foto}', '${r.sekolah}')" alt="Foto">` : ''}
                                    ${App.canEdit() && r.status !== 'selesai' ? `
                                        <div class="kloter-actions">
                                            ${r.status === 'pending' ? `
                                                <button class="btn btn-sm btn-primary" onclick="App.updateDistribusiStatus('${r.id}', 'berangkat')">🚚 Berangkat</button>
                                            ` : ''}
                                            ${r.status === 'berangkat' ? `
                                                <label class="btn btn-sm btn-success">
                                                    📍 Sampai + Foto
                                                    <input type="file" accept="image/*" capture="environment" 
                                                        onchange="App.completeDistribusiWithPhoto('${r.id}', this)" hidden>
                                                </label>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    // Update distribusi status
    updateDistribusiStatus: (recordId, newStatus) => {
        Database.update('distribusi', recordId, {
            status: newStatus,
            [`jam_${newStatus}`]: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        });
        App.showToast('success', `Status diupdate: ${newStatus}`);
        App.renderDistribusi();
    },

    // Complete distribusi with photo (sampai sekolah)
    completeDistribusiWithPhoto: async (recordId, inputElement) => {
        if (!App.canEdit()) {
            App.showToast('error', 'Anda tidak punya akses!');
            return;
        }

        App.showToast('info', '⏳ Memproses foto...');

        try {
            const fotoData = await FotoModule.captureWithWatermark(inputElement);

            Database.update('distribusi', recordId, {
                status: 'selesai',
                jam_sampai: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                foto: fotoData
            });

            App.showToast('success', '✅ Pengiriman selesai!');
            App.renderDistribusi();
        } catch (error) {
            App.showToast('error', 'Gagal mengambil foto: ' + error);
        }
    },


    showDistribusiForm: (kloter = 1) => {
        // Check permission
        if (!App.canEdit()) {
            App.showToast('error', 'Anda tidak punya akses untuk edit!');
            return;
        }
        const modal = document.getElementById('modal-distribusi');
        if (modal) {
            document.getElementById('distribusi-kloter').value = kloter;
            modal.classList.remove('hidden');
        }
    },

    // ==========================================
    // LOGISTIK MODULE (Enhanced BGN QC)
    // ==========================================
    renderLogistik: () => {
        const today = App.getTodayDate();
        const records = Database.getByDate('logistik', today);

        // Calculate totals
        const totalBerat = records.reduce((sum, r) => sum + (parseFloat(r.berat) || 0), 0);
        const totalHarga = records.reduce((sum, r) => sum + (parseFloat(r.harga) || 0), 0);
        const qcOk = records.filter(r => r.qcStatus === 'ok').length;

        const html = `
            <div class="section-header">
                <h2>📦 Logistik & QC Bahan</h2>
                ${App.canEdit() ? '<button class="btn btn-primary" onclick="App.showLogistikForm()">+ Input Bahan</button>' : '<span class="view-badge">👁️ View Only</span>'}
            </div>

            <!-- Summary Card -->
            <div class="card logistik-summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="summary-value">${records.length}</span>
                        <span class="summary-label">Jenis Bahan</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">${totalBerat.toFixed(1)} kg</span>
                        <span class="summary-label">Total Berat</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">Rp ${totalHarga.toLocaleString('id-ID')}</span>
                        <span class="summary-label">Total Nilai</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-value">${qcOk}/${records.length}</span>
                        <span class="summary-label">Lolos QC</span>
                    </div>
                </div>
            </div>

            <!-- Materials List -->
            <div class="records-list">
                <h3>📋 Daftar Bahan Hari Ini</h3>
                ${records.length > 0 ? records.map(r => `
                    <div class="logistik-item qc-${r.qcStatus || 'ok'}">
                        <div class="logistik-header">
                            <span class="logistik-nama">🥬 ${r.nama || 'Bahan'}</span>
                            <span class="qc-badge ${r.qcStatus || 'ok'}">
                                ${r.qcStatus === 'ok' ? '✅ Lolos' : r.qcStatus === 'review' ? '⚠️ Review' : '❌ Ditolak'}
                            </span>
                        </div>
                        <div class="logistik-detail">
                            <span>⚖️ ${r.berat || 0} kg</span>
                            <span>💰 Rp ${(r.harga || 0).toLocaleString('id-ID')}</span>
                            ${r.supplier ? `<span>🏪 ${r.supplier}</span>` : ''}
                        </div>
                        <div class="logistik-meta">
                            ${r.waktu || ''} - ${r.user || ''}
                        </div>
                        ${r.foto ? `<img src="${r.foto}" class="foto-thumbnail" onclick="FotoModule.showFoto('${r.foto}', '${r.nama}')" alt="Foto ${r.nama}">` : ''}
                        ${App.canEdit() && r.qcStatus !== 'ok' ? `
                            <div class="logistik-actions">
                                <button class="btn btn-sm btn-success" onclick="App.updateLogistikQC('${r.id}', 'ok')">✅ Lolos QC</button>
                                <button class="btn btn-sm btn-danger" onclick="App.updateLogistikQC('${r.id}', 'rejected')">❌ Tolak</button>
                            </div>
                        ` : ''}
                    </div>
                `).join('') : '<p class="empty-state">Belum ada input bahan hari ini. Klik + Input Bahan untuk mulai.</p>'}
            </div>
        `;

        document.getElementById('main-content').innerHTML = html;
    },

    // Update logistik QC status
    updateLogistikQC: (recordId, newStatus) => {
        Database.update('logistik', recordId, {
            qcStatus: newStatus,
            qcTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            qcBy: App.state.currentUser?.nama
        });
        App.showToast('success', `Status QC diupdate: ${newStatus === 'ok' ? 'Lolos' : 'Ditolak'}`);
        App.renderLogistik();
    },

    // ==========================================
    // LAPORAN MODULE
    // ==========================================
    renderLaporan: () => {
        const today = App.getTodayDate();

        const html = `
            <div class="section-header">
                <h2>📊 Laporan</h2>
            </div>

            <div class="card">
                <h3>📅 Rekap Hari Ini (${App.formatDate(today)})</h3>
                ${App.generateDailyReport(today)}
            </div>

            <div class="card">
                <h3>💾 Backup & Restore</h3>
                <div class="backup-actions">
                    <button class="btn btn-secondary" onclick="Database.downloadBackup()">
                        📥 Download Backup
                    </button>
                    <label class="btn btn-secondary">
                        📤 Import Backup
                        <input type="file" accept=".json" onchange="App.handleImportBackup(event)" hidden>
                    </label>
                </div>
            </div>
        `;

        document.getElementById('main-content').innerHTML = html;
    },

    generateDailyReport: (date) => {
        const produksi = Database.getByDate('produksi', date);
        const distribusi = Database.getByDate('distribusi', date);
        const logistik = Database.getByDate('logistik', date);

        const totalBox = distribusi.reduce((sum, d) => sum + (parseInt(d.jumlahBox) || 0), 0);
        const totalBerat = logistik.reduce((sum, l) => sum + (parseFloat(l.berat) || 0), 0);

        return `
            <div class="report-stats">
                <div class="report-item">
                    <span class="report-label">Produksi:</span>
                    <span class="report-value">${produksi.length} checklist selesai</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Distribusi:</span>
                    <span class="report-value">${distribusi.length} pengiriman (${totalBox} box)</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Logistik:</span>
                    <span class="report-value">${logistik.length} bahan (${totalBerat} kg)</span>
                </div>
            </div>
        `;
    },

    handleImportBackup: (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = Database.importAll(e.target.result);
                App.showToast(result.success ? 'success' : 'error', result.message);
                if (result.success) {
                    App.renderLaporan();
                }
            };
            reader.readAsText(file);
        }
    },

    // ==========================================
    // USER MANAGEMENT
    // ==========================================
    renderUsers: () => {
        const users = Database.getAll('users');
        const currentUserId = App.state.currentUser?.id?.toString();

        const html = `
            <div class="section-header">
                <h2>👥 Kelola User</h2>
                <button class="btn btn-primary" onclick="App.showAddUserForm()">+ Tambah User</button>
            </div>

            <div class="users-list">
                ${users.map(u => `
                    <div class="user-item ${u.id?.toString() === currentUserId ? 'current' : ''}">
                        <div class="user-avatar">👤</div>
                        <div class="user-info">
                            <div class="user-name">${u.nama}</div>
                            <div class="user-meta">${u.jabatan || '-'} • ${u.phone}</div>
                        </div>
                        <div class="user-role ${u.role}">${u.role}</div>
                        <div class="user-status ${u.status}">${u.status}</div>
                        <div class="user-actions">
                            <button class="btn-edit" onclick="App.showEditUserForm('${u.id}')" title="Edit user">
                                ✏️
                            </button>
                            ${u.id?.toString() !== currentUserId ? `
                                <button class="btn-delete" onclick="App.deleteUser('${u.id}')" title="Hapus user">
                                    🗑️
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        document.getElementById('main-content').innerHTML = html;
    },

    showEditUserForm: (userId) => {
        const user = Database.getAll('users').find(u => u.id?.toString() === userId?.toString());
        if (!user) {
            App.showToast('error', 'User tidak ditemukan!');
            return;
        }

        const html = `
            <div class="section-header">
                <h2>✏️ Edit User</h2>
                <button class="btn btn-secondary" onclick="App.navigateTo('users')">← Kembali</button>
            </div>

            <form id="edit-user-form" class="form-card" onsubmit="App.saveEditUser(event, '${user.id}')">
                <div class="form-group">
                    <label>Nama Lengkap *</label>
                    <input type="text" id="edit-user-nama" required value="${user.nama || ''}">
                </div>
                <div class="form-group">
                    <label>No. HP *</label>
                    <input type="tel" id="edit-user-phone" required value="${user.phone || ''}">
                </div>
                <div class="form-group">
                    <label>PIN Login (kosongkan jika tidak diganti)</label>
                    <input type="password" id="edit-user-pin" placeholder="Kosongkan jika tidak ubah" maxlength="6">
                </div>
                <div class="form-group">
                    <label>Jabatan</label>
                    <input type="text" id="edit-user-jabatan" value="${user.jabatan || ''}">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select id="edit-user-role">
                        <option value="relawan" ${user.role === 'relawan' ? 'selected' : ''}>Relawan</option>
                        <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Staff</option>
                        <option value="koordinator" ${user.role === 'koordinator' ? 'selected' : ''}>Koordinator</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="edit-user-status">
                        <option value="active" ${user.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-full">💾 Simpan</button>
            </form>
        `;
        document.getElementById('main-content').innerHTML = html;
    },

    showAddUserForm: () => {
        const html = `
            <div class="section-header">
                <h2>➕ Tambah User Baru</h2>
                <button class="btn btn-secondary" onclick="App.navigateTo('users')">← Kembali</button>
            </div>

            <form id="add-user-form" class="form-card" onsubmit="App.addUser(event)">
                <div class="form-group">
                    <label>Nama Lengkap *</label>
                    <input type="text" id="new-user-nama" required placeholder="Contoh: Budi Santoso">
                </div>
                <div class="form-group">
                    <label>No. HP *</label>
                    <input type="tel" id="new-user-phone" required placeholder="Contoh: 081234567890">
                </div>
                <div class="form-group">
                    <label>PIN Login *</label>
                    <input type="password" id="new-user-pin" required placeholder="4-6 digit" maxlength="6" pattern="[0-9]{4,6}">
                </div>
                <div class="form-group">
                    <label>Jabatan</label>
                    <input type="text" id="new-user-jabatan" placeholder="Contoh: Koordinator">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select id="new-user-role">
                        <option value="relawan">Relawan</option>
                        <option value="staff">Staff</option>
                        <option value="koordinator">Koordinator</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-full">💾 Simpan User</button>
            </form>
        `;
        document.getElementById('main-content').innerHTML = html;
    },

    addUser: async (event) => {
        event.preventDefault();
        const nama = document.getElementById('new-user-nama')?.value?.trim();
        const phone = document.getElementById('new-user-phone')?.value?.trim();
        const pin = document.getElementById('new-user-pin')?.value?.trim();
        const jabatan = document.getElementById('new-user-jabatan')?.value?.trim();
        const role = document.getElementById('new-user-role')?.value;

        if (!nama || !phone || !pin) {
            App.showToast('error', 'Nama, No. HP, dan PIN wajib diisi!');
            return;
        }

        const existingUser = Database.getUserByPhone(phone);
        if (existingUser) {
            App.showToast('error', 'User dengan No. HP ini sudah ada!');
            return;
        }

        const newUser = { nama, phone, pin, jabatan, role, status: 'active' };
        const result = Database.add('users', newUser);
        if (result) {
            App.showToast('success', `User ${nama} berhasil ditambahkan!`);
            App.navigateTo('users');
        } else {
            App.showToast('error', 'Gagal menambahkan user!');
        }
    },

    saveEditUser: async (event, userId) => {
        event.preventDefault();
        const data = {
            nama: document.getElementById('edit-user-nama')?.value?.trim(),
            phone: document.getElementById('edit-user-phone')?.value?.trim(),
            jabatan: document.getElementById('edit-user-jabatan')?.value?.trim(),
            role: document.getElementById('edit-user-role')?.value,
            status: document.getElementById('edit-user-status')?.value
        };
        const newPin = document.getElementById('edit-user-pin')?.value?.trim();
        if (newPin) data.pin = newPin;

        const result = App.updateUser(userId, data);
        if (result) App.navigateTo('users');
    },

    updateUser: (userId, data) => {
        const user = Database.getAll('users').find(u => u.id?.toString() === userId?.toString());
        if (!user) {
            App.showToast('error', 'User tidak ditemukan!');
            return false;
        }

        // Update user
        const updatedUser = { ...user, ...data };
        Database.update('users', user.id, updatedUser);

        // Also update on cloud
        if (Database.isApiConfigured()) {
            Database.updateItemOnCloud('users', updatedUser).then(result => {
                console.log('☁️ Update to cloud:', result.success ? 'OK' : result.error);
            }).catch(e => console.log('Update error:', e));
        }

        App.showToast('success', `User ${data.nama} berhasil diupdate!`);
        return true;
    },

    deleteUser: (userId) => {
        const user = Database.getAll('users').find(u => u.id.toString() === userId.toString());
        if (!user) {
            App.showToast('error', 'User tidak ditemukan!');
            return;
        }

        if (confirm(`Hapus user "${user.nama}"? Tindakan ini tidak bisa dibatalkan.`)) {
            Database.delete('users', user.id);

            // Also delete from cloud
            if (Database.isApiConfigured()) {
                Database.deleteFromCloud('users', user.id).then(result => {
                    console.log('☁️ Delete from cloud:', result.success ? 'OK' : result.error);
                }).catch(e => console.log('Delete error:', e));
            }

            App.showToast('success', `User ${user.nama} berhasil dihapus!`);
            App.renderUsers();
        }
    },


    // ==========================================
    // SETTINGS
    // ==========================================
    renderSettings: () => {
        const html = `
            <div class="section-header">
                <h2>⚙️ Pengaturan</h2>
            </div>

            <!-- CLOUD SYNC -->
            <div class="card">
                <h3>☁️ Sinkronisasi Cloud (Google Sheets)</h3>
                <p>Sinkronkan data antara device ini dengan Google Sheets:</p>
                <div class="sync-actions">
                    <button class="btn btn-primary" onclick="App.pushAllToCloud()">
                        ⬆️ Push ke Cloud
                    </button>
                    <button class="btn btn-success" onclick="App.pullFromCloud()">
                        ⬇️ Pull dari Cloud
                    </button>
                </div>
                <p class="sync-status" id="sync-status"></p>
            </div>

            <div class="card">
                <h3>📱 Sync Manual (File)</h3>
                <p>Backup/restore data via file:</p>
                <div class="backup-actions">
                    <button class="btn btn-success" onclick="Database.downloadBackup()">
                        📥 Download Backup
                    </button>
                    <label class="btn btn-secondary">
                        📤 Import Backup
                        <input type="file" accept=".json" onchange="App.handleImportBackup(event)" hidden>
                    </label>
                </div>
            </div>

            <div class="card danger">
                <h3>⚠️ Zona Bahaya</h3>
                <button class="btn btn-danger" onclick="Database.resetAll()">
                    🗑️ Reset Semua Data
                </button>
            </div>
        `;

        document.getElementById('main-content').innerHTML = html;
    },

    // Push all data to cloud
    pushAllToCloud: async () => {
        App.showToast('info', 'Menyinkronkan ke cloud...');
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) syncStatus.textContent = '⏳ Uploading...';

        try {
            // Push users (most important)
            await Database.syncToCloud('users');
            await Database.syncToCloud('produksi');
            await Database.syncToCloud('distribusi');
            await Database.syncToCloud('logistik');

            if (syncStatus) syncStatus.textContent = '✅ Semua data berhasil di-push ke cloud!';
            App.showToast('success', 'Data berhasil di-push ke cloud!');
        } catch (e) {
            if (syncStatus) syncStatus.textContent = '❌ Error: ' + e.message;
            App.showToast('error', 'Gagal push ke cloud!');
        }
    },

    // Pull all data from cloud
    pullFromCloud: async () => {
        App.showToast('info', 'Mengambil data dari cloud...');
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) syncStatus.textContent = '⏳ Downloading...';

        try {
            await Database.fullSync();
            if (syncStatus) syncStatus.textContent = '✅ Semua data berhasil di-pull dari cloud!';
            App.showToast('success', 'Data berhasil di-pull dari cloud!');
        } catch (e) {
            if (syncStatus) syncStatus.textContent = '❌ Error: ' + e.message;
            App.showToast('error', 'Gagal pull dari cloud!');
        }
    },

    // ==========================================
    // HELPERS
    // ==========================================
    getTodayDate: () => new Date().toISOString().split('T')[0],

    formatDate: (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    updateUserInfo: () => {
        const user = App.state.currentUser;
        if (user) {
            const nameEl = document.getElementById('user-name');
            const roleEl = document.getElementById('user-role');
            if (nameEl) nameEl.textContent = user.nama;
            if (roleEl) roleEl.textContent = user.jabatan;
        }
    },

    showToast: (type, message) => {
        // Remove existing toast
        document.querySelector('.toast')?.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="toast-message">${message}</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showLoading: (show) => {
        const loader = document.getElementById('loading');
        if (loader) {
            loader.classList.toggle('hidden', !show);
        }
    },

    // ==========================================
    // EVENT LISTENERS
    // ==========================================
    setupEventListeners: () => {
        // Login form (with PIN validation)
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const phone = document.getElementById('phone-input')?.value?.trim();
            const pin = document.getElementById('pin-input')?.value?.trim();
            if (phone && pin) {
                App.handleLogin(phone, pin);
            } else {
                App.showToast('error', 'Masukkan nomor HP dan PIN!');
            }
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                if (section) App.navigateTo(section);
            });
        });

        // Logout button
        document.getElementById('btn-logout')?.addEventListener('click', App.handleLogout);

        // Close modals
        document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
            el.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
            });
        });
    },

    // Show sync complete overlay with checkmark
    showSyncComplete: (message = 'Upload Berhasil!') => {
        const overlay = document.createElement('div');
        overlay.className = 'sync-complete-overlay';
        overlay.innerHTML = `
            <div class="sync-complete-content">
                <div class="sync-checkmark">✓</div>
                <div class="sync-message">${message}</div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Animate in
        setTimeout(() => overlay.classList.add('show'), 50);

        // Remove after 2 seconds
        setTimeout(() => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        }, 2000);
    }
};

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', App.init);

// Make available globally
window.App = App;
