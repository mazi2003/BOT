// Telegram Mini App - Music Player
const tg = window.Telegram.WebApp;
tg.expand();

// State
const state = {
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    currentAudio: null,
    isSeeking: false
};

// DOM Elements
const elements = {
    urlInput: document.getElementById('url-input'),
    addBtn: document.getElementById('add-btn'),
    playBtn: document.getElementById('play-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    downloadBtn: document.getElementById('download-btn'),
    clearBtn: document.getElementById('clear-btn'),
    progressBar: document.getElementById('progress-bar'),
    volumeBar: document.getElementById('volume-bar'),
    currentTime: document.getElementById('current-time'),
    totalTime: document.getElementById('total-time'),
    trackTitle: document.getElementById('track-title'),
    trackArtist: document.getElementById('track-artist'),
    trackThumbnail: document.getElementById('track-thumbnail'),
    albumArtContainer: document.querySelector('.album-art-container'),
    playlist: document.getElementById('playlist'),
    status: document.getElementById('status')
};

// API Configuration
const API_BASE = 'https://youtube-music-bot-a8uz.onrender.com'; // CHANGE THIS!

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadPlaylist();
    setupEventListeners();
    updateUI();
    tg.ready();
});

// Event Listeners
function setupEventListeners() {
    elements.addBtn.addEventListener('click', handleAddTrack);
    elements.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddTrack();
    });
    
    elements.playBtn.addEventListener('click', togglePlay);
    elements.prevBtn.addEventListener('click', playPrevious);
    elements.nextBtn.addEventListener('click', playNext);
    elements.downloadBtn.addEventListener('click', handleDownload);
    elements.clearBtn.addEventListener('click', clearPlaylist);
    
    elements.progressBar.addEventListener('input', handleSeek);
    elements.volumeBar.addEventListener('input', handleVolumeChange);
}

function addTrackToPlaylist(track, url) {
    state.playlist.push({
        id: track.id,
        title: track.title || 'أغنية بدون عنوان',
        artist: track.artist || 'مجهول',
        duration: track.duration || '00:00',
        thumbnail: track.thumbnail || null,
        url: track.url || url,
        audioUrl: track.audio_url || null
    });
    savePlaylist();
    renderPlaylist();
    setStatus(`✅ تمت إضافة: ${track.title}`);
    if (state.playlist.length === 1) {
        playTrack(0);
    }
}

async function handleAddTrack() {
    const url = elements.urlInput.value.trim();
    if (!url) {
        setStatus('⚠️ أرجو إدخال رابط يوتيوب');
        return;
    }

    elements.addBtn.disabled = true;
    setStatus('⏳ جاري البحث / جلب المعلومات...');

    try {
        const response = await fetch(`${API_BASE}/track_info?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('فشل جلب المعلومات');
        
        const data = await response.json();
        const results = data.results || [data];
        
        if (results.length === 0) {
            setStatus('❌ لم يتم العثور على نتائج');
        } else if (results.length === 1) {
            addTrackToPlaylist(results[0], url);
            elements.urlInput.value = '';
        } else {
            const modal = document.getElementById('search-modal');
            const list = document.getElementById('search-results-list');
            list.innerHTML = '';
            results.forEach(res => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <img src="${res.thumbnail || 'https://ui-avatars.com/api/?name=Music&background=1f1f2e&color=fff'}" alt="thumb">
                    <div class="result-info">
                        <strong>${res.title}</strong>
                        <span>${res.artist} • ${res.duration}</span>
                    </div>
                `;
                li.onclick = () => {
                    modal.classList.remove('active');
                    addTrackToPlaylist(res, res.url);
                    elements.urlInput.value = '';
                };
                list.appendChild(li);
            });
            modal.classList.add('active');
            setStatus('✅ اختر أغنية من النتائج');
        }

    } catch (error) {
        console.error('Error adding track:', error);
        setStatus('❌ حدث خطأ في البحث. حاول مرة أخرى');
    }

    elements.addBtn.disabled = false;
}

