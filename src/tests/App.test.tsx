import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import React from 'react';

// Mock dependencies to focus on UI regressions
vi.mock('../services/firebaseService', () => ({
    initFirebase: vi.fn(() => true),
    subscribeToCollections: vi.fn(() => () => {}),
    syncData: vi.fn(),
    isFirebaseInitialized: vi.fn(() => true)
}));

vi.mock('../services/geminiService', () => ({
    generateWeeklySummary: vi.fn()
}));

describe('ProTrack AI Regression Suite', () => {
    
    it('renders the Dashboard by default (Baseline Req #1)', () => {
        render(<App />);
        // Check for key dashboard elements
        expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
        expect(screen.getByText(/Weekly Status Distribution/i)).toBeInTheDocument();
    });

    it('contains the Daily Tasks navigation (Baseline Req #1)', () => {
        render(<App />);
        const tasksNav = screen.getAllByText(/Daily Tasks/i);
        expect(tasksNav.length).toBeGreaterThan(0);
    });

    it('contains the Observations navigation (Baseline Req #3)', () => {
        render(<App />);
        const obsNav = screen.getAllByText(/Observations/i);
        expect(obsNav.length).toBeGreaterThan(0);
    });

    // We can add specific component tests here later
    // e.g., rendering TaskCard and checking for the specific classNames 
    // that implement the "Done" state styling as defined in BASELINE.md
});
