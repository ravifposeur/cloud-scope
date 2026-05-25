import { useState } from 'react'
import './index.css'
import DashboardPage from './pages/DashboardPage'
import { getUser, removeToken, removeUser } from './api'

function App() {
  // Temporary mock user since auth page is being built separately
  const [user, setUser] = useState(() => getUser() || { email: 'researcher@cloudscope.test' });

  const handleLogout = () => {
    removeToken();
    removeUser();
    setUser(null);
    alert('Logout clicked. (Auth pages will be integrated here later)');
  };

  return <DashboardPage user={user} onLogout={handleLogout} />;
}

export default App
