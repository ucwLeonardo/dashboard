import React, { useEffect, useState } from 'react';
import './App.css';
import { getCourseIdentity } from './courseIdentity';
import { getCertIdentity } from './certIdentity';

interface Course {
  title: string;
  url: string;
  price: string;
}

interface Section {
  title: string;
  count: number;
  courses: Course[];
}

interface RegionData {
  sections: Section[];
  total: number;
}

interface DiffResult {
  added: Course[];
  removed: Course[];
}

interface ChangeEntry {
  timestamp: string;
  hq: DiffResult;
  china: DiffResult;
}

interface Stats {
  timestamp: string;
  changesHistory?: ChangeEntry[];
  current: {
    hq: RegionData;
    china: RegionData;
  };
  previous?: {
    hq: RegionData;
    china: RegionData;
  };
}

// Certification types
interface Certification {
  title: string;
  level: string;
  description: string;
  price: string;
  duration: string;
  code: string;
  url: string;
}

interface CertSection {
  title: string;
  count: number;
  certifications: Certification[];
}

interface CertChange {
  cert: Certification;
  changes: string;
}

interface CertDiffResult {
  added: Certification[];
  removed: Certification[];
  changed: CertChange[];
}

interface CertChangeEntry {
  timestamp: string;
  diff: CertDiffResult;
}

interface CertStats {
  timestamp: string;
  current: {
    sections: CertSection[];
    total: number;
  };
  changesHistory?: CertChangeEntry[];
}

const certSectionsOrder = [
  'AI Infrastructure',
  'Data Science',
  'Generative AI',
  'Simulation and Physical AI',
];

