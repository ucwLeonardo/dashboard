import React, { useEffect, useState } from 'react';

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

interface EventConfig {
    hqUrl: string;
    chinaUrl: string;
}

interface EventMonitorProps {
    eventStats?: EventStats;
}

const EventMonitor: React.FC<EventMonitorProps> = ({ eventStats }) => {
    const [config, setConfig] = useState<EventConfig>({ hqUrl: '', chinaUrl: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch config to get URLs for links
        const url = import.meta.env.PROD ? './data/event_config.json' : '/api/config';
        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('No config');
                return res.json();
            })
            .then(data => {
                setConfig(data);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    if (loading) return null;

    // Hide component if no URLs configured or no stats
    const hasConfig = config.hqUrl || config.chinaUrl;
    const hasStats = eventStats && (eventStats.hq.total > 0 || eventStats.china.total > 0);

    if (!hasConfig || !hasStats) return null;

    return (
        <div className="event-monitor">
            <h2 className="event-header">Event Page Monitoring</h2>

            <div className="cards-container event-cards">
                {/* HQ Event Card */}
                {eventStats.hq.total > 0 && config.hqUrl && (
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
                {eventStats.china.total > 0 && config.chinaUrl && (
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
        </div>
    );
};

export default EventMonitor;
