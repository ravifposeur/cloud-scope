import { useState } from 'react'
import './index.css'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import { getToken, getUser, removeToken, removeUser } from './api'

function App() {
  const [page, setPage] = useState(() => {
    // If a valid token exists from a previous session, go straight to dashboard
    return getToken() ? 'dashboard' : 'login';
  });

  const [user, setUser] = useState(() => getUser());

  const handleAuth = () => {
    setUser(getUser());
    setPage('dashboard');
  };

  const handleLogout = () => {
    removeToken();
    removeUser();
    setUser(null);
    setPage('login');
  };

  if (page === 'register') {
    return <RegisterPage onGoLogin={() => setPage('login')} />;
  }

  if (page === 'dashboard') {
    return <DashboardPage user={user} onLogout={handleLogout} />;
  }

  // Default: login
  return (
    <LoginPage
      onAuth={handleAuth}
      onGoRegister={() => setPage('register')}
    />
  );
}

export default App
