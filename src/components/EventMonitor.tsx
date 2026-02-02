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

    useEffect(() => {
        // Try to load from local storage first for better UX on static sites
        const localConfig = localStorage.getItem('event_config');
        if (localConfig) {
            setConfig(JSON.parse(localConfig));
            setLoadingConfig(false);
        }

        // Always try to fetch from API to get the "Truth" from server/repo
        fetch('/api/config')
            .then(res => {
                if (!res.ok) throw new Error('No backend API');
                return res.json();
            })
            .then(data => {
                setConfig(data);
                setLoadingConfig(false);
            })
            .catch(() => {
                // If API fails (static site), and we have no local config, stop loading
                if (!localConfig) setLoadingConfig(false);
            });
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        })
            .then(res => {
                if (!res.ok) throw new Error(res.statusText);
                return res.json();
            })
            .then(() => {
                setIsSaving(false);
                alert('Config saved! Scraper triggered in background.');
                // Also save to local storage
                localStorage.setItem('event_config', JSON.stringify(config));
            })
            .catch(err => {
                console.warn("Backend save failed (expected on static site), falling back to local storage", err);

                // Fallback: Save to Local Storage
                localStorage.setItem('event_config', JSON.stringify(config));
                setIsSaving(false);

                // Show a helpful, non-error message
                alert('Configuration saved to your browser (Local Only).\n\nSince this is a static site, the public background scraper cannot be triggered from here. The dashboard will continue to show data from the repository configuration.');
            });
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
