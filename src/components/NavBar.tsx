/**
 * NavBar.js
 * The navigation bar at the top of the screen with my logo and links to other pages.
 * @version 2023.09.18
 */
import React from 'react';
import { Nav } from './NavBarElement';
import { Link, useLocation } from 'react-router-dom';
import logo from '../img/tt.jpg';
import './NavBar.css';

const NavBar = () => {

    const location = useLocation();

    const handleLogoClick = () => {
        if (location.pathname === '/') {
            window.location.reload();
        }
    };

    return (
        <>
            <Nav
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'transparent',
                    zIndex: 9999,
                    padding: '60px',
                    pointerEvents: 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Link to={location.pathname === '/' ? '/' : '/home'} onClick={handleLogoClick}>
                        <img
                            src={logo}
                            className="list-icon"
                            style={{ height: '50px', width: '53px', pointerEvents: 'auto' }}
                            alt="a small white cloud"
                        />
                    </Link>
                </div>
            </Nav>
        </>
    );
};

export default NavBar;
