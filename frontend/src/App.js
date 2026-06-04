import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API = 'http://localhost:5000';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const esRef = useRef();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('login')) window.history.replaceState({}, '', '/');
    axios.get(`${API}/auth/user`, { withCredentials: true })
      .then(r => setUser(r.data.loggedIn ? r.data.user : null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    setUser(null); reset();
  };

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    const ok = ['application/pdf','image/jpeg','image/jpg','image/png','image/webp'];
    if (ok.includes(f?.type)) { setFile(f); setError(null); }
    else setError('Sirf PDF, JPG ya PNG upload karo');
  }, []);

  const handleFile = e => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(null); setDownloadUrl(null); setProgress(null); }
  };

  const convert = async () => {
    if (!file) return;
    setError(null); setDownloadUrl(null);
    setProgress({ step: 1, percent: 0, message: 'Shuru ho raha hai...', status: 'processing' });
    const fd = new FormData(); fd.append('pdf', file);
    try {
      const { data } = await axios.post(`${API}/api/convert`, fd, { withCredentials: true });
      if (esRef.current) esRef.current.close();
      const es = new EventSource(`${API}/api/progress/${data.jobId}`);
      esRef.current = es;
      es.onmessage = e => {
        const d = JSON.parse(e.data);
        setProgress(d);
        if (d.status === 'done') { setDownloadUrl(d.downloadUrl); es.close(); }
        if (d.status === 'error') { setError(d.message); es.close(); }
      };
      es.onerror = () => es.close();
    } catch (e) {
      setError(e.response?.data?.error || 'Kuch masla aaya, dobara try karo');
      setProgress(null);
    }
  };

  const reset = () => {
    setFile(null); setProgress(null); setDownloadUrl(null); setError(null);
    if (esRef.current) esRef.current.close();
  };

  const fmtSize = b => b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

  const steps = [
    { num: 1, icon: '📄', label: 'PDF Load' },
    { num: 2, icon: '🖼️', label: 'Images' },
    { num: 3, icon: '🔍', label: 'OCR' },
    { num: 4, icon: '📝', label: 'Word File' },
  ];

  if (loading) return (
    <div className="splash">
      <div className="splash-logo">
        <span className="splash-icon">📄</span>
        <div className="splash-bar"><div className="splash-fill" /></div>
      </div>
    </div>
  );

  return (
    <div className="app">
      <div className="bg-gradient" />
      <div className="bg-dots" />

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-badge">
              <span>📄</span>
            </div>
            <div>
              <div className="logo-ur">اردو PDF کنورٹر</div>
              <div className="logo-en">Urdu PDF Converter</div>
            </div>
          </div>
          {user && (
            <div className="user-pill">
              <img src={user.picture} alt="" className="user-av" />
              <span className="user-nm">{user.name.split(' ')[0]}</span>
              <button className="btn-out" onClick={logout}>↩ Logout</button>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        {!user ? (
          /* ── Login ── */
          <div className="login-wrap">
            <div className="login-card">
              <div className="login-glow" />
              <div className="login-icon-wrap">
                <span className="login-main-icon">📄</span>
                <div className="login-badge-ring" />
              </div>
              <h1 className="login-title">اردو PDF کنورٹر</h1>
              <p className="login-sub">PDF فائل کو قابلِ ترمیم Word میں تبدیل کریں</p>
              <p className="login-sub-en">Convert Urdu PDF to editable Word file instantly</p>

              <div className="feat-grid">
                {[
                  ['⚡','Fast Conversion'],
                  ['🔍','Google OCR'],
                  ['📖','1000 Pages'],
                  ['🔒','Your Drive'],
                ].map(([ic, lb]) => (
                  <div className="feat-chip" key={lb}>
                    <span>{ic}</span><span>{lb}</span>
                  </div>
                ))}
              </div>

              <button className="btn-google" onClick={() => window.location.href = `${API}/auth/google`}>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path d="M47.5 24.5c0-1.6-.1-3.2-.4-4.8H24v9.1h13.2c-.6 3-2.3 5.6-5 7.3v6h8c4.8-4.4 7.3-10.9 7.3-17.6z" fill="#4285F4"/>
                  <path d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-8-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.1 0-11.2-4.1-13-9.5H3v6.2C6.9 42.7 15 48 24 48z" fill="#34A853"/>
                  <path d="M11 28.9c-.5-1.4-.7-2.9-.7-4.4s.2-3 .7-4.4v-6.2H3C1.1 17.5 0 20.6 0 24s1.1 6.5 3 8.9l8-3.1z" fill="#FBBC05"/>
                  <path d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.5 30.5 0 24 0 15 0 6.9 5.3 3 13.1l8 6.2C12.8 13.6 17.9 9.5 24 9.5z" fill="#EA4335"/>
                </svg>
                Google se Login Karo
              </button>
              <p className="login-note">🔒 Aapka data sirf aapke Google Drive mein — kisi ke saath share nahi hoga</p>
            </div>
          </div>
        ) : (
          /* ── Converter ── */
          <div className="conv-wrap">
            <div className="conv-hero">
              <h1 className="conv-title">PDF → Word Convert Karo</h1>
              <p className="conv-sub">Urdu PDF upload karo — editable Word file milegi</p>
            </div>

            {!progress && !downloadUrl && (
              <div className="conv-body">
                {/* Drop Zone */}
                <div
                  className={`drop ${dragOver ? 'drag' : ''} ${file ? 'has-file' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => !file && fileRef.current.click()}
                >
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFile} style={{ display: 'none' }} />
                  {file ? (
                    <div className="file-row">
                      <div className="file-ic">
                        {file.type === 'application/pdf' ? '📑' : '🖼️'}
                      </div>
                      <div className="file-meta">
                        <div className="file-nm">{file.name}</div>
                        <div className="file-sz">{fmtSize(file.size)}</div>
                      </div>
                      <button className="file-rm" onClick={e => { e.stopPropagation(); reset(); }}>✕</button>
                    </div>
                  ) : (
                    <div className="drop-inner">
                      <div className="drop-anim">
                        <div className="drop-circle c1" />
                        <div className="drop-circle c2" />
                        <div className="drop-circle c3" />
                        <span className="drop-main-ic">📂</span>
                      </div>
                      <div className="drop-txt">Yahan PDF ya Image drop karo</div>
                      <div className="drop-st">ya click karke select karo</div>
                      <div className="drop-chips">
                        <span className="chip">PDF</span>
                        <span className="chip">JPG</span>
                        <span className="chip">PNG</span>
                        <span className="chip">Max 500MB</span>
                        <span className="chip">1000 Pages</span>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="err-box">
                    <span>⚠️</span> {error}
                  </div>
                )}

                {file && (
                  <button className="btn-conv" onClick={convert}>
                    <span className="btn-conv-ic">🚀</span>
                    Convert Karo
                    <span className="btn-conv-arr">→</span>
                  </button>
                )}

                {/* How it works */}
                <div className="how-card">
                  <div className="how-title">⚡ Kaise kaam karta hai?</div>
                  <div className="how-steps">
                    {[
                      ['📄','PDF upload karo (1000 pages tak)'],
                      ['🖼️','Har page image mein convert hota hai'],
                      ['🔍','Google Drive OCR se Urdu text nikalti hai'],
                      ['📝','Editable Word file (.docx) download karo'],
                    ].map(([ic, txt], i) => (
                      <div className="how-step" key={i}>
                        <div className="how-num">{i+1}</div>
                        <div className="how-ic">{ic}</div>
                        <div className="how-txt">{txt}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Progress */}
            {progress?.status === 'processing' && (
              <div className="prog-card">
                <div className="prog-header">
                  <div className="prog-spinner" />
                  <div className="prog-htxt">Processing ho raha hai...</div>
                </div>

                <div className="prog-steps">
                  {steps.map(s => {
                    const st = progress.step > s.num ? 'done' : progress.step === s.num ? 'active' : 'wait';
                    return (
                      <div key={s.num} className={`pstep ${st}`}>
                        <div className="pstep-dot">
                          {st === 'done' ? '✓' : s.icon}
                        </div>
                        <div className="pstep-lbl">{s.label}</div>
                      </div>
                    );
                  })}
                  <div className="pstep-line">
                    <div className="pstep-fill" style={{ width: `${((progress.step - 1) / 3) * 100}%` }} />
                  </div>
                </div>

                <div className="prog-bar-wrap">
                  <div className="prog-bar" style={{ width: `${progress.percent}%` }} />
                </div>
                <div className="prog-info">
                  <span className="prog-pct">{progress.percent}%</span>
                  <span className="prog-msg">{progress.message}</span>
                </div>
                <div className="prog-note">⏳ Page band mat karna — processing chal rahi hai</div>
              </div>
            )}

            {/* Done */}
            {downloadUrl && (
              <div className="done-card">
                <div className="done-confetti">🎉</div>
                <div className="done-check">✓</div>
                <div className="done-title">Conversion Complete!</div>
                <div className="done-sub">Aapki Word file ready hai — ab edit kar sakte ho</div>
                <a href={`${API}${downloadUrl}`} className="btn-dl" download>
                  <span>⬇️</span> Word File Download Karo (.docx)
                </a>
                <button className="btn-new" onClick={reset}>
                  + Nayi File Convert Karo
                </button>
              </div>
            )}

            {error && progress?.status === 'error' && (
              <div className="err-card">
                <div className="err-ic">❌</div>
                <div className="err-msg">{error}</div>
                <button className="btn-retry" onClick={reset}>↩ Dobara Karo</button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <span>اردو PDF کنورٹر</span> • <span>Google Drive OCR</span> • <span>Made with ❤️</span>
      </footer>
    </div>
  );
}
