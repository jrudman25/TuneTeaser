import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './NavBar.css';

interface NavBarProps {
    statusBadge?: React.ReactNode;
    actionButtons?: React.ReactNode;
}

const NavBar: React.FC<NavBarProps> = ({ statusBadge, actionButtons }) => {
    const location = useLocation();
    const isLoginPage = location.pathname === '/';

    const handleLogoClick = () => {
        if (isLoginPage) {
            window.location.reload();
        }
    };

    return (
        <>
            <nav className="site-nav">
                <div className="site-nav-inner">
                    <div className="site-nav-left">
                        <Link className="logo-link" to={isLoginPage ? '/' : '/home'} onClick={handleLogoClick} aria-label="TuneTeaser home">
                            <span className="logo-mark" aria-hidden="true">TT</span>
                        </Link>
                        {statusBadge}
                    </div>
                    {!isLoginPage && (
                        <div className="site-nav-right">
                            <div className="nav-links">
                                <Link
                                    className={`nav-link ${location.pathname === '/leaderboard' ? 'nav-link-active' : ''}`}
                                    to="/leaderboard"
                                >
                                    Leaderboard
                                </Link>
                            </div>
                            {actionButtons}
                        </div>
                    )}
                </div>
            </nav>
        </>
    );
};

export default NavBar;
