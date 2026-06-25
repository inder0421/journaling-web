import { useState } from 'react';
import { AppDataProvider, useAppData } from './context/AppData';
import { Header } from './components/Header';
import { Auth } from './components/Auth';
import { TodayTab } from './components/TodayTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { HistoryTab } from './components/HistoryTab';
import { RulesTab } from './components/RulesTab';

type TabKey = 'today' | 'analytics' | 'history' | 'rules';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'history', label: 'History' },
  { key: 'rules', label: 'Rules' },
];

function Shell() {
  const { ready, mode } = useAppData();
  const [tab, setTab] = useState<TabKey>('today');

  if (!ready) {
    return (
      <div className="spinner-wrap">
        <span>Loading…</span>
      </div>
    );
  }

  if (mode === 'auth') {
    return <Auth />;
  }

  return (
    <div className="app">
      <Header />
      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="container">
        {tab === 'today' && <TodayTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'rules' && <RulesTab />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <Shell />
    </AppDataProvider>
  );
}
