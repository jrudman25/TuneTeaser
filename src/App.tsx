/**
 * App.tsx
 * Handles loading and routing for the site.
 * @version 2024.04.06
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Error from './pages/Error';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import NavBar from './components/NavBar';

function App() {

    return (
        <Router>
            <NavBar />
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/home" element={<Home />} />
                <Route path="*" element={<Error />} />
            </Routes>
            <Footer />
        </Router>
    );
}

export default App;
