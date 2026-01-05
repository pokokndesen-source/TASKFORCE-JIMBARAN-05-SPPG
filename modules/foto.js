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

    // Tambah watermark ke gambar
    addWatermark: (imageDataUrl) => {
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

                // Setup watermark style
                const fontSize = Math.max(16, canvas.width * 0.025);
                ctx.font = `bold ${fontSize}px Arial`;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.lineWidth = 2;

                // Get watermark text
                const now = new Date();
                const tanggal = now.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
                const jam = now.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit'
                }) + ' WIB';

                const user = window.App?.state?.currentUser?.nama || 'User';

                const lines = [
                    FotoModule.SPPG_NAME,
                    tanggal,
                    jam,
                    user
                ];

                // Draw watermark di kanan bawah
                const padding = 15;
                const lineHeight = fontSize * 1.3;
                let y = canvas.height - padding - (lines.length * lineHeight);

                lines.forEach(line => {
                    const textWidth = ctx.measureText(line).width;
                    const x = canvas.width - textWidth - padding;

                    // Stroke untuk outline
                    ctx.strokeText(line, x, y);
                    // Fill text
                    ctx.fillText(line, x, y);

                    y += lineHeight;
                });

                // Add semi-transparent overlay badge
                const badgeHeight = lines.length * lineHeight + padding * 2;
                const badgeWidth = 250;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(
                    canvas.width - badgeWidth - 5,
                    canvas.height - badgeHeight - 5,
                    badgeWidth,
                    badgeHeight
                );

                // Redraw text on top of badge
                ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                y = canvas.height - padding - (lines.length * lineHeight) + lineHeight;
                lines.forEach(line => {
                    const textWidth = ctx.measureText(line).width;
                    const x = canvas.width - textWidth - padding;
                    ctx.fillText(line, x, y);
                    y += lineHeight;
                });

                // Convert to compressed JPEG
                const result = canvas.toDataURL('image/jpeg', 0.7);
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

    // Show foto in modal/fullscreen
    showFoto: (dataUrl, title = 'Foto') => {
        const modal = document.createElement('div');
        modal.className = 'foto-modal';
        modal.innerHTML = `
            <div class="foto-modal-content">
                <div class="foto-modal-header">
                    <h3>${title}</h3>
                    <button onclick="this.closest('.foto-modal').remove()">✕</button>
                </div>
                <img src="${dataUrl}" alt="${title}">
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
