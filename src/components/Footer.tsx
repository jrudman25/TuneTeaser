/**
 * Footer.tsx
 * A small footer at the bottom of the page.
 * @version 2026.05.24
 */
import React from 'react';
import { version } from '../../package.json';

const Footer = () => {

    return (
        <footer className="site-footer">
            v{version} | Made with ❤️ by Jordan © {new Date().getFullYear()} | <a href="https://github.com/jrudman25/tuneteaser" target="_blank" rel="noopener noreferrer">Source</a>
        </footer>
    );
};

export default Footer;
