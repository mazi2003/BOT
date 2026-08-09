const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const API_BASE = 'https://youtube-music-bot-a8uz.onrender.com';

const state = {
    playlist: [], // Can hold search results or a queue
    currentIndex: -1,
    currentAudio: new Audio(),
    isPlaying: false,
    isSeeking: false,
    searchResults: [] // Temporary store for search results
};

const elements = {
    urlInput: document.getElementById('url-input'),
    addBtn: document.getElementById('add-btn'),
    playerSection: document.getElementById('player-section'),
    trackThumbnail: document.getElementById('track-thumbnail'),
    playBtn: document.getElementById('play-btn'),
    progressBar: document.getElementById('progress-bar'),
    trackTitle: document.getElementById('track-title'),
    trackArtist: document.getElementById('track-artist'),
    currentTime: document.getElementById('current-time'),
    totalTime: document.getElementById('total-time'),
    downloadBtn: document.getElementById('download-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    feedList: document.getElementById('feed-list'),
    statusBar: document.getElementById('status-bar')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadPlaylist();
});

function setupEventListeners() {
    elements.addBtn.addEventListener('click', handleSearch);
    elements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    elements.playBtn.addEventListener('click', togglePlay);
    elements.prevBtn.addEventListener('click', playPrevious);
    elements.nextBtn.addEventListener('click', playNext);
    elements.downloadBtn.addEventListener('click', handleDownload);
    
    elements.progressBar.addEventListener('input', handleSeek);
    
    // Audio Events
    state.currentAudio.addEventListener('timeupdate', updateProgress);
    state.currentAudio.addEventListener('ended', playNext);
    state.currentAudio.addEventListener('loadedmetadata', () => {
        elements.totalTime.textContent = formatTime(state.currentAudio.duration);
    });
    state.currentAudio.addEventListener('error', (e) => {
        console.error('Audio element error:', e);
        setStatus('❌ خطأ في تحميل الصوت.');
        setPlayIcon(false);
    });
}

function setStatus(msg) {
    elements.statusBar.style.display = 'block';
    elements.statusBar.textContent = msg;
    if (!msg.includes('⏳')) {
        setTimeout(() => {
            elements.statusBar.style.display = 'none';
        }, 4000);
    }
}

function setPlayIcon(isPlaying) {
    state.isPlaying = isPlaying;
    elements.playBtn.innerHTML = isPlaying 
        ? '<span class="material-symbols-rounded">pause</span>' 
        : '<span class="material-symbols-rounded">play_arrow</span>';
}

// Search Logic
async function handleSearch() {
    const query = elements.urlInput.value.trim();
    if (!query) return;

    elements.addBtn.disabled = true;
    setStatus('⏳ جاري البحث...');
    elements.feedList.innerHTML = ''; // Clear previous results

    try {
        const response = await fetch(`${API_BASE}/track_info?url=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('فشل جلب المعلومات');
        
        const data = await response.json();
        const results = data.results || [data];
        
        if (results.length === 0) {
            setStatus('❌ لم يتم العثور على نتائج');
        } else {
            setStatus('✅ تم العثور على نتائج');
            state.searchResults = results;
            renderSearchResults(results);
        }
    } catch (error) {
        console.error('Search error:', error);
        setStatus('❌ حدث خطأ في البحث. حاول مرة أخرى');
    }

    elements.addBtn.disabled = false;
}

function renderSearchResults(results) {
    elements.feedList.innerHTML = '';
    results.forEach((res, index) => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${res.thumbnail || 'https://ui-avatars.com/api/?name=YT&background=000&color=fff'}" alt="Thumb">
                <span class="duration-badge">${res.duration}</span>
            </div>
            <div class="card-details">
                <h4 class="card-title">${res.title}</h4>
                <p class="card-channel">${res.artist}</p>
            </div>
        `;
        card.onclick = () => playFromSearch(index);
        elements.feedList.appendChild(card);
    });
}

// Playback Logic
function playFromSearch(index) {
    const track = state.searchResults[index];
    // Set as current playlist of 1 for now (to mimic simple usage)
    state.playlist = [track];
    state.currentIndex = 0;
    savePlaylist();
    playTrack(0);
}

