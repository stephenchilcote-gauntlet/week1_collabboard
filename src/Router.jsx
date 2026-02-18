import { useCallback, useEffect, useState } from 'react';
import App from './App.jsx';
import BoardPicker from './components/BoardPicker.jsx';

const getPathname = () => window.location.pathname || '/';

const getBoardName = (pathname) => {
  const parts = pathname.split('/');
  if (parts.length >= 3 && parts[1] === 'board' && parts[2]) {
    return parts[2];
  }
  return null;
};

export default function Router() {
  const [path, setPath] = useState(() => getPathname());

  const navigateTo = useCallback((nextPath) => {
    if (nextPath === path) {
      return;
    }
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  }, [path]);

  useEffect(() => {
    const handlePopstate = () => setPath(getPathname());
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, []);

  const boardName = getBoardName(path);
  if (boardName) {
    return <App boardName={boardName} onNavigateHome={() => navigateTo('/')} />;
  }

  return <BoardPicker onSelectBoard={(name) => navigateTo(`/board/${name}`)} />;
}
