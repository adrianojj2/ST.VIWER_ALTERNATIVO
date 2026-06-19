import { ConfigPage } from './pages/ConfigPage';
import { MemorialViewerPage } from './pages/MemorialViewerPage';

function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/config') {
    return <ConfigPage />;
  }
  return <MemorialViewerPage />;
}

export default App;
