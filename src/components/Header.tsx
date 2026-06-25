import { useAppData } from '../context/AppData';

export function Header() {
  const { mode, email, signOut } = useAppData();

  return (
    <header className="topbar">
      <div className="brand">
        <h1>Trading Discipline Journal</h1>
        <span className="sub">stay on setup</span>
      </div>
      <div className="right">
        {mode === 'cloud' ? (
          <>
            <span className="sync-pill" title={email ?? undefined}>
              <span className="dot cloud" />
              Synced
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <span className="sync-pill" title="Data is stored in this browser only">
            <span className="dot local" />
            Local only
          </span>
        )}
      </div>
    </header>
  );
}