async function playTrack(index) {
    if (index < 0 || index >= state.playlist.length) return;
    
    state.currentIndex = index;
    const track = state.playlist[index];
    
    // Show Player
    elements.playerSection.style.display = 'block';
    
    // Update UI
    elements.trackTitle.textContent = track.title;
    elements.trackArtist.textContent = track.artist;
    elements.trackThumbnail.src = track.thumbnail || 'https://ui-avatars.com/api/?name=YT&background=000&color=fff';
    elements.progressBar.value = 0;
    elements.currentTime.textContent = '0:00';
    elements.totalTime.textContent = track.duration || '0:00';

    if (track.audioUrl) {
        startAudio(track.audioUrl);
    } else {
        setStatus('⏳ جاري تجهيز البث...');
        setPlayIcon(false);
        try {
            const response = await fetch(`${API_BASE}/stream?url=${encodeURIComponent(track.url)}`);
            const data = await response.json();
            
            if (data.audio_url) {
                track.audioUrl = data.audio_url;
                savePlaylist();
                startAudio(track.audioUrl);
            } else {
                setStatus('❌ لا يمكن تشغيل هذا الفيديو');
            }
        } catch (error) {
            console.error('Stream error:', error);
            setStatus('❌ خطأ في البث');
        }
    }
}

function startAudio(url) {
    state.currentAudio.src = url;
    state.currentAudio.play().then(() => {
        setPlayIcon(true);
        setStatus('▶️ جارٍ التشغيل');
        elements.downloadBtn.disabled = false;
    }).catch(e => {
        console.error('Play error:', e);
        setStatus('❌ لا يمكن التشغيل تلقائياً. اضغط زر التشغيل');
        setPlayIcon(false);
    });
}

function togglePlay() {
    if (state.isPlaying) {
        state.currentAudio.pause();
        setPlayIcon(false);
    } else {
        if (state.currentAudio.src) {
            state.currentAudio.play().then(() => setPlayIcon(true)).catch(console.error);
        } else if (state.playlist.length > 0) {
            playTrack(0);
        }
    }
}

function playNext() {
    if (state.playlist.length === 0) return;
    const nextIndex = (state.currentIndex + 1) % state.playlist.length;
    playTrack(nextIndex);
}

function playPrevious() {
    if (state.playlist.length === 0) return;
    const prevIndex = state.currentIndex <= 0 ? state.playlist.length - 1 : state.currentIndex - 1;
    playTrack(prevIndex);
}

function updateProgress() {
    if (state.isSeeking || !state.currentAudio.duration) return;
    const progress = (state.currentAudio.currentTime / state.currentAudio.duration) * 100;
    elements.progressBar.value = progress;
    elements.currentTime.textContent = formatTime(state.currentAudio.currentTime);
}

function handleSeek(e) {
    state.isSeeking = true;
    if (state.currentAudio.duration) {
        const seekTime = (e.target.value / 100) * state.currentAudio.duration;
        state.currentAudio.currentTime = seekTime;
    }
    setTimeout(() => { state.isSeeking = false; }, 100);
}

// Download
async function handleDownload() {
    if (state.currentIndex === -1) return;
    
    const track = state.playlist[state.currentIndex];
    elements.downloadBtn.disabled = true;
    setStatus('⏳ جاري التحميل... سيصلك الملف في المحادثة');

    try {
        const chat_id = tg.initDataUnsafe?.user?.id || 0;
        
        const response = await fetch(`${API_BASE}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: track.url, chat_id: chat_id })
        });

        if (response.ok) {
            setStatus('✅ تم الطلب بنجاح! راجع المحادثة');
        } else {
            throw new Error('فشل الطلب');
        }
    } catch (error) {
        console.error('Download error:', error);
        setStatus('❌ فشل التحميل. حاول مرة أخرى');
    }

    elements.downloadBtn.disabled = false;
}

// Storage
function savePlaylist() {
    try {
        localStorage.setItem('yt_playlist', JSON.stringify(state.playlist));
        localStorage.setItem('yt_currentIndex', state.currentIndex);
    } catch (e) {
        console.warn('Could not save:', e);
    }
}

function loadPlaylist() {
    try {
        const saved = localStorage.getItem('yt_playlist');
        if (saved) {
            state.playlist = JSON.parse(saved);
            state.currentIndex = parseInt(localStorage.getItem('yt_currentIndex')) || -1;
            
            if (state.currentIndex !== -1 && state.currentIndex < state.playlist.length) {
                const track = state.playlist[state.currentIndex];
                elements.playerSection.style.display = 'block';
                elements.trackTitle.textContent = track.title;
                elements.trackArtist.textContent = track.artist;
                elements.trackThumbnail.src = track.thumbnail || 'https://ui-avatars.com/api/?name=YT&background=000&color=fff';
                elements.totalTime.textContent = track.duration || '0:00';
            }
        }
    } catch (e) {
        console.warn('Could not load:', e);
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

tg.onEvent('mainButtonClicked', togglePlay);
window.addEventListener('beforeunload', () => {
    if (state.currentAudio) state.currentAudio.pause();
});
