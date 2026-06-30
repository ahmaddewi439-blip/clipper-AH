// ============================================
// YOUTUBE PREVIEW CARD - VERSI PRO
// ============================================

class YouTubePreviewCard {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.apiBaseUrl = options.apiBaseUrl || 'http://localhost:3000';
        this.onAnalyze = options.onAnalyze || (() => {});
        this.currentData = null;
        
        this.init();
    }
    
    init() {
        this.renderSkeleton();
    }
    
    // Render skeleton loading
    renderSkeleton() {
        this.container.innerHTML = `
            <div class="yt-preview-skeleton" style="display:none;">
                <div class="yt-skeleton-thumb"></div>
                <div class="yt-skeleton-info">
                    <div class="yt-skeleton-title"></div>
                    <div class="yt-skeleton-meta"></div>
                </div>
            </div>
            <div class="yt-preview-error" style="display:none;"></div>
            <div class="yt-preview-card" style="display:none;"></div>
        `;
    }
    
    // Show loading state
    showLoading() {
        this.container.querySelector('.yt-preview-skeleton').style.display = 'flex';
        this.container.querySelector('.yt-preview-card').style.display = 'none';
        this.container.querySelector('.yt-preview-error').style.display = 'none';
    }
    
    // Show error state
    showError(message) {
        this.container.querySelector('.yt-preview-skeleton').style.display = 'none';
        this.container.querySelector('.yt-preview-card').style.display = 'none';
        const errorEl = this.container.querySelector('.yt-preview-error');
        errorEl.style.display = 'block';
        errorEl.innerHTML = `
            <div class="yt-error-icon">⚠️</div>
            <div class="yt-error-text">${message}</div>
        `;
    }
    
    // Fetch and display video info
    async loadVideo(url) {
        this.showLoading();
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/youtube-info?url=${encodeURIComponent(url)}`);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error);
            }
            
            this.currentData = result.data;
            this.renderCard(result.data);
            
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    // Render the card
    renderCard(data) {
        this.container.querySelector('.yt-preview-skeleton').style.display = 'none';
        this.container.querySelector('.yt-preview-error').style.display = 'none';
        
        const card = this.container.querySelector('.yt-preview-card');
        card.style.display = 'block';
        
        card.innerHTML = `
            <div class="yt-card">
                <div class="yt-thumbnail-wrap">
                    <img src="${data.thumbnail}" 
                         alt="${data.title}" 
                         class="yt-thumbnail"
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/480x360?text=No+Thumbnail'">
                    <span class="yt-duration">${data.duration}</span>
                    <div class="yt-play-overlay">
                        <svg viewBox="0 0 24 24" fill="white" width="48" height="48">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </div>
                </div>
                
                <div class="yt-info">
                    <h3 class="yt-title">${this.escapeHtml(data.title)}</h3>
                    
                    <div class="yt-channel">
                        <div class="yt-channel-avatar">${data.channelName.charAt(0)}</div>
                        <div class="yt-channel-name">${this.escapeHtml(data.channelName)}</div>
                        <span class="yt-verified">✓</span>
                    </div>
                    
                    <div class="yt-meta">
                        <span class="yt-views">👁 ${data.views} views</span>
                        <span class="yt-dot">•</span>
                        <span class="yt-date">${data.publishedAt}</span>
                    </div>
                    
                    <div class="yt-tags">
                        ${data.tags.slice(0, 5).map(tag => `<span class="yt-tag">#${tag}</span>`).join('')}
                    </div>
                    
                    <div class="yt-actions">
                        <button class="yt-btn-analyze" onclick="previewCard.analyze()">
                            <span class="yt-btn-icon">🔍</span>
                            Analisis Video Ini
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Trigger analyze
    analyze() {
        if (this.currentData) {
            this.onAnalyze(this.currentData);
        }
    }
    
    // Clear preview
    clear() {
        this.container.querySelector('.yt-preview-card').style.display = 'none';
        this.container.querySelector('.yt-preview-error').style.display = 'none';
        this.currentData = null;
    }
}

// Export for use
window.YouTubePreviewCard = YouTubePreviewCard;