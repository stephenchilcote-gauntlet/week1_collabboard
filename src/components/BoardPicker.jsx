import { useState } from 'react';
import { WORDLIST } from '../ai/labels.js';

function randomBoardName() {
  const pick = () => WORDLIST[Math.floor(Math.random() * WORDLIST.length)];
  return `${pick()}-${pick()}-${pick()}`;
}

export default function BoardPicker({ onSelectBoard }) {
  const [boardName, setBoardName] = useState(randomBoardName);
  const [goHovered, setGoHovered] = useState(false);
  const [defaultHovered, setDefaultHovered] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = boardName.trim();
    if (!trimmed) {
      return;
    }
    onSelectBoard(trimmed);
    setBoardName('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      gap: '16px',
    }}>
      <h1>CollabBoard</h1>
      <p>Real-time collaborative whiteboard</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          value={boardName}
          onChange={(event) => setBoardName(event.target.value)}
          placeholder="Enter board name"
          style={{
            padding: '10px 14px',
            fontSize: '16px',
            borderRadius: 8,
            border: '1px solid #ccc',
            width: 260,
          }}
        />
        <button
          type="submit"
          onMouseEnter={() => setGoHovered(true)}
          onMouseLeave={() => setGoHovered(false)}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            cursor: 'pointer',
            border: '1px solid #ccc',
            borderRadius: 8,
            background: goHovered ? 'rgba(0,0,0,0.08)' : 'transparent',
            transition: 'background 0.15s',
          }}
        >Go</button>
      </form>
      <button
        onClick={() => onSelectBoard('default')}
        onMouseEnter={() => setDefaultHovered(true)}
        onMouseLeave={() => setDefaultHovered(false)}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          cursor: 'pointer',
          border: '1px solid #ccc',
          borderRadius: 8,
          background: defaultHovered ? 'rgba(0,0,0,0.08)' : 'transparent',
          transition: 'background 0.15s',
        }}
      >Open default board</button>
    </div>
  );
}
