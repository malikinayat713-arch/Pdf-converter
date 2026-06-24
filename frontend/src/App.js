import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('convert');
  const [dragOver, setDragOver] = useState(false);

  // Admin State
  const [adminMode, setAdminMode] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState(null);
  const [adminActivity, setAdminActivity] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const ADMIN_EMAIL = 'alphacoders930@gmail.com';

  // Dictionary State
  const [dict, setDict] = useState({ شخصیات: [], اماکن: [], کتابیں: [], زبانیں: [] });
  const [dictCounts, setDictCounts] = useState({});
  const [dictCat, setDictCat] = useState('شخصیات');
  const [dictText, setDictText] = useState('');
  const [dictMsg, setDictMsg] = useState('');
  const [dictBusy, setDictBusy] = useState(false);
  const dictFileRef = useRef();

  // فہارس State
  const [fiharisFile, setFiharisFile] = useState(null);
  const [fiharisPdfId, setFiharisPdfId] = useState(null);
  const [fiharisUploadProg, setFiharisUploadProg] = useState(null);
  const [fiharisGenProg, setFiharisGenProg] = useState(null);
  const [fiharisUrl, setFiharisUrl] = useState(null);
  const [fiharisStats, setFiharisStats] = useState(null);
  const [fiharisError, setFiharisError] = useState(null);
  const [fiharisUploadTime, setFiharisUploadTime] = useState(0);
  const [fiharisGenTime, setFiharisGenTime] = useState(0);
  // فہارس mode: 'auto' (rules) or 'custom' (my own list — 100% exact)
  const [fiharisMode, setFiharisMode] = useState('auto');
  const [fiharisListCat, setFiharisListCat] = useState('شخصیات');
  const [fiharisList, setFiharisList] = useState({ شخصیات: '', اماکن: '', کتابیں: '', زبانیں: '' });
  const fiharisFileRef = useRef();
  const fiharisUploadEsRef = useRef();
  const fiharisGenEsRef = useRef();
  const fiharisUploadTimerRef = useRef();
  const fiharisGenTimerRef = useRef();
  const fiharisUploadStartRef = useRef(null);
  const fiharisGenStartRef = useRef(null);

  // Convert State
  const [convertFile, setConvertFile] = useState(null);
  const [convertProgress, setConvertProgress] = useState(null);
  const [convertUrl, setConvertUrl] = useState(null);
  const [convertError, setConvertError] = useState(null);
  const [convertTime, setConvertTime] = useState(0);
  const convertFileRef = useRef();
  const esRef = useRef();
  const convertStartTimeRef = useRef(null);
  const convertTimerRef = useRef(null);

  // Search State
  const [searchFile, setSearchFile] = useState(null);
  const [pdfId, setPdfId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchProgress, setSearchProgress] = useState(null);
  const [searchTime, setSearchTime] = useState(0);
  const [downloading, setDownloading] = useState(null); // 'pdf' | 'report' | null
  const searchFileRef = useRef();
  const searchStartTimeRef = useRef(null);
  const searchTimerRef = useRef(null);
  const searchEsRef = useRef();

  // Auth Check
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('login') === 'success') {
      try {
        const userData = p.get('user');
        const tokenData = p.get('token');
        if (userData) {
          const user = JSON.parse(atob(userData));
          localStorage.setItem('user', JSON.stringify(user));
          if (tokenData) {
            const tokens = JSON.parse(atob(tokenData));
            localStorage.setItem('tokens', JSON.stringify(tokens));
            console.log('✅ Tokens saved:', Object.keys(tokens));
          }
          setUser(user);
          window.history.replaceState({}, '', '/');
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Login error:', e);
      }
    }

    const savedUser = localStorage.getItem('user');
    const savedTokens = localStorage.getItem('tokens');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      console.log('✅ User loaded from storage');
    }
    if (savedTokens) {
      console.log('✅ Tokens loaded from storage');
    }

    axios
      .get(`${API}/auth/user`, { withCredentials: true })
      .then(r => {
        if (r.data.loggedIn && r.data.user) setUser(r.data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    localStorage.removeItem('user');
    localStorage.removeItem('tokens');
    setUser(null);
  };

  // Format time helper
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Calculate estimated remaining time
  const getTimeRemaining = (elapsed, percent) => {
    if (percent === 0) return 0;
    const totalEstimated = (elapsed / percent) * 100;
    return Math.max(0, totalEstimated - elapsed);
  };

  // ── Admin Functions ──
  const loadAdmin = async () => {
    setAdminLoading(true);
    try {
      const storedTokens = localStorage.getItem('tokens');
      const storedUser   = localStorage.getItem('user');
      const hdrs = {};
      if (storedTokens) hdrs['X-Tokens'] = storedTokens;
      if (storedUser)   hdrs['X-User']   = btoa(storedUser);
      const axiosOpts = { withCredentials: true, headers: hdrs };
      const [statsRes, usersRes, actRes] = await Promise.all([
        axios.get(`${API}/api/admin/stats`, axiosOpts),
        axios.get(`${API}/api/admin/users`, axiosOpts),
        axios.get(`${API}/api/admin/activity?limit=50`, axiosOpts),
      ]);
      setAdminStats(statsRes.data);
      setAdminUsers(usersRes.data.users);
      setAdminActivity(actRes.data.activity);
    } catch (e) {
      console.error('Admin load error', e);
    }
    setAdminLoading(false);
  };

  const openAdmin = () => { setAdminMode(true); loadAdmin(); };
  const closeAdmin = () => setAdminMode(false);

  const fmtUptime = (s) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fmtAgo = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  };

  const actIcon = { converts: '📄', searches: '🔍', indexes: '📋' };

  // ── Dictionary Functions ──
  const dictAuthOpts = () => {
    const t = localStorage.getItem('tokens');
    const u = localStorage.getItem('user');
    const headers = {};
    if (t) headers['X-Tokens'] = t;
    if (u) headers['X-User'] = btoa(u);
    return { withCredentials: true, headers };
  };

  const loadDict = async () => {
    try {
      const r = await axios.get(`${API}/api/dictionary`, dictAuthOpts());
      setDict(r.data.dictionary);
      setDictCounts(r.data.counts);
    } catch (e) { console.error('Dict load error', e); }
  };

  const addDictText = async () => {
    if (!dictText.trim()) return;
    setDictBusy(true); setDictMsg('');
    try {
      const r = await axios.post(`${API}/api/dictionary/add`,
        { category: dictCat, text: dictText }, dictAuthOpts());
      setDictMsg(`✅ ${r.data.added} naye alfaaz add hue (total: ${r.data.total})`);
      setDictText('');
      loadDict();
    } catch (e) { setDictMsg('❌ Add fail: ' + (e.response?.data?.error || e.message)); }
    setDictBusy(false);
  };

  const uploadDictFile = async (file) => {
    if (!file) return;
    setDictBusy(true); setDictMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', dictCat);
      const opts = dictAuthOpts();
      opts.headers['Content-Type'] = 'multipart/form-data';
      const r = await axios.post(`${API}/api/dictionary/upload`, fd, opts);
      setDictMsg(`✅ File se ${r.data.added} alfaaz add hue (total: ${r.data.total})`);
      loadDict();
    } catch (e) { setDictMsg('❌ Upload fail: ' + (e.response?.data?.error || e.message)); }
    setDictBusy(false);
  };

  const removeDictTerm = async (category, term) => {
    try {
      await axios.post(`${API}/api/dictionary/remove`, { category, term }, dictAuthOpts());
      setDict(prev => ({ ...prev, [category]: prev[category].filter(t => t !== term) }));
      setDictCounts(prev => ({ ...prev, [category]: (prev[category] || 1) - 1 }));
    } catch (e) { console.error('Remove error', e); }
  };

  const clearDictCat = async (category) => {
    if (!window.confirm(`${category} ki saari vocabulary delete kardein?`)) return;
    try {
      await axios.post(`${API}/api/dictionary/clear`, { category }, dictAuthOpts());
      setDict(prev => ({ ...prev, [category]: [] }));
      setDictCounts(prev => ({ ...prev, [category]: 0 }));
      setDictMsg(`🗑️ ${category} clear ho gayi`);
    } catch (e) { console.error('Clear error', e); }
  };

  // ── Convert Functions ──
  const handleDrop = useCallback(e => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    const CONVERT_TYPES = ['application/pdf','image/jpeg','image/jpg','image/png','image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'];
    const DOC_TYPES = ['application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'];

    if (mode === 'convert') {
      if (CONVERT_TYPES.includes(f?.type)) {
        setConvertFile(f);
        setConvertError(null);
      } else {
        setConvertError('PDF، Word یا Image chahiye');
      }
    } else if (mode === 'search') {
      if (DOC_TYPES.includes(f?.type)) {
        setSearchFile(f);
        setSearchError(null);
      } else {
        setSearchError('PDF یا Word file chahiye');
      }
    } else if (mode === 'fiharis') {
      if (DOC_TYPES.includes(f?.type)) {
        setFiharisFile(f);
        setFiharisError(null);
      } else {
        setFiharisError('PDF یا Word file چاہیے');
      }
    }
  }, [mode]);

  const convert = async () => {
    if (!convertFile) return;
    setConvertError(null);
    setConvertUrl(null);
    setConvertTime(0);
    setConvertProgress({ percent: 0, message: 'Shuru ho raha hai...' });

    convertStartTimeRef.current = Date.now();

    // Timer interval
    if (convertTimerRef.current) clearInterval(convertTimerRef.current);
    convertTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - convertStartTimeRef.current) / 1000);
      setConvertTime(elapsed);
    }, 1000);

    const fd = new FormData();
    fd.append('pdf', convertFile);

    try {
      const config = { withCredentials: true };
      const tokenStr = localStorage.getItem('tokens');
      if (tokenStr) {
        try {
          const tokens = JSON.parse(tokenStr);
          config.headers = { 'X-Tokens': JSON.stringify(tokens) };
          console.log('✅ Tokens sent to convert endpoint');
        } catch (e) {
          console.error('Token parse error:', e);
        }
      } else {
        console.warn('⚠️ No tokens found in storage');
      }

      const { data } = await axios.post(`${API}/api/convert`, fd, config);

      if (esRef.current) esRef.current.close();
      const es = new EventSource(`${API}/api/progress/${data.jobId}`);
      esRef.current = es;

      es.onmessage = e => {
        const d = JSON.parse(e.data);
        setConvertProgress({ percent: d.percent, message: d.message });
        if (d.status === 'done') {
          clearInterval(convertTimerRef.current);
          setConvertUrl(d.downloadUrl);
          es.close();
        }
        if (d.status === 'error') {
          clearInterval(convertTimerRef.current);
          setConvertError(d.message);
          es.close();
        }
      };
      es.onerror = () => {
        clearInterval(convertTimerRef.current);
        es.close();
      };
    } catch (e) {
      clearInterval(convertTimerRef.current);
      setConvertError(e.response?.data?.error || 'Error');
      setConvertProgress(null);
    }
  };

  const uploadForSearch = async () => {
    if (!searchFile) {
      setSearchError('PDF select karo pehle');
      return;
    }
    setSearchError(null);
    setSearchProgress({ percent: 0, message: 'Preparing...' });
    setSearchTime(0);
    searchStartTimeRef.current = Date.now();

    // Timer
    if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    searchTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - searchStartTimeRef.current) / 1000);
      setSearchTime(elapsed);
    }, 1000);

    const fd = new FormData();
    fd.append('pdf', searchFile);

    try {
      const config = { withCredentials: true };
      const tokenStr = localStorage.getItem('tokens');
      if (tokenStr) {
        try {
          const tokens = JSON.parse(tokenStr);
          config.headers = { 'X-Tokens': JSON.stringify(tokens) };
        } catch (e) {
          console.error('Token parse error:', e);
        }
      }

      setSearchProgress({ percent: 5, message: '📤 PDF upload ho rahi hai...' });

      const { data } = await axios.post(`${API}/api/pdf/extract`, fd, config);

      // Listen for real progress — only switch to the search UI when the
      // backend reports "done" (image PDFs run OCR which can take a while).
      if (searchEsRef.current) searchEsRef.current.close();
      const es = new EventSource(`${API}/api/progress/${data.jobId}`);
      searchEsRef.current = es;

      es.onmessage = e => {
        const d = JSON.parse(e.data);
        setSearchProgress({ percent: d.percent, message: d.message });
        if (d.status === 'done') {
          clearInterval(searchTimerRef.current);
          setPdfId(d.pdfId || data.pdfId);
          setSearchProgress(null);
          es.close();
        } else if (d.status === 'error') {
          clearInterval(searchTimerRef.current);
          setSearchError(d.message || 'Extract fail');
          setSearchProgress(null);
          es.close();
        }
      };
      es.onerror = () => {
        clearInterval(searchTimerRef.current);
        es.close();
      };
    } catch (e) {
      clearInterval(searchTimerRef.current);
      const errorMsg = e.response?.data?.error || e.message || 'Upload fail';
      setSearchError(errorMsg);
      setSearchProgress(null);
    }
  };

  const search = async () => {
    if (!pdfId || !searchTerm.trim()) return;
    setSearching(true);

    try {
      const config = { withCredentials: true };
      const tokenStr = localStorage.getItem('tokens');
      if (tokenStr) {
        try {
          const tokens = JSON.parse(tokenStr);
          config.headers = { 'X-Tokens': JSON.stringify(tokens) };
        } catch (e) {
          console.error('Token parse error:', e);
        }
      }

      const { data } = await axios.post(`${API}/api/pdf/search`, {
        pdfId,
        searchTerm,
        caseSensitive: false
      }, config);

      setSearchResults(data);
      setSearchError(null);
    } catch (e) {
      setSearchError(e.response?.data?.error || 'Search fail');
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  };

  // Build auth config for download endpoints (blob response)
  const blobConfig = () => {
    const config = { withCredentials: true, responseType: 'blob' };
    const tokenStr = localStorage.getItem('tokens');
    if (tokenStr) {
      try {
        config.headers = { 'X-Tokens': JSON.stringify(JSON.parse(tokenStr)) };
      } catch (e) {}
    }
    return config;
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  // Read the actual error message from a blob error response
  const readBlobError = async (e) => {
    try {
      if (e.response?.data instanceof Blob) {
        const text = await e.response.data.text();
        const json = JSON.parse(text);
        return json.error || text;
      }
    } catch (_) {}
    return e.response?.data?.error || e.message || 'Unknown error';
  };

  // Download a PDF containing only the pages where the word was found
  const downloadFilteredPdf = async () => {
    if (!searchResults || searchResults.results.length === 0) return;
    setDownloading('pdf');
    setSearchError(null);
    try {
      const pages = searchResults.results.map(r => r.pageNum);
      const { data } = await axios.post(`${API}/api/pdf/create-filtered`, { pdfId, pages }, blobConfig());
      triggerDownload(new Blob([data], { type: 'application/pdf' }), `${searchTerm}-pages.pdf`);
    } catch (e) {
      const msg = await readBlobError(e);
      setSearchError('PDF error: ' + msg);
    } finally {
      setDownloading(null);
    }
  };

  // Download a Word report detailing where the word appears
  const downloadReport = async () => {
    if (!searchResults || searchResults.results.length === 0) return;
    setDownloading('report');
    setSearchError(null);
    try {
      const { data } = await axios.post(
        `${API}/api/pdf/create-report`,
        { pdfId, searchTerm, results: searchResults.results },
        blobConfig()
      );
      triggerDownload(new Blob([data]), `${searchTerm}-report.docx`);
    } catch (e) {
      const msg = await readBlobError(e);
      setSearchError('Report error: ' + msg);
    } finally {
      setDownloading(null);
    }
  };

  // ── فہارس Functions ──
  const uploadForFiharis = async () => {
    if (!fiharisFile) { setFiharisError('PDF select karo pehle'); return; }
    setFiharisError(null);
    setFiharisUploadProg({ percent: 0, message: 'Preparing...' });
    setFiharisUploadTime(0);
    fiharisUploadStartRef.current = Date.now();

    if (fiharisUploadTimerRef.current) clearInterval(fiharisUploadTimerRef.current);
    fiharisUploadTimerRef.current = setInterval(() => {
      setFiharisUploadTime(Math.floor((Date.now() - fiharisUploadStartRef.current) / 1000));
    }, 1000);

    const fd = new FormData();
    fd.append('pdf', fiharisFile);

    try {
      const config = { withCredentials: true };
      const tokenStr = localStorage.getItem('tokens');
      if (tokenStr) {
        try { config.headers = { 'X-Tokens': JSON.stringify(JSON.parse(tokenStr)) }; } catch (e) {}
      }

      setFiharisUploadProg({ percent: 5, message: '📤 PDF upload ho rahi hai...' });
      const { data } = await axios.post(`${API}/api/pdf/extract`, fd, config);

      if (fiharisUploadEsRef.current) fiharisUploadEsRef.current.close();
      const es = new EventSource(`${API}/api/progress/${data.jobId}`);
      fiharisUploadEsRef.current = es;

      es.onmessage = e => {
        const d = JSON.parse(e.data);
        setFiharisUploadProg({ percent: d.percent, message: d.message });
        if (d.status === 'done') {
          clearInterval(fiharisUploadTimerRef.current);
          setFiharisPdfId(d.pdfId || data.pdfId);
          setFiharisUploadProg(null);
          es.close();
        } else if (d.status === 'error') {
          clearInterval(fiharisUploadTimerRef.current);
          setFiharisError(d.message || 'Extract fail');
          setFiharisUploadProg(null);
          es.close();
        }
      };
      es.onerror = () => { clearInterval(fiharisUploadTimerRef.current); es.close(); };
    } catch (e) {
      clearInterval(fiharisUploadTimerRef.current);
      setFiharisError(e.response?.data?.error || e.message || 'Upload fail');
      setFiharisUploadProg(null);
    }
  };

  const generateFiharis = async () => {
    if (!fiharisPdfId) return;
    setFiharisError(null);
    setFiharisUrl(null);
    setFiharisStats(null);
    setFiharisGenProg({ percent: 0, message: 'شروع ہو رہا ہے...' });
    setFiharisGenTime(0);
    fiharisGenStartRef.current = Date.now();

    if (fiharisGenTimerRef.current) clearInterval(fiharisGenTimerRef.current);
    fiharisGenTimerRef.current = setInterval(() => {
      setFiharisGenTime(Math.floor((Date.now() - fiharisGenStartRef.current) / 1000));
    }, 1000);

    try {
      const config = { withCredentials: true };
      const tokenStr = localStorage.getItem('tokens');
      if (tokenStr) {
        try { config.headers = { 'X-Tokens': JSON.stringify(JSON.parse(tokenStr)) }; } catch (e) {}
      }

      const body = { pdfId: fiharisPdfId };
      if (fiharisMode === 'custom') {
        const ct = {};
        for (const c of ['شخصیات','اماکن','کتابیں','زبانیں']) {
          ct[c] = (fiharisList[c] || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        }
        body.customTerms = ct;
        body.autoDetect = false; // 100% targeted — only the user's list
      }

      const { data } = await axios.post(`${API}/api/pdf/generate-index`, body, config);

      if (fiharisGenEsRef.current) fiharisGenEsRef.current.close();
      const es = new EventSource(`${API}/api/progress/${data.jobId}`);
      fiharisGenEsRef.current = es;

      es.onmessage = e => {
        const d = JSON.parse(e.data);
        setFiharisGenProg({ percent: d.percent, message: d.message });
        if (d.status === 'done') {
          clearInterval(fiharisGenTimerRef.current);
          setFiharisUrl(d.downloadUrl);
          setFiharisStats(d.stats);
          setFiharisGenProg(null);
          es.close();
        } else if (d.status === 'error') {
          clearInterval(fiharisGenTimerRef.current);
          setFiharisError(d.message || 'Generate fail');
          setFiharisGenProg(null);
          es.close();
        }
      };
      es.onerror = () => { clearInterval(fiharisGenTimerRef.current); es.close(); };
    } catch (e) {
      clearInterval(fiharisGenTimerRef.current);
      setFiharisError(e.response?.data?.error || e.message || 'Generate fail');
      setFiharisGenProg(null);
    }
  };

  const resetFiharis = () => {
    if (fiharisUploadEsRef.current) fiharisUploadEsRef.current.close();
    if (fiharisGenEsRef.current) fiharisGenEsRef.current.close();
    if (fiharisUploadTimerRef.current) clearInterval(fiharisUploadTimerRef.current);
    if (fiharisGenTimerRef.current) clearInterval(fiharisGenTimerRef.current);
    setFiharisFile(null);
    setFiharisPdfId(null);
    setFiharisUploadProg(null);
    setFiharisGenProg(null);
    setFiharisUrl(null);
    setFiharisStats(null);
    setFiharisError(null);
    setFiharisUploadTime(0);
    setFiharisGenTime(0);
    setFiharisMode('auto');
    setFiharisList({ شخصیات: '', اماکن: '', کتابیں: '', زبانیں: '' });
  };

  const resetConvert = () => {
    setConvertFile(null);
    setConvertProgress(null);
    setConvertUrl(null);
    setConvertError(null);
  };

  const resetSearch = () => {
    if (searchEsRef.current) searchEsRef.current.close();
    if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    setSearchFile(null);
    setSearchTerm('');
    setSearchResults(null);
    setPdfId(null);
    setSearchError(null);
    setSearchProgress(null);
    setSearchTime(0);
    setDownloading(null);
  };

  if (loading)
    return (
      <div className="splash">
        <div className="splash-logo">
          <span className="splash-icon">📄</span>
          <div className="splash-bar">
            <div className="splash-fill" />
          </div>
        </div>
      </div>
    );

  return (
    <div className="app">
      <div className="bg-gradient" />

      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-badge">📄</div>
            <div>
              <div className="logo-ur">اردو PDF</div>
              <div className="logo-en">Urdu PDF Pro</div>
            </div>
          </div>
          {user && (
            <div className="user-pill">
              {user.email === ADMIN_EMAIL && (
                <button className="btn-admin" onClick={openAdmin} title="Admin Panel">
                  ⚙️ Admin
                </button>
              )}
              <img src={user.picture} alt="" className="user-av" />
              <span>{user.name.split(' ')[0]}</span>
              <button className="btn-logout" onClick={logout}>
                ↩ Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main">
        {!user ? (
          // Login Screen
          <div className="login-wrap">
            <div className="login-card">
              <span className="login-icon">📄</span>
              <h1>اردو PDF</h1>
              <p>PDF Convert اور Search کریں</p>
              <button className="btn-google" onClick={() => (window.location.href = `${API}/auth/google`)}>
                🔐 Google سے Login
              </button>
            </div>
          </div>
        ) : (
          // App Content
          <div className="app-container">
            {/* Mode Tabs */}
            <div className="mode-tabs">
              <button
                className={`tab ${mode === 'convert' ? 'active' : ''}`}
                onClick={() => setMode('convert')}
              >
                📄 Convert
              </button>
              <button
                className={`tab ${mode === 'search' ? 'active' : ''}`}
                onClick={() => setMode('search')}
              >
                🔍 Search
              </button>
              <button
                className={`tab ${mode === 'fiharis' ? 'active' : ''}`}
                onClick={() => setMode('fiharis')}
              >
                📋 فہارس
              </button>
              {user.email === ADMIN_EMAIL && (
                <button
                  className={`tab ${mode === 'dictionary' ? 'active' : ''}`}
                  onClick={() => { setMode('dictionary'); loadDict(); }}
                >
                  📖 لغت
                </button>
              )}
            </div>

            {/* Convert Tab */}
            {mode === 'convert' && (
              <section className="section">
                <h1>Convert to Word</h1>
                <p>PDF، Image یا Word file upload karo — clean Urdu Word file download karo</p>

                {!convertProgress && !convertUrl && (
                  <>
                    <div
                      className={`drop-zone ${dragOver ? 'drag' : ''} ${convertFile ? 'has-file' : ''}`}
                      onDrop={handleDrop}
                      onDragOver={e => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => !convertFile && convertFileRef.current.click()}
                    >
                      <input
                        ref={convertFileRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc"
                        onChange={e => {
                          const f = e.target.files[0];
                          if (f) {
                            setConvertFile(f);
                            setConvertError(null);
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      {convertFile ? (
                        <div className="file-info">
                          <span className="file-icon">📑</span>
                          <div>
                            <div className="file-name">{convertFile.name}</div>
                            <div className="file-size">
                              {(convertFile.size / 1024 / 1024).toFixed(1)} MB
                            </div>
                          </div>
                          <button
                            className="btn-remove"
                            onClick={e => {
                              e.stopPropagation();
                              resetConvert();
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="drop-prompt">
                          <span>📂</span>
                          <p>PDF، Word یا Image drop karo</p>
                          <small>ya click karke select karo (.pdf .docx .jpg .png)</small>
                        </div>
                      )}
                    </div>

                    {convertError && <div className="error-box">{convertError}</div>}

                    {convertFile && (
                      <button className="btn-primary" onClick={convert}>
                        🚀 Convert Karo
                      </button>
                    )}
                  </>
                )}

                {convertProgress && (
                  <div className="progress-card">
                    <div className="progress-header">
                      <div className="progress-info">
                        <span className="status-badge">{convertProgress.message}</span>
                        <span className="percent-display">{convertProgress.percent}%</span>
                      </div>
                      <div className="time-info">
                        <div className="time-item">
                          <span className="time-label">⏱️ Elapsed</span>
                          <span className="time-value">{formatTime(convertTime)}</span>
                        </div>
                        <div className="time-item">
                          <span className="time-label">⏳ Remaining</span>
                          <span className="time-value">
                            {formatTime(Math.round(getTimeRemaining(convertTime, convertProgress.percent)))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="progress-container">
                      <div className="progress-bar-outer">
                        <div
                          className="progress-bar-inner"
                          style={{ width: `${convertProgress.percent}%` }}
                        >
                          <span className="progress-label">{convertProgress.percent}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="progress-steps">
                      <div className={`step ${convertProgress.percent >= 10 ? 'done' : ''}`}>
                        <span>📄</span>
                        <small>Load PDF</small>
                      </div>
                      <div className={`step ${convertProgress.percent >= 45 ? 'done' : ''}`}>
                        <span>🖼️</span>
                        <small>Convert Pages</small>
                      </div>
                      <div className={`step ${convertProgress.percent >= 85 ? 'done' : ''}`}>
                        <span>🔤</span>
                        <small>OCR</small>
                      </div>
                      <div className={`step ${convertProgress.percent >= 95 ? 'done' : ''}`}>
                        <span>✍️</span>
                        <small>Build Doc</small>
                      </div>
                    </div>
                  </div>
                )}

                {convertUrl && (
                  <div className="success-card">
                    <span>✓</span>
                    <p>Conversion Complete!</p>
                    <a href={`${API}${convertUrl}`} className="btn-download" download>
                      ⬇️ Word File Download
                    </a>
                    <button className="btn-secondary" onClick={resetConvert}>
                      + Nayi File Convert
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Search Tab */}
            {mode === 'search' && (
              <section className="section">
                <h1>PDF mein Lafz Tholao</h1>
                <p>PDF upload karo aur lafz search karo</p>

                {!pdfId ? (
                  <>
                    <div
                      className={`drop-zone ${dragOver ? 'drag' : ''} ${searchFile ? 'has-file' : ''}`}
                      onDrop={handleDrop}
                      onDragOver={e => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => !searchFile && searchFileRef.current.click()}
                    >
                      <input
                        ref={searchFileRef}
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={e => {
                          const f = e.target.files[0];
                          if (f) setSearchFile(f);
                        }}
                        style={{ display: 'none' }}
                      />
                      {searchFile ? (
                        <div className="file-info">
                          <span className="file-icon">📑</span>
                          <div>
                            <div className="file-name">{searchFile.name}</div>
                            <div className="file-size">
                              {(searchFile.size / 1024 / 1024).toFixed(1)} MB
                            </div>
                          </div>
                          <button
                            className="btn-remove"
                            onClick={e => {
                              e.stopPropagation();
                              setSearchFile(null);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="drop-prompt">
                          <span>📂</span>
                          <p>PDF یا Word drop karo</p>
                          <small>ya click karke select karo (.pdf .docx)</small>
                        </div>
                      )}
                    </div>

                    {searchError && <div className="error-box">{searchError}</div>}

                    {searchFile && (
                      <button className="btn-primary" onClick={uploadForSearch}>
                        📤 PDF Upload کریں
                      </button>
                    )}

                    {searchProgress && (
                      <div className="progress-card">
                        <div className="progress-header">
                          <div className="progress-info">
                            <span className="status-badge">{searchProgress.message}</span>
                            <span className="percent-display">{searchProgress.percent}%</span>
                          </div>
                          <div className="time-info">
                            <div className="time-item">
                              <span className="time-label">⏱️ Elapsed</span>
                              <span className="time-value">{formatTime(searchTime)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="progress-container">
                          <div className="progress-bar-outer">
                            <div
                              className="progress-bar-inner"
                              style={{ width: `${searchProgress.percent}%` }}
                            >
                              <span className="progress-label">{searchProgress.percent}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="search-box">
                      <input
                        type="text"
                        className="search-input"
                        placeholder="lafz likhein..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && search()}
                      />
                      <button className="btn-primary" onClick={search} disabled={searching}>
                        {searching ? '⏳ Searching...' : '🔍 Search'}
                      </button>
                      <button className="btn-secondary" onClick={resetSearch}>
                        ↩ Back
                      </button>
                    </div>

                    {searchResults && (
                      <div className="results-card">
                        <div className="results-header">
                          <div>
                            <span className="results-title">"{searchResults.searchTerm}"</span>
                            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                              {searchResults.results.length} pages میں ملا • {searchResults.totalMatches} کل matches
                            </p>
                          </div>
                          {searchResults.results.length > 0 && (
                            <div className="download-buttons">
                              <button
                                className="btn-download"
                                onClick={downloadReport}
                                disabled={downloading !== null}
                                title="Detailed Word report (page numbers + snippets)"
                              >
                                {downloading === 'report' ? '⏳...' : '📋 Report'}
                              </button>
                              <button
                                className="btn-download"
                                onClick={downloadFilteredPdf}
                                disabled={downloading !== null}
                                title="PDF of only the matching pages"
                              >
                                {downloading === 'pdf' ? '⏳...' : '📄 Matching PDF'}
                              </button>
                            </div>
                          )}
                        </div>

                        {searchResults.results.length > 0 ? (
                          <div className="results-list">
                            {searchResults.results.map((r, i) => (
                              <div key={i} className="result-item">
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                  <span className="page-badge">📄 Page {r.pageNum}</span>
                                  <span className="match-count">{r.matchCount} بار</span>
                                </div>
                                <p className="snippet">{r.snippet}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="no-results">❌ Lafz nahi mila</div>
                        )}
                      </div>
                    )}

                    {searchError && <div className="error-box">{searchError}</div>}
                  </>
                )}
              </section>
            )}
            {/* فہارس Tab */}
            {mode === 'fiharis' && (
              <section className="section">
                <h1>فہارس بنائیں</h1>
                <p>PDF upload کریں — شخصیات، اماکن، کتابیں اور زبانوں کی فہرست خودبخود بنے گی</p>

                {/* Phase 1: Upload */}
                {!fiharisPdfId && (
                  <>
                    <div
                      className={`drop-zone ${dragOver ? 'drag' : ''} ${fiharisFile ? 'has-file' : ''}`}
                      onDrop={handleDrop}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => !fiharisFile && fiharisFileRef.current.click()}
                    >
                      <input
                        ref={fiharisFileRef}
                        type="file"
                        accept=".pdf,.docx,.doc"
                        onChange={e => { const f = e.target.files[0]; if (f) { setFiharisFile(f); setFiharisError(null); } }}
                        style={{ display: 'none' }}
                      />
                      {fiharisFile ? (
                        <div className="file-info">
                          <span className="file-icon">📑</span>
                          <div>
                            <div className="file-name">{fiharisFile.name}</div>
                            <div className="file-size">{(fiharisFile.size / 1024 / 1024).toFixed(1)} MB</div>
                          </div>
                          <button className="btn-remove" onClick={e => { e.stopPropagation(); setFiharisFile(null); }}>✕</button>
                        </div>
                      ) : (
                        <div className="drop-prompt">
                          <span>📂</span>
                          <p>اردو PDF یا Word drop کریں</p>
                          <small>یا click کر کے select کریں (.pdf .docx)</small>
                        </div>
                      )}
                    </div>

                    {fiharisError && <div className="error-box">{fiharisError}</div>}

                    {fiharisFile && !fiharisUploadProg && (
                      <button className="btn-primary" onClick={uploadForFiharis}>
                        📤 PDF Upload کریں
                      </button>
                    )}

                    {fiharisUploadProg && (
                      <div className="progress-card">
                        <div className="progress-header">
                          <div className="progress-info">
                            <span className="status-badge">{fiharisUploadProg.message}</span>
                            <span className="percent-display">{fiharisUploadProg.percent}%</span>
                          </div>
                          <div className="time-info">
                            <div className="time-item">
                              <span className="time-label">⏱️ Elapsed</span>
                              <span className="time-value">{formatTime(fiharisUploadTime)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="progress-container">
                          <div className="progress-bar-outer">
                            <div className="progress-bar-inner" style={{ width: `${fiharisUploadProg.percent}%` }}>
                              <span className="progress-label">{fiharisUploadProg.percent}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Phase 2: Generate */}
                {fiharisPdfId && !fiharisUrl && (
                  <>
                    <div className="fiharis-ready-card">
                      <div className="fiharis-ready-icon">✅</div>
                      <div>
                        <div className="fiharis-ready-title">PDF تیار ہے!</div>
                        <div className="fiharis-ready-sub">{fiharisFile?.name}</div>
                      </div>
                    </div>

                    {!fiharisGenProg && (
                      <>
                        {/* Mode chooser */}
                        <div className="fih-mode-row">
                          <button
                            className={`fih-mode-btn ${fiharisMode === 'auto' ? 'active' : ''}`}
                            onClick={() => setFiharisMode('auto')}
                          >
                            ⚡ خودکار (Auto)
                            <small>System خود ناموں کو پہچانے</small>
                          </button>
                          <button
                            className={`fih-mode-btn ${fiharisMode === 'custom' ? 'active' : ''}`}
                            onClick={() => setFiharisMode('custom')}
                          >
                            🎯 میری فہرست (100%)
                            <small>آپ نام دیں — exact صفحہ ملے</small>
                          </button>
                        </div>

                        {fiharisMode === 'custom' && (
                          <div className="fih-list-card">
                            <p className="fih-list-help">
                              جو نام/الفاظ آپ ڈھونڈنا چاہتے ہیں وہ یہاں ڈالیں (ہر لفظ نئی لائن پر)۔
                              Tool ہر اُس لفظ کو ہر صفحے پر 100% exact ڈھونڈ کے صفحہ نمبر دے گا۔
                            </p>
                            <div className="fih-list-cats">
                              {['شخصیات','اماکن','کتابیں','زبانیں'].map(c => {
                                const n = (fiharisList[c] || '').split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).length;
                                return (
                                  <button
                                    key={c}
                                    className={`fih-list-cat ${fiharisListCat === c ? 'active' : ''}`}
                                    onClick={() => setFiharisListCat(c)}
                                  >
                                    {c} {n > 0 && <span className="fih-list-badge">{n}</span>}
                                  </button>
                                );
                              })}
                            </div>
                            <textarea
                              className="fih-list-textarea"
                              dir="rtl"
                              rows={6}
                              value={fiharisList[fiharisListCat]}
                              onChange={e => setFiharisList(prev => ({ ...prev, [fiharisListCat]: e.target.value }))}
                              placeholder={fiharisListCat === 'شخصیات'
                                ? 'علامہ اقبال\nمرزا غالب\nسرسید احمد خان'
                                : fiharisListCat === 'اماکن'
                                ? 'لاہور\nکراچی\nدہلی'
                                : fiharisListCat === 'کتابیں'
                                ? 'قرآن مجید\nدیوان غالب'
                                : 'اردو\nعربی\nفارسی'}
                            />
                          </div>
                        )}

                        <button className="btn-primary fiharis-gen-btn" onClick={generateFiharis}>
                          📋 فہارس بنائیں
                        </button>
                      </>
                    )}

                    {fiharisError && <div className="error-box">{fiharisError}</div>}

                    {fiharisGenProg && (
                      <div className="progress-card">
                        <div className="progress-header">
                          <div className="progress-info">
                            <span className="status-badge">{fiharisGenProg.message}</span>
                            <span className="percent-display">{fiharisGenProg.percent}%</span>
                          </div>
                          <div className="time-info">
                            <div className="time-item">
                              <span className="time-label">⏱️ Elapsed</span>
                              <span className="time-value">{formatTime(fiharisGenTime)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="progress-container">
                          <div className="progress-bar-outer">
                            <div className="progress-bar-inner" style={{ width: `${fiharisGenProg.percent}%` }}>
                              <span className="progress-label">{fiharisGenProg.percent}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="progress-steps">
                          <div className={`step ${fiharisGenProg.percent >= 15 ? 'done' : ''}`}>
                            <span>📖</span><small>Load Pages</small>
                          </div>
                          <div className={`step ${fiharisGenProg.percent >= 50 ? 'done' : ''}`}>
                            <span>🔍</span><small>شخصیات</small>
                          </div>
                          <div className={`step ${fiharisGenProg.percent >= 75 ? 'done' : ''}`}>
                            <span>🗺️</span><small>اماکن</small>
                          </div>
                          <div className={`step ${fiharisGenProg.percent >= 90 ? 'done' : ''}`}>
                            <span>📝</span><small>Build Doc</small>
                          </div>
                        </div>
                      </div>
                    )}

                    <button className="btn-secondary" onClick={resetFiharis} style={{ marginTop: '12px' }}>
                      ↩ نئی PDF
                    </button>
                  </>
                )}

                {/* Phase 3: Done */}
                {fiharisUrl && (
                  <div className="fiharis-success-card">
                    <div className="fiharis-success-icon">📋</div>
                    <div className="fiharis-success-title">فہارس تیار ہے!</div>

                    {fiharisStats && (
                      <div className="fiharis-stats">
                        <div className="fiharis-stat">
                          <span className="fiharis-stat-num">{fiharisStats.شخصیات}</span>
                          <span className="fiharis-stat-label">شخصیات</span>
                        </div>
                        <div className="fiharis-stat">
                          <span className="fiharis-stat-num">{fiharisStats.اماکن}</span>
                          <span className="fiharis-stat-label">اماکن</span>
                        </div>
                        <div className="fiharis-stat">
                          <span className="fiharis-stat-num">{fiharisStats.کتابیں}</span>
                          <span className="fiharis-stat-label">کتابیں</span>
                        </div>
                        <div className="fiharis-stat">
                          <span className="fiharis-stat-num">{fiharisStats.زبانیں}</span>
                          <span className="fiharis-stat-label">زبانیں</span>
                        </div>
                      </div>
                    )}

                    <a href={`${API}${fiharisUrl}`} className="btn-download fiharis-dl-btn" download>
                      ⬇️ فہارس Download کریں (.docx)
                    </a>
                    <button className="btn-secondary" onClick={resetFiharis}>
                      + نئی PDF
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* Dictionary Tab */}
            {mode === 'dictionary' && user.email === ADMIN_EMAIL && (
              <section className="section">
                <h1>📖 لغت / Vocabulary</h1>
                <p>System ko sikhao kaunse alfaaz شخصیت، مقام، کتاب یا زبان hain — taake فہارس behtar bane</p>

                {/* Category selector */}
                <div className="dict-cats">
                  {['شخصیات','اماکن','کتابیں','زبانیں'].map(c => (
                    <button
                      key={c}
                      className={`dict-cat-btn ${dictCat === c ? 'active' : ''}`}
                      onClick={() => setDictCat(c)}
                    >
                      {c} <span className="dict-cat-count">{dictCounts[c] ?? 0}</span>
                    </button>
                  ))}
                </div>

                {/* Add by paste */}
                <div className="dict-add-card">
                  <label className="dict-label">
                    "{dictCat}" mein alfaaz add karo (har lafz nai line par ya comma se):
                  </label>
                  <textarea
                    className="dict-textarea"
                    value={dictText}
                    onChange={e => setDictText(e.target.value)}
                    placeholder={`مثال:\nعلامہ اقبال\nمرزا غالب\nسرسید احمد خان`}
                    dir="rtl"
                    rows={5}
                  />
                  <div className="dict-actions">
                    <button className="btn-primary" onClick={addDictText} disabled={dictBusy || !dictText.trim()}>
                      ➕ Add karo
                    </button>
                    <button className="btn-secondary" onClick={() => dictFileRef.current.click()} disabled={dictBusy}>
                      📂 File se import (.txt / Word)
                    </button>
                    <input
                      ref={dictFileRef}
                      type="file"
                      accept=".txt,.docx,.doc"
                      style={{ display: 'none' }}
                      onChange={e => { if (e.target.files[0]) uploadDictFile(e.target.files[0]); e.target.value=''; }}
                    />
                  </div>
                  {dictMsg && <div className="dict-msg">{dictMsg}</div>}
                  {dictBusy && <div className="dict-msg">⏳ Processing...</div>}
                </div>

                {/* Term list */}
                <div className="dict-list-card">
                  <div className="dict-list-hdr">
                    <h3>{dictCat} — {(dict[dictCat] || []).length} alfaaz</h3>
                    {(dict[dictCat] || []).length > 0 && (
                      <button className="dict-clear-btn" onClick={() => clearDictCat(dictCat)}>
                        🗑️ Sab clear karo
                      </button>
                    )}
                  </div>
                  <div className="dict-chips">
                    {(dict[dictCat] || []).length === 0 ? (
                      <div className="dict-empty">Abhi koi lafz nahi. Upar add karo ya file import karo.</div>
                    ) : (
                      (dict[dictCat] || []).map((term, i) => (
                        <span className="dict-chip" key={i} dir="rtl">
                          {term}
                          <button className="dict-chip-x" onClick={() => removeDictTerm(dictCat, term)}>✕</button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <span>© Urdu PDF Pro 2026</span> • <span>Made with ❤️</span>
      </footer>

      {/* ── Admin Panel Modal ── */}
      {adminMode && (
        <div className="admin-overlay" onClick={e => e.target === e.currentTarget && closeAdmin()}>
          <div className="admin-panel">
            <div className="admin-header">
              <h2>⚙️ Admin Dashboard</h2>
              <button className="admin-close" onClick={closeAdmin}>✕</button>
            </div>

            {adminLoading ? (
              <div className="admin-loading">Loading analytics...</div>
            ) : adminStats ? (
              <div className="admin-body">

                {/* Stat Cards */}
                <div className="admin-cards">
                  <div className="admin-card blue">
                    <div className="admin-card-icon">👥</div>
                    <div className="admin-card-num">{adminStats.totalUsers}</div>
                    <div className="admin-card-label">Total Users</div>
                  </div>
                  <div className="admin-card green">
                    <div className="admin-card-icon">📄</div>
                    <div className="admin-card-num">{adminStats.totalConverts}</div>
                    <div className="admin-card-label">Conversions</div>
                  </div>
                  <div className="admin-card purple">
                    <div className="admin-card-icon">🔍</div>
                    <div className="admin-card-num">{adminStats.totalSearches}</div>
                    <div className="admin-card-label">Searches</div>
                  </div>
                  <div className="admin-card orange">
                    <div className="admin-card-icon">📋</div>
                    <div className="admin-card-num">{adminStats.totalIndexes}</div>
                    <div className="admin-card-label">Indexes</div>
                  </div>
                </div>

                {/* Charts + Activity row */}
                <div className="admin-mid-row">
                  {/* 7-Day Bar Chart */}
                  <div className="admin-section admin-chart-box">
                    <h3>Last 7 Days Activity</h3>
                    <div className="admin-chart">
                      {adminStats.dailyStats.map((d, i) => {
                        const maxVal = Math.max(...adminStats.dailyStats.map(x => x.converts + x.searches + x.indexes), 1);
                        const total = d.converts + d.searches + d.indexes;
                        const height = Math.max(4, Math.round((total / maxVal) * 100));
                        const label = d.date.slice(5); // MM-DD
                        return (
                          <div className="admin-bar-col" key={i} title={`${label}: ${total} actions`}>
                            <div className="admin-bar-wrap">
                              <div className="admin-bar-stack" style={{ height: `${height}%` }}>
                                <div className="admin-bar-seg converts" style={{ flex: d.converts }} title={`Converts: ${d.converts}`} />
                                <div className="admin-bar-seg searches" style={{ flex: d.searches }} title={`Searches: ${d.searches}`} />
                                <div className="admin-bar-seg indexes"  style={{ flex: d.indexes  }} title={`Indexes: ${d.indexes}`} />
                              </div>
                            </div>
                            <div className="admin-bar-label">{label}</div>
                            <div className="admin-bar-num">{total}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="admin-chart-legend">
                      <span className="legend-dot converts" /> Converts
                      <span className="legend-dot searches" /> Searches
                      <span className="legend-dot indexes" />  Indexes
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="admin-section admin-activity-box">
                    <h3>Recent Activity</h3>
                    <div className="admin-activity-list">
                      {(adminActivity || []).slice(0, 20).map((a, i) => (
                        <div className="admin-act-item" key={i}>
                          <span className="admin-act-icon">{actIcon[a.type] || '•'}</span>
                          <div className="admin-act-body">
                            <div className="admin-act-name">{a.userName}</div>
                            <div className="admin-act-detail">{a.details || a.type}</div>
                          </div>
                          <div className="admin-act-time">{fmtAgo(a.timestamp)}</div>
                        </div>
                      ))}
                      {(!adminActivity || adminActivity.length === 0) && (
                        <div className="admin-empty">No activity yet</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* System Health */}
                <div className="admin-section admin-health">
                  <h3>System Health</h3>
                  <div className="admin-health-grid">
                    <div className="admin-health-item">
                      <span className="health-label">Uptime</span>
                      <span className="health-val green">{fmtUptime(adminStats.system.uptimeSeconds)}</span>
                    </div>
                    <div className="admin-health-item">
                      <span className="health-label">PDF Cache</span>
                      <span className="health-val blue">{adminStats.system.cacheSize} files</span>
                    </div>
                    <div className="admin-health-item">
                      <span className="health-label">Heap Memory</span>
                      <span className="health-val orange">{adminStats.system.memHeapMB} MB</span>
                    </div>
                    <div className="admin-health-item">
                      <span className="health-label">RSS Memory</span>
                      <span className="health-val purple">{adminStats.system.memRssMB} MB</span>
                    </div>
                    <div className="admin-health-item">
                      <span className="health-label">Node.js</span>
                      <span className="health-val">{adminStats.system.nodeVersion}</span>
                    </div>
                  </div>
                </div>

                {/* Users Table */}
                <div className="admin-section">
                  <div className="admin-section-hdr">
                    <h3>Users ({(adminUsers || []).length})</h3>
                    <button className="admin-refresh" onClick={loadAdmin}>↻ Refresh</button>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Email</th>
                          <th>Converts</th>
                          <th>Searches</th>
                          <th>Indexes</th>
                          <th>Last Active</th>
                          <th>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(adminUsers || []).map((u, i) => (
                          <tr key={u.id || i} className={i % 2 === 0 ? 'row-even' : ''}>
                            <td>
                              <div className="admin-user-cell">
                                {u.picture
                                  ? <img src={u.picture} alt="" className="admin-user-av" />
                                  : <div className="admin-user-av placeholder">{u.name?.[0] || '?'}</div>
                                }
                                <span className="admin-user-name">{u.name}</span>
                              </div>
                            </td>
                            <td className="admin-email">{u.email}</td>
                            <td className="admin-num">{u.converts || 0}</td>
                            <td className="admin-num">{u.searches || 0}</td>
                            <td className="admin-num">{u.indexes || 0}</td>
                            <td className="admin-time">{fmtAgo(u.lastSeen)}</td>
                            <td className="admin-time">{new Date(u.firstSeen).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {(!adminUsers || adminUsers.length === 0) && (
                          <tr><td colSpan="7" className="admin-empty">No users yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="admin-empty">Failed to load stats. Make sure you're logged in as admin.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
