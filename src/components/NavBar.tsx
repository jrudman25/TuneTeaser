/**
 * NavBar.js
 * The navigation bar at the top of the screen with my logo and links to other pages.
 * @version 2026.05.27
 */
import React from 'react';
import { Nav } from './NavBarElement';
import { Link, useLocation } from 'react-router-dom';
import './NavBar.css';

const NavBar = () => {

    const location = useLocation();
    const isLoginPage = location.pathname === '/';

    const handleLogoClick = () => {
        if (isLoginPage) {
            window.location.reload();
        }
    };

    return (
        <>
            <Nav className="site-nav">
                <div>
                    <Link className="logo-link" to={isLoginPage ? '/' : '/home'} onClick={handleLogoClick} aria-label="TuneTeaser home">
                        <span className="logo-mark" aria-hidden="true">TT</span>
                    </Link>
                </div>
                {!isLoginPage && (
                    <div className="nav-links">
                        <Link
                            className={`nav-link ${location.pathname === '/leaderboard' ? 'nav-link-active' : ''}`}
                            to="/leaderboard"
                        >
                            Leaderboard
                        </Link>
                    </div>
                )}
            </Nav>
        </>
    );
};

export default NavBar;
