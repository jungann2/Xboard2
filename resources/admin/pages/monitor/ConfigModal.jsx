import React, { useState, useEffect } from 'react';

const t = (key) => {
  const lang = localStorage.getItem('language') || 'zh-CN';
  const translations = window.XBOARD_TRANSLATIONS?.[lang] || window.XBOARD_TRANSLATIONS?.['zh-CN'] || {};
  const keys = key.split('.');
  let result = translations;
  for (const k of keys) {
    result = result?.[k];
  }
  return result || key;
};

const defaultConfig = {
  showSystemInfo: true,
  showGauges: true,
  showCharts: true,
  showRuntime: true,
};

export default function ConfigModal({ open, onClose, configKey, title }) {
  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(configKey);
      if (stored) setConfig(JSON.parse(stored));
    } catch (e) {
      setConfig(defaultConfig);
    }
  }, [configKey, open]);

  const toggle = (key) => {
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    try {
      localStorage.setItem(configKey, JSON.stringify(newConfig));
    } catch (e) {}
  };

  if (!open) return null;

  const items = [
    { key: 'showSystemInfo', label: t('monitor.config.showSystemInfo') },
    { key: 'showGauges', label: t('monitor.config.showGauges') },
    { key: 'showCharts', label: t('monitor.config.showCharts') },
    { key: 'showRuntime', label: t('monitor.config.showRuntime') },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'white', borderRadius: '12px', padding: '24px', minWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>{title}</h3>
        {items.map(item => (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '14px' }}>{item.label}</span>
            <button
              onClick={() => toggle(item.key)}
              style={{
                width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                backgroundColor: config[item.key] ? '#3b82f6' : '#d1d5db',
                position: 'relative', transition: 'background-color 0.2s',
              }}
              role="switch"
              aria-checked={config[item.key]}
              aria-label={item.label}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
                position: 'absolute', top: '2px', transition: 'left 0.2s',
                left: config[item.key] ? '22px' : '2px',
              }} />
            </button>
          </div>
        ))}
        <button onClick={onClose} style={{
          marginTop: '20px', width: '100%', padding: '8px', borderRadius: '8px',
          border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '14px',
        }}>
          OK
        </button>
      </div>
    </div>
  );
}
