import React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import HomeIcon from '@mui/icons-material/Home';
import ProfileMenu from './ProfileMenu';
import './NavBar.css';

interface NavBarProps {
    statusBadge?: React.ReactNode;
    actionButtons?: React.ReactNode;
    onNavigate?: (to: string) => void | Promise<void>;
}

const NavBar: React.FC<NavBarProps> = ({ statusBadge, actionButtons, onNavigate }) => {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { user } = useTuneTeaserAuth();
    const isLoginPage = location.pathname === '/';
    const isGuest = searchParams.get('mode') === 'guest' || location.search.includes('mode=guest');
    const isSpotifyUser = !!localStorage.getItem('accessToken') || !!sessionStorage.getItem('accessToken');
    const isProbablyLoggedIn = (!!user || isGuest || isSpotifyUser) && !isLoginPage;

    const handleLogoClick = () => {
        if (isLoginPage) {
            window.location.reload();
        }
    };

    const handleNavClick = (to: string) => async (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (!onNavigate) return;
        event.preventDefault();
        await onNavigate(to);
    };

    return (
        <>
            <nav className="site-nav">
                <div className="site-nav-inner">
                    <div className="site-nav-left">
                        <Link className="logo-link" to={isLoginPage ? '/' : (isGuest ? '/home?mode=guest' : '/home')} onClick={onNavigate ? handleNavClick(isLoginPage ? '/' : (isGuest ? '/home?mode=guest' : '/home')) : handleLogoClick} aria-label="TuneTeaser home">
                            <span className="logo-mark" aria-hidden="true">TT</span>
                        </Link>
                    </div>
                    <div className="site-nav-right">
                        <div className="nav-links">
                            {isProbablyLoggedIn && (
                                <>
                                    <Link
                                        className={`nav-link ${location.pathname.startsWith('/multiplayer') ? 'nav-link-active' : ''}`}
                                        to={isGuest ? "/multiplayer?mode=guest" : "/multiplayer"}
                                        onClick={handleNavClick(isGuest ? "/multiplayer?mode=guest" : "/multiplayer")}
                                    >
                                        Multiplayer
                                    </Link>
                                    <Link
                                        className={`nav-link ${location.pathname === '/leaderboard' ? 'nav-link-active' : ''}`}
                                        to={isGuest ? "/leaderboard?mode=guest" : "/leaderboard"}
                                        onClick={handleNavClick(isGuest ? "/leaderboard?mode=guest" : "/leaderboard")}
                                    >
                                        Leaderboard
                                    </Link>
                                </>
                            )}
                            <Link
                                className={`nav-link ${location.pathname === '/help' ? 'nav-link-active' : ''}`}
                                to={isGuest ? "/help?mode=guest" : "/help"}
                                onClick={handleNavClick(isGuest ? "/help?mode=guest" : "/help")}
                            >
                                Help & FAQ
                            </Link>
                        </div>
                        {isProbablyLoggedIn && (
                            <Link
                                className="home-button"
                                to={isGuest ? '/home?mode=guest' : '/home'}
                                onClick={handleNavClick(isGuest ? '/home?mode=guest' : '/home')}
                                aria-label="Home"
                                title="Home"
                            >
                                <HomeIcon aria-hidden="true" />
                            </Link>
                        )}
                        {(isProbablyLoggedIn || statusBadge || actionButtons) && (
                            <ProfileMenu
                                user={user}
                                isGuest={isGuest}
                                showSettings={isProbablyLoggedIn}
                                statusBadge={statusBadge}
                                actionButtons={actionButtons}
                            />
                        )}
                    </div>
                </div>
            </nav>
        </>
    );
};

export default NavBar;
