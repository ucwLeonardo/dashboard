import React, { useState, useEffect } from 'react';

interface EventConfig {
    hqUrl: string;
    chinaUrl: string;
}

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

interface EventStats {
    hq: RegionData;
    china: RegionData;
}

interface EventMonitorProps {
    eventStats?: EventStats;
}

const EventMonitor: React.FC<EventMonitorProps> = ({ eventStats }) => {
    const [config, setConfig] = useState<EventConfig>({ hqUrl: '', chinaUrl: '' });
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [ghToken, setGhToken] = useState('');
    const isProd = import.meta.env.PROD;

    useEffect(() => {
        // Load persisted config and token
        const localConfig = localStorage.getItem('event_config');
        if (localConfig) {
            setConfig(JSON.parse(localConfig));
            setLoadingConfig(false);
        }

        const localToken = localStorage.getItem('gh_token');
        if (localToken) setGhToken(localToken);

        // Fetch Truth from server/repo
        const url = isProd ? './data/event_config.json' : '/api/config';
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('No backend API or Config File');
                return res.json();
            })
            .then(data => {
                setConfig(data);
                setLoadingConfig(false);
            })
            .catch(() => {
                if (!localConfig) setLoadingConfig(false);
            });
    }, [isProd]);

    const handleSave = async () => {
        setIsSaving(true);

        // Save token locally
        if (ghToken) localStorage.setItem('gh_token', ghToken);

        // 1. Try Git Dispatch (Permanent Save) if token exists
        if (ghToken && isProd) {
            try {
                const response = await fetch(`https://api.github.com/repos/ucwLeonardo/dashboard/dispatches`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `token ${ghToken}`
                    },
                    body: JSON.stringify({
                        event_type: 'update-event-config',
                        client_payload: config
                    })
                });

                if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);

                alert('Update request sent to GitHub!\n\nThis will trigger a background workflow to update the repository and re-scrape the data. The dashboard will update in a few minutes.');
                setIsSaving(false);
                return;
            } catch (err) {
                console.error("GitHub Dispatch failed", err);
                alert('Failed to send update to GitHub. Check your Token and Permissions.\nFalling back to local save.');
            }
        }

        // 2. Fallback / Dev Mode Save
        const apiMethods = isProd ? [] : [
            fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })
        ];

        try {
            if (!isProd) {
                const res = await apiMethods[0];
                if (!res.ok) throw new Error(res.statusText);
            }
            // Local Storage Save
            localStorage.setItem('event_config', JSON.stringify(config));

            if (!isProd) {
                alert('Config saved to local backend!');
            } else {
                alert('Config saved LOCALLY only.\n\nTo update the live scraper, please provide a GitHub Personal Access Token.');
            }
        } catch (err) {
            console.warn("Save failed", err);
            localStorage.setItem('event_config', JSON.stringify(config));
            alert('Saved to Browser Storage (Local Only).');
        } finally {
            setIsSaving(false);
        }
    };

    if (loadingConfig) return <div>Loading Event Config...</div>;

    const hasStats = eventStats && (eventStats.hq.total > 0 || eventStats.china.total > 0);

    return (
        <div className="event-monitor">
            <h2 className="event-header">Event Page Monitoring</h2>

            <div className="config-section">
                <div className="input-group">
                    <label>HQ Event URL:</label>
                    <input
                        type="text"
                        value={config.hqUrl}
                        onChange={e => setConfig({ ...config, hqUrl: e.target.value })}
                        placeholder="https://www.nvidia.com/..."
                    />
                </div>
                <div className="input-group">
                    <label>China Event URL:</label>
                    <input
                        type="text"
                        value={config.chinaUrl}
                        onChange={e => setConfig({ ...config, chinaUrl: e.target.value })}
                        placeholder="https://www.nvidia.cn/..."
                    />
                </div>

                {isProd && (
                    <div className="input-group" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                        <label>GitHub Token (Optional - For Saving to Repo):</label>
                        <input
                            type="password"
                            value={ghToken}
                            onChange={e => setGhToken(e.target.value)}
                            placeholder="ghp_..."
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--label-color)', marginTop: '5px' }}>
                            Required to trigger the scraper from this static page.
                        </p>
                    </div>
                )}

                <button onClick={handleSave} disabled={isSaving} className="save-btn">
                    {isSaving ? 'Saving...' : 'Save & Scrape'}
                </button>
            </div>

            {hasStats && (
                <div className="cards-container event-cards">
                    {/* HQ Event Card */}
                    {eventStats.hq.total > 0 && (
                        <div className="card-wrapper">
                            <a href={config.hqUrl} target="_blank" rel="noreferrer" className="card-link">
                                <div className="section-card">
                                    <h3>HQ Event</h3>
                                    <div className="total-container">
                                        <div className="total-count">{eventStats.hq.total}</div>
                                    </div>
                                    <div className="sub-sections">
                                        {eventStats.hq.sections.map((s, i) => (
                                            <div key={i} className="stat-item">
                                                <span className="label" title={s.title}>{s.title}</span>
                                                <span className="value">{s.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </a>
                        </div>
                    )}

                    {/* China Event Card */}
                    {eventStats.china.total > 0 && (
                        <div className="card-wrapper">
                            <a href={config.chinaUrl} target="_blank" rel="noreferrer" className="card-link">
                                <div className="section-card">
                                    <h3>China Event</h3>
                                    <div className="total-container">
                                        <div className="total-count">{eventStats.china.total}</div>
                                    </div>
                                    <div className="sub-sections">
                                        {eventStats.china.sections.map((s, i) => (
                                            <div key={i} className="stat-item">
                                                <span className="label text-chinese" title={s.title}>{s.title}</span>
                                                <span className="value">{s.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EventMonitor;