// Play Track
async function playTrack(index) {
    if (index < 0 || index >= state.playlist.length) return;

    state.currentIndex = index;
    const track = state.playlist[index];

    // Update UI
    elements.trackTitle.textContent = track.title;
    elements.trackArtist.textContent = track.artist;
    if (track.thumbnail) {
        elements.trackThumbnail.src = track.thumbnail;
    } else {
        elements.trackThumbnail.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(track.title)}&background=1f1f2e&color=fff&size=300`;
    }
    elements.progressBar.value = 0;
    elements.currentTime.textContent = '00:00';
    elements.totalTime.textContent = track.duration || '00:00';

    // Highlight in playlist
    document.querySelectorAll('#playlist li').forEach((li, i) => {
        li.classList.toggle('active', i === index);
    });

    // If we have an audio URL, load and play it
    if (track.audioUrl) {
        if (state.currentAudio) {
            state.currentAudio.pause();
            state.currentAudio = null;
        }

        state.currentAudio = new Audio(track.audioUrl);
        state.currentAudio.volume = elements.volumeBar.value / 100;

        state.currentAudio.addEventListener('timeupdate', updateProgress);
        state.currentAudio.addEventListener('ended', playNext);
        state.currentAudio.addEventListener('loadedmetadata', () => {
            elements.totalTime.textContent = formatTime(state.currentAudio.duration);
        });

        playAudio();
    } else {
        // No audio URL - try to get it from backend
        setStatus('⏳ جاري تجهيز البث...');
        try {
            const response = await fetch(`${API_BASE}/stream?url=${encodeURIComponent(track.url)}`);
            const data = await response.json();
            
            if (data.audio_url) {
                track.audioUrl = data.audio_url;
                savePlaylist();
                playTrack(index); // Recursive call with audio URL
            } else {
                setStatus('❌ لا يمكن تشغيل هذا الفيديو');
                elements.playBtn.disabled = true;
            }
        } catch (error) {
            console.error('Stream error:', error);
            setStatus('❌ خطأ في البث');
        }
    }
}

// Play/Pause
function togglePlay() {
    if (state.isPlaying) {
        pauseAudio();
    } else {
        if (state.currentIndex === -1 && state.playlist.length > 0) {
            playTrack(0);
        } else if (state.currentIndex !== -1) {
            playAudio();
        } else {
            setStatus('⚠️ أضف أغنية أولاً');
        }
    }
}

function playAudio() {
    if (state.currentAudio) {
        state.currentAudio.play();
        state.isPlaying = true;
        elements.playBtn.innerHTML = '<span class="material-symbols-rounded">pause</span>';
        elements.albumArtContainer.classList.add('playing');
        setStatus('▶️ جارٍ التشغيل');
        elements.playBtn.disabled = false;
    }
}

function pauseAudio() {
    if (state.currentAudio) {
        state.currentAudio.pause();
        state.isPlaying = false;
        elements.playBtn.innerHTML = '<span class="material-symbols-rounded">play_arrow</span>';
        elements.albumArtContainer.classList.remove('playing');
        setStatus('⏸️ متوقف مؤقتاً');
    }
}

// Navigation
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

// Progress
function updateProgress() {
    if (state.isSeeking) return;
    if (state.currentAudio) {
        const progress = (state.currentAudio.currentTime / state.currentAudio.duration) * 100;
        elements.progressBar.value = progress;
        elements.currentTime.textContent = formatTime(state.currentAudio.currentTime);
    }
}

function handleSeek(e) {
    state.isSeeking = true;
    if (state.currentAudio) {
        const seekTime = (e.target.value / 100) * state.currentAudio.duration;
        state.currentAudio.currentTime = seekTime;
    }
    setTimeout(() => { state.isSeeking = false; }, 100);
}

// Volume
function handleVolumeChange(e) {
    if (state.currentAudio) {
        state.currentAudio.volume = e.target.value / 100;
    }
}

// Download
async function handleDownload() {
    if (state.currentIndex === -1) return;
    
    const track = state.playlist[state.currentIndex];
    const downloadBtn = elements.downloadBtn;
    downloadBtn.disabled = true;
    setStatus('⏳ جاري التحميل... سيصلك الملف قريباً');

    try {
        const chat_id = tg.initDataUnsafe?.user?.id || 0;
        
        const response = await fetch(`${API_BASE}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: track.url, chat_id: chat_id })
        });

        if (response.ok) {
            setStatus(`✅ تم الطلب! راجع المحادثة مع البوت`);
        } else {
            throw new Error('فشل التحميل');
        }

    } catch (error) {
        console.error('Download error:', error);
        setStatus('❌ فشل الطلب. حاول مرة أخرى');
    }

    downloadBtn.disabled = false;
}

