// ============================================
// SPPG - JIMBARAN 5 - FOTO MODULE
// ============================================
// 
// Fitur:
// - Capture foto dari kamera
// - Auto watermark: SPPG - JIMBARAN 5, tanggal, jam, user
// - Compress untuk upload
//
// ============================================

const FotoModule = {
    SPPG_NAME: 'SPPG - JIMBARAN 5',

    // Capture foto dan tambah watermark
    captureWithWatermark: async (inputElement) => {
        return new Promise((resolve, reject) => {
            const file = inputElement.files[0];
            if (!file) {
                reject('Tidak ada file dipilih');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const watermarked = await FotoModule.addWatermark(e.target.result);
                    resolve(watermarked);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject('Gagal membaca file');
            reader.readAsDataURL(file);
        });
    },

    // Alamat tetap SPPG (shortened to fit)
    SPPG_ADDRESS: 'Jimbaran, Badung, Bali',

    // Get current GPS location
    getCurrentLocation: () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude.toFixed(6),
                        lng: position.coords.longitude.toFixed(6),
                        accuracy: Math.round(position.coords.accuracy)
                    });
                },
                (error) => {
                    console.log('GPS error:', error.message);
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
            );
        });
    },

    // Tambah watermark ke gambar dengan GPS dan Logo BGN
    addWatermark: async (imageDataUrl) => {
        // Get GPS location first (atau null jika tidak tersedia)
        const gps = await FotoModule.getCurrentLocation();

        // Load BGN logo
        const logoUrl = 'assets/bgn-logo-watermark.png';
        const logoImg = new Image();
        logoImg.src = logoUrl;

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                // Create canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Set canvas size (max 1200px width for compression)
                const maxWidth = 1200;
                const scale = img.width > maxWidth ? maxWidth / img.width : 1;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                // Draw image
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Get watermark text
                const now = new Date();
                const tanggal = now.toLocaleDateString('id-ID', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
                const jam = now.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }) + ' WITA';

                const user = window.App?.state?.currentUser?.nama || 'User';

                // Build watermark lines with icons (UTF-8 symbols)
                const lines = [
                    { icon: '📍', text: FotoModule.SPPG_ADDRESS, color: '#FFD700' },     // Gold - Location
                    { icon: '📅', text: tanggal, color: '#FFFFFF' },                      // White - Date
                    { icon: '⏰', text: jam, color: '#87CEEB' },                          // Light blue - Time
                    { icon: '👤', text: user, color: '#90EE90' }                          // Light green - User
                ];

                // Add GPS if available
                if (gps) {
                    lines.push({ icon: '🛰️', text: `${gps.lat}, ${gps.lng}`, color: '#00FFFF' }); // Cyan
                }

                // Calculate sizes - SMALLER and more compact
                const fontSize = Math.max(12, Math.min(canvas.width * 0.016, 16));
                const padding = 10;
                const lineHeight = fontSize * 1.5;
                const logoSize = Math.min(canvas.width * 0.07, 55);  // Logo proportional to image

                // Badge dimensions (NO BACKGROUND - transparent)
                const badgeHeight = lines.length * lineHeight + padding * 3 + fontSize * 1.2;
                const badgeWidth = canvas.width * 0.40;

                // Position at FAR BOTTOM-RIGHT corner
                const margin = 10;
                const badgeX = canvas.width - badgeWidth - margin;
                const badgeY = canvas.height - badgeHeight - margin;

                // NO BACKGROUND - Just text with strong outline effect
                // (Removed the filled rectangle for transparent look)

                // Wait for logo to load then draw it
                const drawWithLogo = () => {
                    // Draw logo at top-left of badge area
                    const logoX = badgeX + padding;
                    const logoY = badgeY + padding;

                    // Draw white circle behind logo for visibility
                    ctx.beginPath();
                    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 3, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(201, 169, 98, 1)';  // Gold border
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    try {
                        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
                    } catch (e) {
                        console.log('Logo not loaded, skipping');
                    }

                    // Helper function to draw text with outline (readable on any background)
                    const drawTextWithOutline = (text, x, y, fillColor, isTitle = false) => {
                        ctx.font = isTitle ? `bold ${fontSize * 1.2}px Arial` : `bold ${fontSize}px Arial`;
                        ctx.textAlign = 'left';

                        // Strong black outline
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
                        ctx.lineWidth = 4;
                        ctx.lineJoin = 'round';
                        ctx.strokeText(text, x, y);

                        // Fill with color
                        ctx.fillStyle = fillColor;
                        ctx.fillText(text, x, y);
                    };

                    // Draw title next to logo (SPPG name)
                    drawTextWithOutline(
                        FotoModule.SPPG_NAME,
                        logoX + logoSize + 10,
                        logoY + logoSize / 2 + fontSize / 3,
                        '#FFD700',  // Gold
                        true
                    );

                    // Draw info lines below
                    let y = badgeY + padding + logoSize + lineHeight + 5;

                    lines.forEach((line) => {
                        const fullText = `${line.icon} ${line.text}`;
                        drawTextWithOutline(fullText, badgeX + padding, y, line.color);
                        y += lineHeight;
                    });

                    // Convert to compressed JPEG
                    const result = canvas.toDataURL('image/jpeg', 0.82);
                    resolve(result);
                };

                // Wait for logo or timeout
                if (logoImg.complete) {
                    drawWithLogo();
                } else {
                    logoImg.onload = drawWithLogo;
                    logoImg.onerror = drawWithLogo; // Draw without logo if fails
                    // Timeout fallback
                    setTimeout(drawWithLogo, 500);
                }
            };
            img.onerror = () => reject('Gagal memuat gambar');
            img.src = imageDataUrl;
        });
    },

    // Create input element for camera capture
    createCameraInput: (onCapture, label = 'Ambil Foto') => {
        const id = 'foto-input-' + Date.now();
        return `
            <div class="foto-capture">
                <label class="btn btn-secondary foto-btn" for="${id}">
                    📷 ${label}
                </label>
                <input 
                    type="file" 
                    id="${id}"
                    accept="image/*" 
                    capture="environment"
                    onchange="FotoModule.handleCapture(this, ${onCapture})"
                    hidden
                >
                <div class="foto-preview" id="preview-${id}"></div>
            </div>
        `;
    },

    // Handle capture from input
    handleCapture: async (inputElement, callback) => {
        const previewId = 'preview-' + inputElement.id;
        const previewEl = document.getElementById(previewId);

        try {
            // Show loading
            if (previewEl) {
                previewEl.innerHTML = '<div class="foto-loading">⏳ Memproses foto...</div>';
            }

            const watermarked = await FotoModule.captureWithWatermark(inputElement);

            // Show preview
            if (previewEl) {
                previewEl.innerHTML = `<img src="${watermarked}" class="foto-thumbnail" alt="Preview">`;
            }

            // Callback with result
            if (typeof callback === 'function') {
                callback(watermarked);
            }

            return watermarked;
        } catch (error) {
            console.error('Foto error:', error);
            if (previewEl) {
                previewEl.innerHTML = `<div class="foto-error">❌ ${error}</div>`;
            }
            return null;
        }
    },

    // Generate filename for photo
    generateFilename: (prefix = 'SPPG', context = '') => {
        const now = new Date();
        const date = now.toISOString().split('T')[0]; // 2026-01-06
        const time = now.toTimeString().slice(0, 5).replace(':', '-'); // 10-30
        const user = window.App?.state?.currentUser?.nama?.replace(/\s+/g, '_') || 'User';
        const ctx = context.replace(/\s+/g, '_').substring(0, 20);
        return `${prefix}_${ctx}_${date}_${time}_${user}.jpg`;
    },

    // Save photo to phone (download)
    saveToPhone: (dataUrl, filename) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename || FotoModule.generateFilename('SPPG', 'Foto');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.App?.showToast) {
            App.showToast('success', `📥 Foto disimpan: ${filename}`);
        }
    },

    // Capture, watermark, AND save to phone
    captureAndSave: async (inputElement, context = 'Foto') => {
        try {
            const watermarked = await FotoModule.captureWithWatermark(inputElement);
            const filename = FotoModule.generateFilename('SPPG_MBG', context);
            FotoModule.saveToPhone(watermarked, filename);
            return { dataUrl: watermarked, filename: filename };
        } catch (err) {
            console.error('Capture and save error:', err);
            return null;
        }
    },

    // Show foto in modal/fullscreen with download button
    showFoto: (dataUrl, title = 'Foto') => {
        const filename = FotoModule.generateFilename('SPPG_MBG', title);
        const modal = document.createElement('div');
        modal.className = 'foto-modal';
        modal.innerHTML = `
            <div class="foto-modal-content">
                <div class="foto-modal-header">
                    <h3>${title}</h3>
                    <button onclick="this.closest('.foto-modal').remove()">✕</button>
                </div>
                <img src="${dataUrl}" alt="${title}">
                <div class="foto-modal-actions">
                    <button class="btn btn-primary" onclick="FotoModule.saveToPhone('${dataUrl}', '${filename}')">
                        <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span> Simpan ke HP
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    },

    // ============================================
    // MULTI-PHOTO BATCH PROCESSING
    // ============================================

    // Process multiple files with watermark
    captureMultipleWithWatermark: async (inputElement) => {
        const files = inputElement.files;
        if (!files || files.length === 0) {
            throw new Error('Tidak ada file dipilih');
        }

        const results = [];
        const total = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Show progress
            FotoModule.showBatchProgress(i + 1, total, file.name);

            try {
                // Read file as DataURL
                const dataUrl = await FotoModule.readFileAsDataUrl(file);

                // Add watermark
                const watermarked = await FotoModule.addWatermark(dataUrl);

                results.push({
                    original: file.name,
                    dataUrl: watermarked,
                    index: i + 1
                });
            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
            }
        }

        FotoModule.hideBatchProgress();
        return results;
    },

    // Read file as data URL (helper)
    readFileAsDataUrl: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject('Gagal membaca file');
            reader.readAsDataURL(file);
        });
    },

    // Process multiple photos, watermark, and AUTO-SAVE to phone
    processAndSaveMultiple: async (inputElement, context = 'Foto') => {
        try {
            const watermarkedPhotos = await FotoModule.captureMultipleWithWatermark(inputElement);

            const savedFiles = [];
            for (const photo of watermarkedPhotos) {
                const filename = FotoModule.generateFilename('SPPG_MBG', `${context}_${photo.index}`);
                FotoModule.saveToPhone(photo.dataUrl, filename);
                savedFiles.push({
                    dataUrl: photo.dataUrl,
                    filename: filename
                });
            }

            if (window.App?.showToast) {
                App.showToast('success', `${savedFiles.length} foto disimpan dengan watermark!`);
            }

            return savedFiles;
        } catch (err) {
            console.error('Batch save error:', err);
            if (window.App?.showToast) {
                App.showToast('error', 'Gagal memproses foto: ' + err.message);
            }
            return [];
        }
    },

    // Show batch processing progress
    showBatchProgress: (current, total, filename) => {
        let progress = document.getElementById('foto-batch-progress');
        if (!progress) {
            progress = document.createElement('div');
            progress.id = 'foto-batch-progress';
            progress.className = 'foto-batch-progress';
            document.body.appendChild(progress);
        }

        const percent = Math.round((current / total) * 100);
        progress.innerHTML = `
            <div class="batch-progress-content">
                <div class="batch-progress-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <div class="batch-progress-text">
                    <strong>Memproses foto ${current}/${total}</strong>
                    <small>${filename}</small>
                </div>
                <div class="batch-progress-bar">
                    <div class="batch-progress-fill" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    },

    // Hide batch progress
    hideBatchProgress: () => {
        const progress = document.getElementById('foto-batch-progress');
        if (progress) {
            setTimeout(() => progress.remove(), 500);
        }
    },

    // Handle multi-photo capture from input with preview
    handleMultiCapture: async (inputElement, previewContainerId) => {
        const previewEl = document.getElementById(previewContainerId);

        try {
            if (previewEl) {
                previewEl.innerHTML = '<div class="foto-loading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" class="spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Memproses foto...</div>';
            }

            const watermarkedPhotos = await FotoModule.captureMultipleWithWatermark(inputElement);

            // Show preview grid
            if (previewEl && watermarkedPhotos.length > 0) {
                previewEl.innerHTML = `
                    <div class="foto-grid">
                        ${watermarkedPhotos.map((p, i) => `
                            <div class="foto-grid-item">
                                <img src="${p.dataUrl}" alt="Preview ${i + 1}" onclick="FotoModule.showFoto('${p.dataUrl}', 'Foto ${i + 1}')">
                                <span class="foto-grid-badge">${i + 1}</span>
                            </div>
                        `).join('')}
                    </div>
                    <p class="foto-grid-info">${watermarkedPhotos.length} foto siap (tap untuk lihat)</p>
                `;
            }

            return watermarkedPhotos;
        } catch (error) {
            console.error('Multi capture error:', error);
            if (previewEl) {
                previewEl.innerHTML = `<div class="foto-error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> ${error}</div>`;
            }
            return [];
        }
    },

    // ============================================
    // CAMERA-BASED MULTI-PHOTO (Foto dari Kamera)
    // ============================================

    // Storage untuk accumulated photos
    photoCollections: {},

    // Initialize collection untuk form tertentu
    initCollection: (collectionId) => {
        if (!FotoModule.photoCollections[collectionId]) {
            FotoModule.photoCollections[collectionId] = [];
        }
        return FotoModule.photoCollections[collectionId];
    },

    // Clear collection
    clearCollection: (collectionId) => {
        FotoModule.photoCollections[collectionId] = [];
    },

    // Get collection
    getCollection: (collectionId) => {
        return FotoModule.photoCollections[collectionId] || [];
    },

    // Add photo ke collection dengan watermark + auto-save
    addPhotoToCollection: async (inputElement, collectionId, previewContainerId, context = 'Foto') => {
        const previewEl = document.getElementById(previewContainerId);

        try {
            // Show loading
            const existingPhotos = FotoModule.getCollection(collectionId);
            const loadingHtml = existingPhotos.length > 0
                ? FotoModule.renderPhotoGrid(existingPhotos, collectionId, previewContainerId, context) + '<div class="foto-loading">Memproses foto baru...</div>'
                : '<div class="foto-loading">Memproses foto...</div>';

            if (previewEl) previewEl.innerHTML = loadingHtml;

            // Process photo dengan watermark
            const watermarked = await FotoModule.captureWithWatermark(inputElement);

            if (watermarked) {
                // Generate filename dan save ke HP
                const photoNum = existingPhotos.length + 1;
                const filename = FotoModule.generateFilename('SPPG_MBG', `${context}_${photoNum}`);
                FotoModule.saveToPhone(watermarked, filename);

                // Add ke collection
                FotoModule.photoCollections[collectionId] = FotoModule.initCollection(collectionId);
                FotoModule.photoCollections[collectionId].push({
                    dataUrl: watermarked,
                    filename: filename,
                    index: photoNum
                });
            }

            // Render updated grid
            const photos = FotoModule.getCollection(collectionId);
            if (previewEl) {
                previewEl.innerHTML = FotoModule.renderPhotoGrid(photos, collectionId, previewContainerId, context);
            }

            // Reset input untuk bisa pilih foto baru
            inputElement.value = '';

            return photos;
        } catch (error) {
            console.error('Add photo error:', error);
            if (previewEl) {
                const existingPhotos = FotoModule.getCollection(collectionId);
                previewEl.innerHTML = FotoModule.renderPhotoGrid(existingPhotos, collectionId, previewContainerId, context)
                    + `<div class="foto-error">Gagal: ${error}</div>`;
            }
            return FotoModule.getCollection(collectionId);
        }
    },

    // Render photo grid dengan tombol Tambah Foto Lagi
    renderPhotoGrid: (photos, collectionId, previewContainerId, context) => {
        if (photos.length === 0) return '';

        const inputId = `foto-add-${collectionId}`;

        return `
            <div class="foto-collection">
                <div class="foto-grid">
                    ${photos.map((p, i) => `
                        <div class="foto-grid-item">
                            <img src="${p.dataUrl}" alt="Foto ${i + 1}" onclick="FotoModule.showFoto('${p.dataUrl}', 'Foto ${i + 1}')">
                            <span class="foto-grid-badge">${i + 1}</span>
                            <button class="foto-remove-btn" onclick="FotoModule.removeFromCollection('${collectionId}', ${i}, '${previewContainerId}', '${context}')" title="Hapus foto">×</button>
                        </div>
                    `).join('')}
                    <label class="foto-grid-add" for="${inputId}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <line x1="12" y1="9" x2="12" y2="17"/>
                            <line x1="8" y1="13" x2="16" y2="13"/>
                        </svg>
                        <span>+ Tambah</span>
                        <input type="file" id="${inputId}" accept="image/*" capture="environment" 
                            onchange="FotoModule.addPhotoToCollection(this, '${collectionId}', '${previewContainerId}', '${context}')" hidden>
                    </label>
                </div>
                <p class="foto-grid-info">${photos.length} foto (tap untuk lihat, × untuk hapus)</p>
            </div>
        `;
    },

    // Remove foto dari collection
    removeFromCollection: (collectionId, index, previewContainerId, context) => {
        const photos = FotoModule.getCollection(collectionId);
        if (photos[index]) {
            photos.splice(index, 1);
            // Re-render
            const previewEl = document.getElementById(previewContainerId);
            if (previewEl) {
                previewEl.innerHTML = photos.length > 0
                    ? FotoModule.renderPhotoGrid(photos, collectionId, previewContainerId, context)
                    : '';
            }
        }
    },

    // Create camera input dengan multi-photo support
    createCameraMultiInput: (collectionId, previewContainerId, context = 'Foto') => {
        FotoModule.initCollection(collectionId);
        const inputId = `foto-first-${collectionId}`;

        return `
            <div class="foto-multi-input">
                <label class="btn btn-secondary foto-btn" for="${inputId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                    </svg>
                    Ambil Foto
                </label>
                <input type="file" id="${inputId}" accept="image/*" capture="environment" 
                    onchange="FotoModule.addPhotoToCollection(this, '${collectionId}', '${previewContainerId}', '${context}')" hidden>
                <div id="${previewContainerId}" class="foto-preview"></div>
            </div>
        `;
    }
};

// Make available globally
window.FotoModule = FotoModule;