const App: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [certStats, setCertStats] = useState<CertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const genresOrder = [
    'Generative AI/LLM',
    'Deep Learning',
    'Accelerated Computing',
    'Simulation and Physical AI',
    'Data Science'
  ];


  const chinaOrder = [
    '生成式 AI/大语言模型',
    '深度学习',
    '加速计算',
    '图形与仿真',
    '数据科学'
  ];

  const getSortedChina = (sections: Section[]) => {
    return chinaOrder.map(title => {
      const section = sections.find(s => s.title === title);
      return section || { title, count: 0, courses: [] };
    });
  };

  const getHQLikeChina = (hqSections: Section[]) => {
    return genresOrder.map(genre => {
      const section = hqSections.find(s => s.title === genre);
      return section || { title: genre, count: 0, courses: [] };
    });
  };

  const getAccumulatedDiff = (history: ChangeEntry[] | undefined, region: 'hq' | 'china') => {
    if (!history || history.length === 0) return { added: [], removed: [], delta: 0 };
    const allAdded = history.flatMap(e => e[region].added);
    const allRemoved = history.flatMap(e => e[region].removed);
    // Net effect: added but not subsequently removed
    const netAdded = allAdded
      .filter(a => !allRemoved.find(r => getCourseIdentity(r) === getCourseIdentity(a)))
      .filter((a, i, arr) => arr.findIndex(x => getCourseIdentity(x) === getCourseIdentity(a)) === i);
    const netRemoved = allRemoved
      .filter(r => !allAdded.find(a => getCourseIdentity(a) === getCourseIdentity(r)))
      .filter((r, i, arr) => arr.findIndex(x => getCourseIdentity(x) === getCourseIdentity(r)) === i);
    return { added: netAdded, removed: netRemoved, delta: netAdded.length - netRemoved.length };
  };

  const getAccumulatedCertDiff = (history: CertChangeEntry[] | undefined) => {
    if (!history || history.length === 0) return { added: [], removed: [], changed: [], delta: 0 };
    const allAdded = history.flatMap(e => e.diff.added);
    const allRemoved = history.flatMap(e => e.diff.removed);
    const allChanged = history.flatMap(e => e.diff.changed);
    const netAdded = allAdded
      .filter(a => !allRemoved.find(r => getCertIdentity(r) === getCertIdentity(a)))
      .filter((a, i, arr) => arr.findIndex(x => getCertIdentity(x) === getCertIdentity(a)) === i);
    const netRemoved = allRemoved
      .filter(r => !allAdded.find(a => getCertIdentity(a) === getCertIdentity(r)))
      .filter((r, i, arr) => arr.findIndex(x => getCertIdentity(x) === getCertIdentity(r)) === i);
    // Keep latest change per cert
    const latestChanged = allChanged
      .filter((c, i, arr) => arr.findIndex(x => getCertIdentity(x.cert) === getCertIdentity(c.cert)) === i);
    return { added: netAdded, removed: netRemoved, changed: latestChanged, delta: netAdded.length - netRemoved.length };
  };

  useEffect(() => {
    // In production (GitHub Pages), fetch the static JSON file.
    // In development, use the API proxy.
    const statsUrl = import.meta.env.PROD ? './data/stats.json' : '/api/stats';
    const certUrl = import.meta.env.PROD ? './data/certifications.json' : '/api/certifications';

    Promise.all([
      fetch(statsUrl).then(res => res.json()),
      fetch(certUrl).then(res => res.json()).catch(() => null),
    ])
      .then(([statsData, certData]) => {
        setStats(statsData);
        if (certData?.current?.sections) setCertStats(certData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load stats', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading"><span className="loading-text">加载中...</span></div>;

  const hqDiff = getAccumulatedDiff(stats?.changesHistory, 'hq');
  const chinaDiff = getAccumulatedDiff(stats?.changesHistory, 'china');
  const certDiff = getAccumulatedCertDiff(certStats?.changesHistory);

  return (
    <div className="container">
      <div className="bg-gradient" aria-hidden="true" />
      <div className="theme-controls">
        <button
          className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
          onClick={() => setTheme('light')}
        >
          Light
        </button>
        <button
          className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
          onClick={() => setTheme('dark')}
        >
          Dark
        </button>
      </div>

      <div className="dashboard">
        <header className="dashboard-header">
          <h1>DLI Dashboard</h1>
          <p className="update-time">Last Update: {stats ? new Date(stats.timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }) : 'Unknown'}</p>
        </header>

        <main className="cards-container">
          {/* HQ Card */}
          <div className="card-wrapper">
            <a href="https://www.nvidia.com/en-us/training/self-paced-courses/" target="_blank" rel="noreferrer" className="card-link">
              <div className="section-card">
                <h2>HQ</h2>
                <div className="total-container">
                  <div className="total-count">{stats?.current.hq.total}</div>
                  {hqDiff.delta !== 0 && (
                    <div className={`delta ${hqDiff.delta > 0 ? 'plus' : 'minus'}`}>
                      {hqDiff.delta > 0 ? `+${hqDiff.delta}` : hqDiff.delta}
                    </div>
                  )}
                </div>
                <div className="sub-sections">
                  {stats && getHQLikeChina(stats.current.hq.sections).map((s, i) => (
                    <a
                      key={i}
                      href={`https://www.nvidia.com/en-us/training/find-training/?Topic=${encodeURIComponent(s.title)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="stat-item-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="stat-item">
                        <span className="label">{s.title}</span>
                        <span className="value">{s.count}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </a>
            <DiffList diff={hqDiff} />
          </div>

          {/* China Card */}
          <div className="card-wrapper">
            <a href="https://www.nvidia.cn/training/online/" target="_blank" rel="noreferrer" className="card-link">
              <div className="section-card">
                <h2>China</h2>
                <div className="total-container">
                  <div className="total-count">{stats?.current.china.total}</div>
                  {chinaDiff.delta !== 0 && (
                    <div className={`delta ${chinaDiff.delta > 0 ? 'plus' : 'minus'}`}>
                      {chinaDiff.delta > 0 ? `+${chinaDiff.delta}` : chinaDiff.delta}
                    </div>
                  )}
                </div>
                <div className="sub-sections">
                  {stats && getSortedChina(stats.current.china.sections).map((s, i) => (
                    <a
                      key={i}
                      href={`https://www.nvidia.cn/training/online/?activetab=ctabs-${i + 1}`} target="_blank"
                      rel="noreferrer"
                      className="stat-item-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="stat-item">
                        <span className="label text-chinese">{s.title}</span>
                        <span className="value">{s.count}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </a>
            <DiffList diff={chinaDiff} />
          </div>
        </main>

        {/* Certifications Section */}
        {certStats && (
          <section className="cert-section">
            <h2 className="section-heading">Certifications</h2>
            <div className="cards-container">
              <div className="card-wrapper cert-card-wrapper">
                <a href="https://www.nvidia.com/en-us/learn/certification/" target="_blank" rel="noreferrer" className="card-link">
                  <div className="section-card">
                    <h2>Certification</h2>
                    <div className="total-container">
                      <div className="total-count">{certStats.current.total}</div>
                      {certDiff.delta !== 0 && (
                        <div className={`delta ${certDiff.delta > 0 ? 'plus' : 'minus'}`}>
                          {certDiff.delta > 0 ? `+${certDiff.delta}` : certDiff.delta}
                        </div>
                      )}
                    </div>
                    <div className="sub-sections">
                      {certSectionsOrder.map((name, i) => {
                        const section = certStats.current.sections.find(s => s.title === name);
                        return (
                          <div key={i} className="stat-item">
                            <span className="label">{name}</span>
                            <span className="value">{section?.count ?? 0}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </a>
                <CertDiffList diff={certDiff} />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const DiffList: React.FC<{ diff: { added: Course[], removed: Course[] } }> = ({ diff }) => {
  if (diff.added.length === 0 && diff.removed.length === 0) return null;

  return (
    <div className="diff-list">
      {diff.added.length > 0 && (
        <div className="diff-group added">
          <h3>新增课程</h3>
          {diff.added.map((c, i) => (
            <div key={i} className="diff-item">
              <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a>
              <span className="price">{c.price}</span>
            </div>
          ))}
        </div>
      )}
      {diff.removed.length > 0 && (
        <div className="diff-group removed">
          <h3>移除课程</h3>
          {diff.removed.map((c, i) => (
            <div key={i} className="diff-item">
              <span className="title">{c.title}</span>
              <span className="price">{c.price}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CertDiffList: React.FC<{
  diff: { added: Certification[], removed: Certification[], changed: CertChange[] }
}> = ({ diff }) => {
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) return null;

  return (
    <div className="diff-list">
      {diff.added.length > 0 && (
        <div className="diff-group added">
          <h3>新增认证</h3>
          {diff.added.map((c, i) => (
            <div key={i} className="diff-item">
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.title}
                {c.level && <span className="cert-level">{c.level}</span>}
              </a>
              <span className="price">{c.price}</span>
            </div>
          ))}
        </div>
      )}
      {diff.removed.length > 0 && (
        <div className="diff-group removed">
          <h3>移除认证</h3>
          {diff.removed.map((c, i) => (
            <div key={i} className="diff-item">
              <span className="title">
                {c.title}
                {c.level && <span className="cert-level">{c.level}</span>}
              </span>
              <span className="price">{c.price}</span>
            </div>
          ))}
        </div>
      )}
      {diff.changed.length > 0 && (
        <div className="diff-group changed">
          <h3>变更认证</h3>
          {diff.changed.map((c, i) => (
            <div key={i} className="diff-item">
              <a href={c.cert.url} target="_blank" rel="noreferrer">
                {c.cert.title}
                {c.cert.level && <span className="cert-level">{c.cert.level}</span>}
              </a>
              <span className="change-detail">{c.changes}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
