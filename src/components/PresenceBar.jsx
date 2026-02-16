export default function PresenceBar({ presenceList, currentUid }) {
  const maxVisible = 5;
  const visible = presenceList.slice(0, maxVisible);
  const overflow = presenceList.length - visible.length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 150,
        background: 'rgba(255,255,255,0.9)',
        padding: '6px 10px',
        borderRadius: 12,
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      }}
    >
      {visible.map((entry) => (
        <div
          key={entry.uid}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {entry.photoURL ? (
            <img
              src={entry.photoURL}
              alt={entry.name}
              style={{ width: 24, height: 24, borderRadius: '50%' }}
            />
          ) : (
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#94a3b8',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {entry.name?.charAt(0) ?? '?'}
            </div>
          )}
          <span style={{ fontSize: 12 }}>
            {entry.name}{entry.uid === currentUid ? ' (You)' : ''}
          </span>
        </div>
      ))}
      {overflow > 0 && (
        <div style={{ fontSize: 12, color: '#475569' }}>+{overflow} more</div>
      )}
    </div>
  );
}
