import React, { useEffect, useState } from 'react';
import './App.css';
import EventMonitor from './components/EventMonitor';

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

interface Stats {
  timestamp: string;
  current: {
    hq: RegionData;
    china: RegionData;
    event?: {
      hq: RegionData;
      china: RegionData;
    };
  };
  previous?: {
    hq: RegionData;
    china: RegionData;
    event?: {
      hq: RegionData;
      china: RegionData;
    };
  };
}

const App: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
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
    'Graphics and Simulation',
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

  const getDiff = (current: Section[], previous?: Section[]) => {
    if (!previous) return { added: [], removed: [], delta: 0 };

    const currentCourses = current.flatMap(s => s.courses);
    const previousCourses = previous.flatMap(s => s.courses);

    const added = currentCourses.filter(c => !previousCourses.find(p => p.url === c.url));
    const removed = previousCourses.filter(p => !currentCourses.find(c => p.url === c.url));

    return { added, removed, delta: added.length - removed.length };
  };

  useEffect(() => {
    // In production (GitHub Pages), fetch the static JSON file.
    // In development, use the API proxy.
    const url = import.meta.env.PROD ? './data/stats.json' : '/api/stats';

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load stats', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">加载中...</div>;

  const hqDiff = getDiff(stats?.current.hq.sections || [], stats?.previous?.hq.sections);
  const chinaDiff = getDiff(stats?.current.china.sections || [], stats?.previous?.china.sections);

  return (
    <div className="container">
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
          <p className="update-time">Last Update: {stats ? new Date(stats.timestamp).toLocaleString('en-US') : 'Unknown'}</p>
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

        {/* Event Monitor */}
        <EventMonitor eventStats={stats?.current.event} />
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

export default App;
