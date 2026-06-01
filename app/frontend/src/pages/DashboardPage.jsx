/**
 * DashboardPage — Main analysis dashboard.
 *
 * Features: file upload, task polling, status cards, analysis pipeline info.
 * Uses Tailwind CSS v4 utility classes with theme-aware tokens.
 *
 * @module pages/DashboardPage
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadImage, getTaskStatus } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// ── Helpers ────────────────────────────────────────────────────

const ALLOWED_EXT = ['.tif', '.tiff', '.czi', '.lif', '.nd2', '.png', '.jpg'];
const MAX_MB = 500;

function getExt(name) { return '.' + name.split('.').pop().toLowerCase(); }

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function progressFromStatus(info) {
  if (!info) return 0;
  const s = info.progress || '';
  const n = parseInt(s);
  return isNaN(n) ? 0 : n;
}

// Memotong localhost dan menggantinya dengan rute Nginx
function fixStorageUrl(url) {
  if (!url) return url;
  return url.replace('http://localhost:9000', '/storage');
}

/**
 * Status badge component.
 * @param {string} status - Task status
 * @returns {JSX.Element|null}
 */
function StatusBadge({ status }) {
  if (!status) return null;
  const styles = {
    PENDING: 'bg-warning-dim text-warning',
    STARTED: 'bg-accent-subtle text-accent',
    SUCCESS: 'bg-success-dim text-success',
    FAILURE: 'bg-danger-dim text-danger',
  };
  const cls = styles[status] || styles.PENDING;
  return (
    <span className={`rounded-full text-xs font-semibold tracking-wider py-0.5 px-2.5 uppercase ${cls}`}>
      {status}
    </span>
  );
}

// ── SVG Icons ──────────────────────────────────────────────────

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// ── Upload Panel ───────────────────────────────────────────────

