import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import './NavBar.css';

interface NavBarProps {
    statusBadge?: React.ReactNode;
    actionButtons?: React.ReactNode;
}

const NavBar: React.FC<NavBarProps> = ({ statusBadge, actionButtons }) => {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { user } = useTuneTeaserAuth();
    const isLoginPage = location.pathname === '/';
    const isGuest = searchParams.get('mode') === 'guest' || location.search.includes('mode=guest');
    const isProbablyLoggedIn = !!user || isGuest;

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
                        <Link className="logo-link" to={isLoginPage ? '/' : (isGuest ? '/home?mode=guest' : '/home')} onClick={handleLogoClick} aria-label="TuneTeaser home">
                            <span className="logo-mark" aria-hidden="true">TT</span>
                        </Link>
                        {statusBadge}
                    </div>
                    <div className="site-nav-right">
                        <div className="nav-links">
                            {isProbablyLoggedIn && (
                                <Link
                                    className={`nav-link ${location.pathname === '/leaderboard' ? 'nav-link-active' : ''}`}
                                    to={isGuest ? "/leaderboard?mode=guest" : "/leaderboard"}
                                >
                                    Leaderboard
                                </Link>
                            )}
                            <Link
                                className={`nav-link ${location.pathname === '/help' ? 'nav-link-active' : ''}`}
                                to={isGuest ? "/help?mode=guest" : "/help"}
                            >
                                Help & FAQ
                            </Link>
                        </div>
                        {actionButtons}
                    </div>
                </div>
            </nav>
        </>
    );
};

export default NavBar;
