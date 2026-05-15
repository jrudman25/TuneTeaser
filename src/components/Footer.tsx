/**
 * Footer.tsx
 * A small footer at the bottom of the page.
 * @version 2026.05.14
 */
import React from 'react';

const Footer = () => {

    return (
        <footer className="site-footer">
            Made with ❤️ by Jordan © {new Date().getFullYear()} | <a href="https://github.com/jrudman25/tuneteaser" target="_blank" rel="noopener noreferrer">Source</a>
        </footer>
    );
};

export default Footer;
