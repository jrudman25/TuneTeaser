/**
 * Error.tsx
 * Handles display when users navigate to a route that doesn't exist.
 * @version 2026.05.14
 */
import React from 'react';
import { Link } from 'react-router-dom';

const Error = () => {

    return (
        <main className="page">
            <section className="error-card">
                <span className="eyebrow">Lost record</span>
                <h1 className="section-title">Oops!</h1>
                <p className="lede">We could not find the page you were looking for. This is either because:</p>
                <ul className="error-list">
                    <li>There is an error in the URL entered into your web browser. Please check the URL and try again.</li>
                    <li>The page you are looking for has been moved or deleted.</li>
                </ul>
                <p className="lede">
                    You can return to the homepage by clicking{' '}
                    <Link className="text-link" to="/">here</Link>.
                </p>
            </section>
        </main>
    );
};

export default Error;
