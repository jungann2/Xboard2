import React, { useState, useEffect, useCallback, useRef } from 'react';
import MonitorCard from './MonitorCard';
import ConfigModal from './ConfigModal';

const getBasePath = () => {
  const sp = window?.settings?.secure_path || '';
  return sp;
};

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

export default function DeviceMonitor() {
  const [localData, setLocalData] = useState(null);
  const [localHistory, setLocalHistory] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [nodeHistories, setNodeHistories] = useState({});
  const [failCount, setFailCount] = useState(0);
  const [localConfigOpen, setLocalConfigOpen] = useState(false);
  const [nodesConfigOpen, setNodesConfigOpen] = useState(false);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    const bt = getBasePath();
    try {
      const [localRes, nodesRes, localHistRes] = await Promise.all([
        fetch(bt + '/monitor/local'),
        fetch(bt + '/monitor/nodes'),
        fetch(bt + '/monitor/local/history'),
      ]);

      if (!localRes.ok || !nodesRes.ok) throw new Error('API error');

      const localJson = await localRes.json();
      const nodesJson = await nodesRes.json();
      const localHistJson = await localHistRes.json();

      setLocalData(localJson.data);
      setNodes(nodesJson.data);
      setLocalHistory(localHistJson.data?.points || []);
      setFailCount(0);

      // Fetch history for each online node
      const histories = {};
      for (const node of nodesJson.data) {
        if (node.status === 'online') {
          try {
            const histRes = await fetch(bt + `/monitor/nodes/${node.id}/history`);
            if (histRes.ok) {
              const histJson = await histRes.json();
              histories[node.id] = histJson.data?.points || [];
            }
          } catch (e) {
            histories[node.id] = [];
          }
        }
      }
      setNodeHistories(histories);
    } catch (e) {
      setFailCount(prev => prev + 1);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>
        {t('monitor.pageTitle')}
      </h1>

      {failCount >= 3 && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
        }}>
          {t('monitor.error.fetchFailed')}
        </div>
      )}

      {/* Xboard Local Server Card */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 500 }}>{t('monitor.localServer')}</h2>
          <button onClick={() => setLocalConfigOpen(true)} style={{ cursor: 'pointer', padding: '4px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white' }}>
            {t('monitor.settingsButton')}
          </button>
        </div>
        <MonitorCard
          data={localData}
          history={localHistory}
          status={localData ? 'online' : 'unknown'}
          name={t('monitor.localServer')}
          isLocal={true}
          configKey="xboard_monitor_local_config"
        />
      </div>

      {/* Node Cards */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 500 }}>{t('monitor.nodeSection')}</h2>
          <button onClick={() => setNodesConfigOpen(true)} style={{ cursor: 'pointer', padding: '4px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white' }}>
            {t('monitor.settingsButton')}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '16px' }}>
          {nodes.map(node => (
            <MonitorCard
              key={node.id}
              data={node.monitor}
              history={nodeHistories[node.id] || []}
              status={node.status}
              name={node.name}
              type={node.type}
              host={node.host}
              childCount={node.child_count}
              lastLoadAt={node.last_load_at}
              isLocal={false}
              configKey="xboard_monitor_nodes_config"
            />
          ))}
        </div>
      </div>

      <ConfigModal
        open={localConfigOpen}
        onClose={() => setLocalConfigOpen(false)}
        configKey="xboard_monitor_local_config"
        title={t('monitor.config.localTitle')}
      />
      <ConfigModal
        open={nodesConfigOpen}
        onClose={() => setNodesConfigOpen(false)}
        configKey="xboard_monitor_nodes_config"
        title={t('monitor.config.nodesTitle')}
      />
    </div>
  );
}
