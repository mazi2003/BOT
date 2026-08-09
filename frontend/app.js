const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const API_BASE = 'https://youtube-music-bot-a8uz.onrender.com';

const state = {
    library: [], // Persisted downloaded/added tracks
    playlist: [], // Current queue
    currentIndex: -1,
    currentAudio: new Audio(),
    isPlaying: false,
    isSeeking: false,
    searchResults: []
};

const elements = {
    urlInput: document.getElementById('url-input'),
    addBtn: document.getElementById('add-btn'),
    searchResultsList: document.getElementById('search-results-list'),
    libraryList: document.getElementById('library-list'),
    statusBar: document.getElementById('status-bar'),
    
    // Mini Player
    miniPlayer: document.getElementById('mini-player'),
    miniThumb: document.getElementById('mini-thumb'),
    miniTitle: document.getElementById('mini-title'),
    miniArtist: document.getElementById('mini-artist'),
    miniPlayBtn: document.getElementById('mini-play-btn'),
    miniProgressBar: document.getElementById('mini-progress-bar'),
    
    // Full Player
    fullPlayerModal: document.getElementById('full-player-modal'),
    closePlayerBtn: document.getElementById('close-player-btn'),
    fullThumb: document.getElementById('full-thumb'),
    fullTitle: document.getElementById('full-title'),
    fullArtist: document.getElementById('full-artist'),
    progressBar: document.getElementById('progress-bar'),
    currentTime: document.getElementById('current-time'),
    totalTime: document.getElementById('total-time'),
    playBtn: document.getElementById('play-btn'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    downloadBtn: document.getElementById('download-btn'),
    clearLibBtn: document.getElementById('clear-lib-btn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupEventListeners();
    loadLibrary();
});

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });
}

function setupEventListeners() {
    elements.addBtn.addEventListener('click', handleSearch);
    elements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    // Player Toggles
    elements.miniPlayer.addEventListener('click', (e) => {
        if (e.target.closest('#mini-play-btn')) {
            togglePlay();
        } else {
            elements.fullPlayerModal.classList.add('active');
        }
    });
    elements.closePlayerBtn.addEventListener('click', () => {
        elements.fullPlayerModal.classList.remove('active');
    });

    // Full Player Controls
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

    elements.clearLibBtn.addEventListener('click', clearLibrary);
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
    elements.miniPlayBtn.innerHTML = isPlaying 
        ? '<span class="material-symbols-rounded">pause</span>' 
        : '<span class="material-symbols-rounded">play_arrow</span>';
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
    elements.searchResultsList.innerHTML = ''; 

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
    elements.searchResultsList.innerHTML = '';
    results.forEach((res, index) => {
        const item = document.createElement('div');
        item.className = 'track-item';
        item.innerHTML = `
            <img class="track-thumb" src="${res.thumbnail || 'https://ui-avatars.com/api/?name=Music&background=222&color=fff'}" alt="Thumb">
            <div class="track-info">
                <h4 class="track-title">${res.title}</h4>
                <p class="track-artist">${res.artist} • ${res.duration || '0:00'}</p>
            </div>
            <button class="icon-btn"><span class="material-symbols-rounded">add</span></button>
        `;
        item.onclick = () => addAndPlayFromSearch(index);
        elements.searchResultsList.appendChild(item);
    });
}

function addAndPlayFromSearch(index) {
    const track = state.searchResults[index];
    // Check if already in library
    let libIndex = state.library.findIndex(t => t.id === track.id);
    if (libIndex === -1) {
        state.library.push(track);
        saveLibrary();
        renderLibrary();
        libIndex = state.library.length - 1;
        setStatus('✅ تمت الإضافة إلى المكتبة');
    }
    
    playFromLibrary(libIndex);
}

// Library Logic
function renderLibrary() {
    elements.libraryList.innerHTML = '';
    if (state.library.length === 0) {
        elements.libraryList.innerHTML = '<p style="color: var(--text-sec); text-align: center; padding: 20px;">المكتبة فارغة</p>';
        return;
    }

    state.library.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = `track-item ${state.currentIndex === index && state.playlist === state.library ? 'playing' : ''}`;
        item.innerHTML = `
            <img class="track-thumb" src="${track.thumbnail || 'https://ui-avatars.com/api/?name=Music&background=222&color=fff'}" alt="Thumb">
            <div class="track-info">
                <h4 class="track-title">${track.title}</h4>
                <p class="track-artist">${track.artist}</p>
            </div>
        `;
        item.onclick = () => playFromLibrary(index);
        elements.libraryList.appendChild(item);
    });
}

function clearLibrary() {
    if (confirm('هل أنت متأكد من مسح جميع الأغاني المحفوظة؟')) {
        state.library = [];
        saveLibrary();
        renderLibrary();
    }
}

// Playback Logic
function playFromLibrary(index) {
    state.playlist = state.library; // The queue is the library
    playTrack(index);
}

async function playTrack(index) {
    if (index < 0 || index >= state.playlist.length) return;
    
    state.currentIndex = index;
    const track = state.playlist[index];
    
    // Show Mini Player
    elements.miniPlayer.style.display = 'block';
    
    // Update UI
    const defaultThumb = 'https://ui-avatars.com/api/?name=Music&background=222&color=fff';
    elements.miniTitle.textContent = track.title;
    elements.miniArtist.textContent = track.artist;
    elements.miniThumb.src = track.thumbnail || defaultThumb;
    
    elements.fullTitle.textContent = track.title;
    elements.fullArtist.textContent = track.artist;
    elements.fullThumb.src = track.thumbnail || defaultThumb;
    
    elements.progressBar.value = 0;
    elements.miniProgressBar.style.width = '0%';
    elements.currentTime.textContent = '0:00';
    elements.totalTime.textContent = track.duration || '0:00';

    if (state.playlist === state.library) renderLibrary();

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
                saveLibrary();
                startAudio(track.audioUrl);
            } else {
                setStatus('❌ لا يمكن تشغيل الأغنية');
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
            playTrack(state.currentIndex > -1 ? state.currentIndex : 0);
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
    elements.miniProgressBar.style.width = `${progress}%`;
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
function saveLibrary() {
    try {
        localStorage.setItem('music_library', JSON.stringify(state.library));
    } catch (e) {
        console.warn('Could not save:', e);
    }
}

function loadLibrary() {
    try {
        const saved = localStorage.getItem('music_library');
        if (saved) {
            state.library = JSON.parse(saved);
            renderLibrary();
        }
        
        // Migrate old yt_playlist or playlist if music_library is empty
        if (state.library.length === 0) {
            const oldSaved = localStorage.getItem('yt_playlist') || localStorage.getItem('playlist');
            if (oldSaved) {
                state.library = JSON.parse(oldSaved);
                saveLibrary();
                renderLibrary();
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
