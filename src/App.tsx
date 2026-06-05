/**
 * App.tsx
 * Handles loading and routing for the site.
 * @version 2026.05.27
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Error from './pages/Error';
import Footer from './components/Footer';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import PlaylistCreateCustom from './pages/PlaylistCreateCustom';
import PlaylistImportSpotify from './pages/PlaylistImportSpotify';
import Playlists from './pages/Playlists';
import Help from './pages/Help';
import Privacy from './pages/Privacy';
import Settings from './pages/Settings';
import Multiplayer from './pages/Multiplayer';
import { useDarkMode } from './hooks/useDarkMode';

function App() {
    useDarkMode();

    return (
        <Router>
            <div className="app-shell">
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/multiplayer" element={<Multiplayer />} />
                    <Route path="/multiplayer/:roomCode" element={<Multiplayer />} />
                    <Route path="/playlists" element={<Playlists />} />
                    <Route path="/playlists/import" element={<PlaylistImportSpotify />} />
                    <Route path="/playlists/custom" element={<PlaylistCreateCustom />} />
                    <Route path="*" element={<Error />} />
                </Routes>
                <Footer />
            </div>
        </Router>
    );
}

export default App;