function UploadPanel({ onTaskCreated }) {
  const [file, setFile] = useState(null);
  const [project, setProject] = useState('DEFAULT');
  const [macro, setMacro] = useState('DEFAULT'); // 👇 State baru untuk makro
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fileRef = useRef();

  const validate = (f) => {
    const ext = getExt(f.name);
    if (!ALLOWED_EXT.includes(ext)) {
      setError(`Unsupported format "${ext}". Allowed: ${ALLOWED_EXT.join(', ')}`);
      return false;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_MB} MB limit.`);
      return false;
    }
    setError('');
    return true;
  };

  const pick = (f) => { if (f && validate(f)) setFile(f); };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) pick(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      // 👇 Mengirimkan string project dan opsi macro ke fungsi API
      const res = await uploadImage(file, project.trim() || 'DEFAULT', macro);
      onTaskCreated({ 
        taskId: res.task_id, 
        filename: file.name, 
        operator: res.operator, 
        project: project.trim() || 'DEFAULT',
        macro: macro 
      });
      setFile(null);
      setProject('DEFAULT');
      setMacro('DEFAULT');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-bg-border rounded-2xl p-8 shadow-[var(--cs-shadow-md)]">
      <h2 className="text-[1.375rem] font-semibold tracking-tight mb-5">Upload Image</h2>

      <form className="flex flex-col gap-4" onSubmit={submit}>
        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-2xl cursor-pointer py-12 px-8 text-center transition-all duration-200 relative
            ${drag ? 'border-accent bg-accent-subtle' : 'border-bg-border'}
            ${file ? 'border-success bg-success-dim' : ''}
            ${!file && !drag ? 'hover:border-accent hover:bg-accent-subtle' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => !file && fileRef.current?.click()}
        >
          {!file ? (
            <>
              <div className="text-[2.5rem] mb-3">🔬</div>
              <p className="text-txt font-medium">
                Drag & drop your microscopy file
              </p>
              <p className="text-txt-muted text-[0.8125rem] mt-2">or click to browse</p>
              <p className="text-txt-muted text-[0.8125rem] mt-1">Supported: .czi .tif .tiff .lif .nd2 .png .jpg — max {MAX_MB} MB</p>
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED_EXT.join(',')}
                className="hidden"
                onChange={(e) => pick(e.target.files[0])}
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="text-[2rem]">✅</div>
              <p className="text-success font-semibold">{file.name}</p>
              <p className="text-txt-muted text-[0.8125rem]">{fmtSize(file.size)}</p>
              <button
                type="button"
                className="mt-2 py-1 px-3.5 text-[0.8rem] bg-transparent border border-bg-border text-txt-secondary
                  rounded-md transition-all duration-200 hover:border-accent hover:text-accent"
                onClick={(e) => { e.stopPropagation(); setFile(null); setError(''); }}
              >
                Change file
              </button>
            </div>
          )}
        </div>

        {/* Group Input: Project ID & Macro Type (Dibuat berdampingan/seiras) */}
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          {/* Project ID (Text Input) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="project-id" className="text-[0.8125rem] font-medium text-txt-secondary tracking-wide uppercase">
              Project ID string
            </label>
            <input
              id="project-id"
              className="bg-bg-base border border-bg-border rounded-md text-txt font-sans text-[0.9375rem]
                py-2.5 px-3.5 outline-none w-full transition-all duration-200
                focus:border-accent focus:ring-[3px] focus:ring-accent-glow placeholder:text-txt-muted"
              type="text"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="DEFAULT"
            />
          </div>

          {/* Macro Selection (Dropdown Berwarna Sama) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="macro-type" className="text-[0.8125rem] font-medium text-txt-secondary tracking-wide uppercase">
              Analysis Method (Macro)
            </label>
            <div className="relative w-full">
              <select
                id="macro-type"
                className="bg-bg-base border border-bg-border rounded-md text-txt font-sans text-[0.9375rem]
                  py-2.5 pl-3.5 pr-10 outline-none w-full transition-all duration-200
                  focus:border-accent focus:ring-[3px] focus:ring-accent-glow appearance-none cursor-pointer"
                value={macro}
                onChange={(e) => setMacro(e.target.value)}
              >
                <option value="DEFAULT">Standard Analysis</option>
                <option value="PROJECT_CELLCOUNT">Cell Counting</option>
                <option value="PROJECT_EDGEDETECT">Edge Detection</option>
              </select>
              {/* Custom SVG Chevron Arrow untuk Dropdown */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-txt-muted">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md text-sm py-3 px-4 bg-danger-dim text-danger border border-danger/25">
            {error}
          </div>
        )}

        <button
          className="inline-flex items-center justify-center gap-2 border-none rounded-md text-[0.9375rem]
            font-semibold py-2.5 px-6 transition-all duration-200 whitespace-nowrap w-full
            bg-accent text-white cursor-pointer
            hover:bg-accent-dim hover:shadow-[var(--cs-glow)] hover:-translate-y-px
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          type="submit"
          disabled={!file || loading}
        >
          {loading
            ? <><span className="inline-block w-[18px] h-[18px] border-2 border-bg-border border-t-accent rounded-full animate-spin" /> Uploading…</>
            : 'Start Analysis'}
        </button>
      </form>
    </div>
  );
}

// ── Task Status Card ───────────────────────────────────────────

function TaskCard({ task, onRefresh }) {
  const { taskId, filename, status, result, error, info, project } = task;

  return (
    <div className="flex items-start gap-4 bg-elevated border border-bg-border rounded-[10px] p-4 transition-colors duration-200 hover:border-accent fade-in">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-txt font-medium overflow-hidden text-ellipsis whitespace-nowrap">{filename}</span>
          <StatusBadge status={status} />
        </div>

        <div className="text-txt-muted text-[0.78rem] font-mono mt-1">
          <span>Project: {project}</span>
          <span className="mx-2 text-bg-border">│</span>
          <span className="text-[0.72rem]">ID: {taskId}</span>
        </div>

        {/* Progress bar while running */}
        {(status === 'STARTED' || status === 'PENDING') && (
          <div className="mt-3">
            <div className="flex justify-between mb-1">
              <span className="text-[0.78rem] text-txt-muted">
                {info?.status || 'Processing…'}
              </span>
              <span className="text-[0.78rem] text-accent">
                {info?.progress || '…'}
              </span>
            </div>
            <div className="bg-bg-border rounded-full h-1.5 overflow-hidden w-full">
              <div
                className="bg-gradient-to-r from-accent to-sky-400 rounded-full h-full transition-[width] duration-500 progress-animated"
                style={{ width: `${progressFromStatus(info) || 20}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'FAILURE' && error && (
          <div className="mt-3 rounded-md text-[0.8rem] py-3 px-4 bg-danger-dim text-danger border border-danger/25">
            {error}
          </div>
        )}

        {/* Results */}
        {status === 'SUCCESS' && result && (
          <div className="mt-3.5">
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              {result.result_csv_url && (
                <div className="bg-bg-base border border-bg-border rounded-md py-3 px-4">
                  <div className="text-txt-muted text-xs font-medium tracking-wider uppercase">Results CSV</div>
                  <div className="text-txt font-mono text-sm mt-0.5 break-all">
                    {/* 👇 BUNGKUS DENGAN fixStorageUrl */}
                    <a href={fixStorageUrl(result.result_csv_url)} target="_blank" rel="noreferrer" title={result.result_csv_url}>
                      📊 Download CSV
                    </a>
                  </div>
                </div>
              )}
              {result.safe_metadata_url && (
                <div className="bg-bg-base border border-bg-border rounded-md py-3 px-4">
                  <div className="text-txt-muted text-xs font-medium tracking-wider uppercase">Safe Metadata</div>
                  <div className="text-txt font-mono text-sm mt-0.5 break-all">
                    {/* 👇 BUNGKUS DENGAN fixStorageUrl */}
                    <a href={fixStorageUrl(result.safe_metadata_url)} target="_blank" rel="noreferrer" title={result.safe_metadata_url}>
                      📄 View JSON
                    </a>
                  </div>
                </div>
              )}
              {result.project_id && (
                <div className="bg-bg-base border border-bg-border rounded-md py-3 px-4">
                  <div className="text-txt-muted text-xs font-medium tracking-wider uppercase">Project</div>
                  <div className="text-txt font-mono text-sm mt-0.5 break-all">{result.project_id}</div>
                </div>
              )}
            </div>
            <div className="mt-3 rounded-md text-[0.8rem] py-3 px-4 bg-success-dim text-success border border-success/25">
              ✅ Analysis complete. Sensitive metadata has been scrubbed.
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        {(status === 'PENDING' || status === 'STARTED') && (
          <button
            className="py-1.5 px-3 text-[0.82rem] bg-transparent border border-bg-border text-txt-secondary
              rounded-md transition-all duration-200 hover:border-accent hover:text-accent cursor-pointer"
            onClick={onRefresh}
          >
            ↻ Refresh
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const pollingRef = useRef({});

  // Poll a single task until terminal
  const startPolling = useCallback((taskId) => {
    if (pollingRef.current[taskId]) return;

    const interval = setInterval(async () => {
      try {
        const data = await getTaskStatus(taskId);
        setTasks((prev) =>
          prev.map((t) =>
            t.taskId === taskId
              ? {
                ...t,
                status: data.status,
                result: data.result,
                error: data.error,
                info: data.status === 'STARTED' ? data.result : t.info,
              }
              : t
          )
        );

        // Stop polling on terminal state
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
          clearInterval(pollingRef.current[taskId]);
          delete pollingRef.current[taskId];
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 3000);

    pollingRef.current[taskId] = interval;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => Object.values(pollingRef.current).forEach(clearInterval);
  }, []);

  const onTaskCreated = ({ taskId, filename, operator, project }) => {
    const newTask = {
      taskId,
      filename,
      operator,
      project,
      status: 'PENDING',
      result: null,
      error: null,
      info: null,
    };
    setTasks((prev) => [newTask, ...prev]);
    startPolling(taskId);
  };

  const manualRefresh = async (taskId) => {
    try {
      const data = await getTaskStatus(taskId);
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === taskId
            ? { ...t, status: data.status, result: data.result, error: data.error, info: data.result }
            : t
        )
      );
      if (data.status !== 'SUCCESS' && data.status !== 'FAILURE') {
        startPolling(taskId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Stats derived from task list
  const stats = {
    total: tasks.length,
    running: tasks.filter((t) => t.status === 'PENDING' || t.status === 'STARTED').length,
    success: tasks.filter((t) => t.status === 'SUCCESS').length,
    failed: tasks.filter((t) => t.status === 'FAILURE').length,
  };

  const initials = (user?.email || user?.name || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr] mt-16">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 w-full flex items-center justify-between gap-4 bg-surface border-b border-bg-border h-[60px] px-8 max-sm:px-4">
        <div className="flex items-center gap-2.5 text-txt font-bold text-lg tracking-tight">
          <img src="/favicon.svg" alt="CloudScope" className="w-7 h-7 rounded-md" />
          CloudScope
        </div>

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-transparent border border-bg-border text-txt-secondary
              transition-all duration-200 hover:border-accent hover:text-accent cursor-pointer"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            id="theme-toggle-btn"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* User pill */}
          <div className="flex items-center gap-2 bg-elevated border border-bg-border rounded-full py-1.5 pr-3.5 pl-2">
            <div className="flex items-center justify-center bg-accent-glow border-[1.5px] border-accent
              rounded-full text-accent text-xs font-bold w-7 h-7">
              {initials}
            </div>
            <span className="text-sm text-txt-secondary max-sm:hidden">
              {user?.name || user?.email || 'Researcher'}
            </span>
          </div>

          {/* Sign out */}
          <button
            className="py-1.5 px-3.5 text-[0.85rem] bg-transparent border border-bg-border text-txt-secondary
              rounded-md transition-all duration-200 hover:border-accent hover:text-accent cursor-pointer"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Dashboard Grid ── */}
      <div className="grid grid-cols-2 gap-6 max-w-[1100px] mx-auto p-8 max-md:grid-cols-1 max-md:p-4">

        {/* Stats row */}
        <div className="col-span-full grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
          <div className="bg-elevated border border-bg-border rounded-[10px] py-5 px-6">
            <div className="text-[1.75rem] font-bold text-txt leading-none">{stats.total}</div>
            <div className="text-txt-muted text-[0.78rem] font-medium tracking-wider mt-1 uppercase">Total Jobs</div>
          </div>
          <div className="bg-elevated border border-bg-border rounded-[10px] py-5 px-6">
            <div className="text-[1.75rem] font-bold text-accent leading-none">{stats.running}</div>
            <div className="text-txt-muted text-[0.78rem] font-medium tracking-wider mt-1 uppercase">Running</div>
          </div>
          <div className="bg-elevated border border-bg-border rounded-[10px] py-5 px-6">
            <div className="text-[1.75rem] font-bold text-success leading-none">{stats.success}</div>
            <div className="text-txt-muted text-[0.78rem] font-medium tracking-wider mt-1 uppercase">Completed</div>
          </div>
          <div className="bg-elevated border border-bg-border rounded-[10px] py-5 px-6">
            <div className="text-[1.75rem] font-bold text-danger leading-none">{stats.failed}</div>
            <div className="text-txt-muted text-[0.78rem] font-medium tracking-wider mt-1 uppercase">Failed</div>
          </div>
        </div>

        {/* Upload panel */}
        <UploadPanel onTaskCreated={onTaskCreated} />

        {/* How it works */}
        <div className="bg-surface border border-bg-border rounded-2xl p-8 shadow-[var(--cs-shadow-md)]">
          <h2 className="text-[1.375rem] font-semibold tracking-tight mb-5">Analysis Pipeline</h2>
          <div className="flex flex-col gap-3.5">
            {[
              { step: '01', title: 'Upload', desc: 'File saved to secure temp storage. Task queued in Celery.' },
              { step: '02', title: 'Convert', desc: 'bfconvert transforms your file to OME-TIFF format.' },
              { step: '03', title: 'Fiji Analysis', desc: 'Headless Fiji runs the analysis macro and generates a CSV.' },
              { step: '04', title: 'Privacy Scrub', desc: 'Operator names & instrument serials removed. Raw metadata stripped.' },
              { step: '05', title: 'Store', desc: 'Clean results uploaded to MinIO. Links returned to you.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 items-start">
                <div className="bg-accent-subtle border border-accent/20 rounded-md text-accent
                  font-mono text-sm font-semibold py-0.5 px-1.5 shrink-0 mt-0.5">
                  {step}
                </div>
                <div>
                  <div className="font-semibold text-txt text-lg">
                    {title}
                  </div>
                  <div className="text-txt-muted text-sm mt-0.5 leading-relaxed">
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task history */}
        <div className="col-span-full bg-surface border border-bg-border rounded-2xl p-8 shadow-[var(--cs-shadow-md)]">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-[1.375rem] font-semibold tracking-tight">Analysis Jobs</h2>
            {tasks.length > 0 && (
              <span className="text-[0.8rem] text-txt-muted">
                {stats.running > 0 && '🟢 Auto-refreshing every 3s'}
              </span>
            )}
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-12 text-txt-muted">
              <div className="text-[2.5rem] mb-3">🧫</div>
              <p>No analysis jobs yet. Upload a microscopy image to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.taskId}
                  task={task}
                  onRefresh={() => manualRefresh(task.taskId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
