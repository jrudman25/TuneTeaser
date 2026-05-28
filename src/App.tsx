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

function App() {

    return (
        <Router>
            <div className="app-shell">
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
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
