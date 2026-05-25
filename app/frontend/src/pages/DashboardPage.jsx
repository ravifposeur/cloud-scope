import { useState, useEffect, useRef, useCallback } from 'react';
import { uploadImage, getTaskStatus } from '../api';

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

function statusBadge(status) {
  if (!status) return null;
  const map = { PENDING: 'pending', STARTED: 'started', SUCCESS: 'success', FAILURE: 'failure' };
  const cls = map[status] || 'pending';
  return <span className={`badge badge-${cls}`}>{status}</span>;
}

// ── Sub-components ─────────────────────────────────────────────

function UploadPanel({ onTaskCreated }) {
  const [file, setFile] = useState(null);
  const [project, setProject] = useState('DEFAULT');
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
      const res = await uploadImage(file, project.trim() || 'DEFAULT');
      onTaskCreated({ taskId: res.task_id, filename: file.name, operator: res.operator, project: project });
      setFile(null);
      setProject('DEFAULT');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1.25rem' }}>📤 Upload Image</h2>

      <form className="form-stack" onSubmit={submit}>
        {/* Drop zone */}
        <div
          className={`dropzone ${drag ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
          style={file ? { borderColor: 'var(--success)', background: 'var(--success-dim)' } : {}}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => !file && fileRef.current?.click()}
        >
          {!file ? (
            <>
              <div className="dropzone-icon">🧬</div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                Drag & drop your microscopy file
              </p>
              <p className="dropzone-hint">or click to browse</p>
              <p className="dropzone-hint">Supported: .czi .tif .tiff .lif .nd2 .png .jpg — max {MAX_MB} MB</p>
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED_EXT.join(',')}
                style={{ display: 'none' }}
                onChange={(e) => pick(e.target.files[0])}
              />
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontSize: '2rem' }}>✅</div>
              <p style={{ color: 'var(--success)', fontWeight: 600 }}>{file.name}</p>
              <p className="dropzone-hint">{fmtSize(file.size)}</p>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: '0.5rem', padding: '0.3rem 0.9rem', fontSize: '0.8rem' }}
                onClick={(e) => { e.stopPropagation(); setFile(null); setError(''); }}
              >
                Change file
              </button>
            </div>
          )}
        </div>

        {/* Project ID */}
        <div className="field-group">
          <label htmlFor="project-id">Project ID</label>
          <input
            id="project-id"
            className="input"
            type="text"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder="DEFAULT"
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button
          className="btn btn-primary btn-full"
          type="submit"
          disabled={!file || loading}
        >
          {loading
            ? <><span className="spinner" /> Uploading…</>
            : '🚀 Start Analysis'}
        </button>
      </form>
    </div>
  );
}

// ── Task Status Card ───────────────────────────────────────────

function TaskCard({ task, onRefresh }) {
  const { taskId, filename, status, result, error, progress, info, project } = task;

  return (
    <div className="task-row fade-in">
      <div className="task-row-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="task-filename">{filename}</span>
          {statusBadge(status)}
        </div>

        <div className="task-meta" style={{ marginTop: '0.3rem' }}>
          <span>Project: {project}</span>
          <span style={{ margin: '0 0.5rem', color: 'var(--bg-border)' }}>│</span>
          <span className="mono" style={{ fontSize: '0.72rem' }}>ID: {taskId}</span>
        </div>

        {/* Progress bar while running */}
        {(status === 'STARTED' || status === 'PENDING') && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {info?.status || 'Processing…'}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>
                {info?.progress || '…'}
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill animated"
                style={{ width: `${progressFromStatus(info) || 20}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'FAILURE' && error && (
          <div className="alert alert-error" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}

        {/* Results */}
        {status === 'SUCCESS' && result && (
          <div style={{ marginTop: '0.875rem' }}>
            <div className="result-grid">
              {result.result_csv_url && (
                <div className="result-item">
                  <div className="result-item-label">Results CSV</div>
                  <div className="result-item-value">
                    <a href={result.result_csv_url} target="_blank" rel="noreferrer" title={result.result_csv_url}>
                      📊 Download CSV
                    </a>
                  </div>
                </div>
              )}
              {result.safe_metadata_url && (
                <div className="result-item">
                  <div className="result-item-label">Safe Metadata</div>
                  <div className="result-item-value">
                    <a href={result.safe_metadata_url} target="_blank" rel="noreferrer" title={result.safe_metadata_url}>
                      📄 View JSON
                    </a>
                  </div>
                </div>
              )}
              {result.project_id && (
                <div className="result-item">
                  <div className="result-item-label">Project</div>
                  <div className="result-item-value">{result.project_id}</div>
                </div>
              )}
            </div>
            <div className="alert alert-success" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
              ✅ Analysis complete. Sensitive metadata has been scrubbed.
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="task-actions">
        {(status === 'PENDING' || status === 'STARTED') && (
          <button className="btn btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }} onClick={onRefresh}>
            ↻ Refresh
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────

export default function DashboardPage({ user, onLogout }) {
  const [tasks, setTasks] = useState([]);   // list of task objects
  const pollingRef = useRef({});            // { taskId: intervalId }

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
    }, 3000);  // every 3 seconds

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

  // Stats derived from task list
  const stats = {
    total: tasks.length,
    running: tasks.filter((t) => t.status === 'PENDING' || t.status === 'STARTED').length,
    success: tasks.filter((t) => t.status === 'SUCCESS').length,
    failed: tasks.filter((t) => t.status === 'FAILURE').length,
  };

  const initials = (user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="app-layout">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">🔬</span>
          CloudScope
        </div>
        <div className="navbar-user">
          <div className="user-pill">
            <div className="user-avatar">{initials}</div>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {user?.email || 'Researcher'}
            </span>
          </div>
          <button className="btn btn-ghost" style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }} onClick={onLogout}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Dashboard */}
      <div className="dashboard-grid">

        {/* Stats row */}
        <div className="panel-full stat-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Jobs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.running}</div>
            <div className="stat-label">Running</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.success}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>

        {/* Upload panel */}
        <UploadPanel onTaskCreated={onTaskCreated} />

        {/* How it works */}
        <div className="card">
          <h2 style={{ marginBottom: '1.25rem' }}>🧱 Analysis Pipeline</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {[
              { step: '01', icon: '📁', title: 'Upload', desc: 'File saved to secure temp storage. Task queued in Celery.' },
              { step: '02', icon: '🔄', title: 'Convert', desc: 'bfconvert transforms your file to OME-TIFF format.' },
              { step: '03', icon: '🧬', title: 'Fiji Analysis', desc: 'Headless Fiji runs the analysis macro and generates a CSV.' },
              { step: '04', icon: '🔒', title: 'Privacy Scrub', desc: 'Operator names & instrument serials removed. Raw metadata stripped.' },
              { step: '05', icon: '☁️', title: 'Store', desc: 'Clean results uploaded to MinIO. Links returned to you.' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{
                  background: 'var(--accent-subtle)',
                  border: '1px solid rgba(14,165,233,0.2)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.4rem',
                  flexShrink: 0,
                  marginTop: '0.15rem',
                }}>
                  {step}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    {icon} {title}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.15rem', lineHeight: 1.5 }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task history */}
        <div className="panel-full card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2>📋 Analysis Jobs</h2>
            {tasks.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {stats.running > 0 && '🟢 Auto-refreshing every 3s'}
              </span>
            )}
          </div>

          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧫</div>
              <p>No analysis jobs yet. Upload a microscopy image to get started.</p>
            </div>
          ) : (
            <div className="task-list">
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
