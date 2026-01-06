// ============================================
// SPPG MBG - FOTO MODULE
// ============================================
// 
// Fitur:
// - Capture foto dari kamera
// - Auto watermark: SPPG MBG, tanggal, jam, user
// - Compress untuk upload
//
// ============================================

const FotoModule = {
    SPPG_NAME: 'SPPG MBG Jimbaran 05',

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

    // Tambah watermark ke gambar dengan GPS
    addWatermark: async (imageDataUrl) => {
        // Get GPS location first (atau null jika tidak tersedia)
        const gps = await FotoModule.getCurrentLocation();

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
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
                }) + ' WIB';

                const user = window.App?.state?.currentUser?.nama || 'User';

                // Build watermark lines - NO EMOJI to avoid width measurement issues
                const lines = [
                    FotoModule.SPPG_NAME,
                    FotoModule.SPPG_ADDRESS,
                    tanggal,
                    jam,
                    user
                ];

                // Add GPS if available
                if (gps) {
                    lines.push(`GPS: ${gps.lat}, ${gps.lng}`);
                }

                // Calculate sizes
                const fontSize = Math.max(12, Math.min(canvas.width * 0.018, 18));
                const padding = 12;
                const lineHeight = fontSize * 1.5;
                const badgeHeight = lines.length * lineHeight + padding * 2;

                // Badge extends from left position to RIGHT EDGE of image
                const badgeWidth = canvas.width * 0.6;
                const badgeX = canvas.width - badgeWidth; // Extends to right edge
                const badgeY = canvas.height - badgeHeight;

                // Draw semi-transparent background badge
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);

                // Setup text shadow for better visibility
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 2;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                // Draw text with padding from left edge of badge
                ctx.textAlign = 'left';
                const textX = badgeX + padding;

                let y = badgeY + padding + fontSize;
                lines.forEach((line, index) => {
                    // First line (SPPG name) - GREEN
                    if (index === 0) {
                        ctx.font = `bold ${fontSize * 1.1}px Arial`;
                        ctx.fillStyle = '#90EE90'; // Light green
                    } else if (index === lines.length - 1 && gps) {
                        // GPS coordinates - CYAN
                        ctx.font = `${fontSize * 0.9}px monospace`;
                        ctx.fillStyle = '#87CEEB'; // Light blue
                    } else {
                        ctx.font = `${fontSize}px Arial`;
                        ctx.fillStyle = '#FFFFFF'; // White
                    }

                    ctx.fillText(line, textX, y);
                    y += lineHeight;
                });

                // Convert to compressed JPEG
                const result = canvas.toDataURL('image/jpeg', 0.75);
                resolve(result);
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
                        📥 Simpan ke HP
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }
};

// Make available globally
window.FotoModule = FotoModule;