// Playlist Management
function renderPlaylist() {
    const ul = elements.playlist;
    ul.innerHTML = '';
    
    state.playlist.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = index === state.currentIndex ? 'active' : '';
        li.innerHTML = `
            <div class="track-info">
                <div class="track-name">${track.title}</div>
                <div class="track-duration">${track.artist} · ${track.duration}</div>
            </div>
            <button class="remove-btn" data-index="${index}">
                <span class="material-symbols-rounded">close</span>
            </button>
        `;
        
        li.addEventListener('click', (e) => {
            if (!e.target.closest('.remove-btn')) {
                playTrack(index);
            }
        });
        
        const removeBtn = li.querySelector('.remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTrack(index);
        });
        
        ul.appendChild(li);
    });

    elements.clearBtn.style.display = state.playlist.length > 0 ? 'block' : 'none';
    updateControls();
}

function removeTrack(index) {
    state.playlist.splice(index, 1);
    if (state.currentIndex === index) {
        state.currentIndex = -1;
        if (state.currentAudio) {
            state.currentAudio.pause();
            state.currentAudio = null;
        }
        state.isPlaying = false;
        elements.playBtn.textContent = '▶️';
    } else if (state.currentIndex > index) {
        state.currentIndex--;
    }
    savePlaylist();
    renderPlaylist();
    updateUI();
}

function clearPlaylist() {
    if (state.playlist.length === 0) return;
    if (confirm('هل أنت متأكد من مسح قائمة التشغيل؟')) {
        state.playlist = [];
        state.currentIndex = -1;
        if (state.currentAudio) {
            state.currentAudio.pause();
            state.currentAudio = null;
        }
        state.isPlaying = false;
        savePlaylist();
        renderPlaylist();
        updateUI();
        setStatus('🗑️ تم مسح القائمة');
    }
}

// UI Updates
function updateUI() {
    const hasTracks = state.playlist.length > 0;
    elements.playBtn.disabled = !hasTracks;
    elements.prevBtn.disabled = !hasTracks;
    elements.nextBtn.disabled = !hasTracks;
    elements.downloadBtn.disabled = !hasTracks || state.currentIndex === -1;
}

function updateControls() {
    updateUI();
    if (state.currentIndex !== -1) {
        elements.playBtn.disabled = false;
    }
}

function setStatus(message) {
    elements.status.textContent = message;
    setTimeout(() => {
        if (!message.includes('⚠️') && !message.includes('❌') && !message.includes('✅')) {
            elements.status.textContent = '📱 جاهز';
        }
    }, 3000);
}

// Storage
function savePlaylist() {
    try {
        localStorage.setItem('playlist', JSON.stringify(state.playlist));
        localStorage.setItem('currentIndex', state.currentIndex);
    } catch (e) {
        console.warn('Could not save playlist:', e);
    }
}

function loadPlaylist() {
    try {
        const saved = localStorage.getItem('playlist');
        if (saved) {
            state.playlist = JSON.parse(saved);
            state.currentIndex = parseInt(localStorage.getItem('currentIndex')) || -1;
            renderPlaylist();
            if (state.currentIndex !== -1 && state.currentIndex < state.playlist.length) {
                const track = state.playlist[state.currentIndex];
                elements.trackTitle.textContent = track.title;
                elements.trackArtist.textContent = track.artist;
                if (track.thumbnail) {
                    elements.trackThumbnail.src = track.thumbnail;
                } else {
                    elements.trackThumbnail.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(track.title)}&background=1f1f2e&color=fff&size=300`;
                }
                elements.totalTime.textContent = track.duration || '00:00';
            }
        }
    } catch (e) {
        console.warn('Could not load playlist:', e);
    }
}

// Utilities
function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Telegram WebApp Events
tg.onEvent('mainButtonClicked', () => {
    if (state.isPlaying) {
        pauseAudio();
    } else {
        playAudio();
    }
});

// Handle closing
window.addEventListener('beforeunload', () => {
    if (state.currentAudio) {
        state.currentAudio.pause();
    }
});

// Modal Events
document.addEventListener('DOMContentLoaded', () => {
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('search-modal').classList.remove('active');
        });
    }
});
