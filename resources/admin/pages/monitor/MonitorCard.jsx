import React, { useMemo } from 'react';

const t = (key, params) => {
  const lang = localStorage.getItem('language') || 'zh-CN';
  const translations = window.XBOARD_TRANSLATIONS?.[lang] || window.XBOARD_TRANSLATIONS?.['zh-CN'] || {};
  const keys = key.split('.');
  let result = translations;
  for (const k of keys) {
    result = result?.[k];
  }
  if (typeof result === 'string' && params) {
    Object.entries(params).forEach(([k, v]) => {
      result = result.replace(`{${k}}`, v);
    });
  }
  return result || key;
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
};

const formatUptime = (seconds) => {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return t('monitor.systemInfo.uptimeFormat', { days, hours });
};

const getConfig = (configKey) => {
  try {
    const stored = localStorage.getItem(configKey);
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return { showSystemInfo: true, showGauges: true, showCharts: true, showRuntime: true };
};

// Simple ring gauge SVG
const RingGauge = ({ percent, label, size = 80 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent > 90 ? '#ef4444' : percent > 70 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
          fontSize="14" fontWeight="600" fill="#374151">
          {Math.round(percent)}%
        </text>
      </svg>
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{label}</div>
    </div>
  );
};

// Simple line chart SVG
const MiniChart = ({ data, label, width = 200, height = 60 }) => {
  if (!data || data.length < 2) return <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '12px' }}>-</div>;
  
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={width} height={height}>
        <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      </svg>
      <div style={{ fontSize: '11px', color: '#6b7280' }}>{label}</div>
    </div>
  );
};

export default function MonitorCard({ data, history, status, name, type, host, childCount, lastLoadAt, isLocal, configKey }) {
  const config = getConfig(configKey);

  const chartData = useMemo(() => {
    if (!history || history.length < 2) return { cpu: [], mem: [], netSent: [], netRecv: [], ioRead: [], ioWrite: [] };
    
    const cpu = history.map(p => p.cpu || 0);
    const mem = history.map(p => p.mem_used || 0);
    
    // Calculate rates for network and disk IO (bytes/s from cumulative values)
    const netSent = [];
    const netRecv = [];
    const ioRead = [];
    const ioWrite = [];
    for (let i = 1; i < history.length; i++) {
      const dt = (history[i].timestamp - history[i-1].timestamp) || 1;
      netSent.push(Math.max(0, ((history[i].network_sent || 0) - (history[i-1].network_sent || 0)) / dt));
      netRecv.push(Math.max(0, ((history[i].network_recv || 0) - (history[i-1].network_recv || 0)) / dt));
      ioRead.push(Math.max(0, ((history[i].disk_io_read || 0) - (history[i-1].disk_io_read || 0)) / dt));
      ioWrite.push(Math.max(0, ((history[i].disk_io_write || 0) - (history[i-1].disk_io_write || 0)) / dt));
    }
    
    return { cpu, mem: mem.map(m => m / (1024*1024)), netSent, netRecv, ioRead, ioWrite };
  }, [history]);

  const statusColor = status === 'online' ? '#22c55e' : status === 'offline' ? '#ef4444' : '#9ca3af';
  const statusText = t(`monitor.status.${status}`);

  const cardStyle = {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    background: 'white',
    position: 'relative',
    overflow: 'hidden',
  };

  if (status === 'offline') {
    cardStyle.opacity = 0.6;
  }

  if (status === 'unknown') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '16px' }}>{name}</span>
            {type && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>{type}</span>}
          </div>
          <span style={{ color: statusColor, fontSize: '13px', fontWeight: 500 }}>{statusText}</span>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          {t('monitor.status.unknown')}
        </div>
      </div>
    );
  }

  const cpuPercent = data?.cpu || 0;
  const memPercent = data?.mem ? (data.mem.used / data.mem.total * 100) : 0;
  const diskPercent = data?.disk ? (data.disk.used / data.disk.total * 100) : 0;
  const swapPercent = data?.swap?.total ? (data.swap.used / data.swap.total * 100) : 0;

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>{name}</span>
          {type && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>{type}</span>}
          {childCount > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>({t('monitor.runtime.childNodes')}: {childCount})</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusColor }} />
          <span style={{ color: statusColor, fontSize: '13px', fontWeight: 500 }}>{statusText}</span>
        </div>
      </div>

      {status === 'offline' && lastLoadAt && (
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
          {t('monitor.error.lastOnline')}: {new Date(lastLoadAt * 1000).toLocaleString()}
        </div>
      )}

      {/* System Info */}
      {config.showSystemInfo && data && (
        <div style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px', fontSize: '13px' }}>
          <div style={{ fontWeight: 500, marginBottom: '8px' }}>{t('monitor.systemInfo.title')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {data.hostname && <div>{t('monitor.systemInfo.hostname')}: {data.hostname}</div>}
            {data.cpu_model && <div>{t('monitor.systemInfo.cpuModel')}: {data.cpu_model}</div>}
            {data.ipv4 && <div>{t('monitor.systemInfo.ipv4')}: {data.ipv4}</div>}
            {data.ipv6 && <div>{t('monitor.systemInfo.ipv6')}: {data.ipv6}</div>}
            {data.uptime != null && <div>{t('monitor.systemInfo.uptime')}: {formatUptime(data.uptime)}</div>}
          </div>
        </div>
      )}

      {/* Gauges */}
      {config.showGauges && (
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '16px' }}>
          <RingGauge percent={cpuPercent} label={t('monitor.gauges.cpu')} />
          <RingGauge percent={memPercent} label={t('monitor.gauges.ram')} />
          <RingGauge percent={diskPercent} label={t('monitor.gauges.disk')} />
          <RingGauge percent={swapPercent} label={t('monitor.gauges.swap')} />
        </div>
      )}

      {/* Charts */}
      {config.showCharts && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          <MiniChart data={chartData.cpu} label={t('monitor.charts.cpu')} />
          <MiniChart data={chartData.mem} label={t('monitor.charts.ram')} />
          <MiniChart data={chartData.netSent.length > 0 ? chartData.netSent : null} label={t('monitor.charts.network')} />
          <MiniChart data={chartData.ioRead.length > 0 ? chartData.ioRead : null} label={t('monitor.charts.diskIo')} />
        </div>
      )}

      {/* Runtime Info */}
      {config.showRuntime && data && (
        <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '13px', color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
          <div>{t('monitor.runtime.memory')}: {data.mem ? formatBytes(data.mem.used) : '-'} / {data.mem ? formatBytes(data.mem.total) : '-'}</div>
          {data.goroutines != null && <div>{t('monitor.runtime.goroutines')}: {data.goroutines}</div>}
        </div>
      )}
    </div>
  );
}
