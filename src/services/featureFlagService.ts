/**
 * Feature Flag Service
 * 
 * Implements versioned feature flags to prevent new work from overwriting 
 * existing user-approved behavior.
 * 
 * Usage:
 * if (isFeatureEnabled('new_timeline_layout')) { ... } else { ... }
 */

export type FeatureFlag = 'new_timeline_layout' | 'advanced_reporting' | 'experimental_sync';

interface FlagConfig {
    enabled: boolean;
    minBuildVersion?: string;
}

const DEFAULT_FLAGS: Record<FeatureFlag, FlagConfig> = {
    'new_timeline_layout': { enabled: false }, // Default to OFF to preserve baseline
    'advanced_reporting': { enabled: true },
    'experimental_sync': { enabled: false }
};

export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
    // 1. Check Local Storage overrides (for testing/user preference)
    const localOverrides = localStorage.getItem('protrack_feature_flags');
    if (localOverrides) {
        try {
            const parsed = JSON.parse(localOverrides);
            if (typeof parsed[flag] === 'boolean') {
                return parsed[flag];
            }
        } catch (e) {
            console.error("Feature Flag Parse Error", e);
        }
    }

    // 2. Return default configuration
    return DEFAULT_FLAGS[flag]?.enabled ?? false;
};

export const setFeatureFlag = (flag: FeatureFlag, enabled: boolean) => {
    const current = localStorage.getItem('protrack_feature_flags');
    let parsed: Record<string, boolean> = {};
    if (current) {
        try { parsed = JSON.parse(current); } catch (e) {}
    }
    parsed[flag] = enabled;
    localStorage.setItem('protrack_feature_flags', JSON.stringify(parsed));
    console.log(`[FeatureFlag] ${flag} set to ${enabled}`);
    // Ideally trigger a re-render or reload here if needed
};

export const resetFlags = () => {
    localStorage.removeItem('protrack_feature_flags');
};