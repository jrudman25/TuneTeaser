/**
 * App.test.tsx
 * Tests the App component.
 * @version 2026.02.01
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <App />
    );
    expect(true).toBeTruthy();
  });
});
