/**
 * Feature Manager Service
 * Handles enabling/disabling bot features
 */
const logger = require('../utils/logger');

class FeatureManager {
    constructor() {
        // Default feature states (all enabled by default)
        this.features = {
            polls: {
                enabled: true,
                description: 'YouTube livestream poll voting system'
            },
            matchSubmissions: {
                enabled: true,
                description: 'Match result submissions'
            },
            tickets: {
                enabled: true,
                description: 'Ticket system (complaints, suggestions, support)'
            },
            coinToss: {
                enabled: true,
                description: 'Coin toss command for tournaments'
            },
            livestreamNotifications: {
                enabled: true,
                description: 'YouTube livestream notifications'
            },
            adminCommands: {
                enabled: true,
                description: 'Administrative commands'
            }
        };
        
        this.isInitialized = true;
        logger.info('✅ Feature Manager initialized');
    }

    /**
     * Check if a feature is enabled
     * @param {string} feature - Feature name
     * @returns {boolean} - True if enabled
     */
    isEnabled(feature) {
        const featureData = this.features[feature];
        if (!featureData) {
            logger.warn(`⚠️ Unknown feature requested: ${feature}`);
            return false;
        }
        return featureData.enabled;
    }

    /**
     * Enable a feature
     * @param {string} feature - Feature name
     * @returns {boolean} - Success status
     */
    enable(feature) {
        if (!this.features[feature]) {
            logger.warn(`⚠️ Cannot enable unknown feature: ${feature}`);
            return false;
        }
        
        this.features[feature].enabled = true;
        logger.info(`✅ Feature enabled: ${feature}`);
        return true;
    }

    /**
     * Disable a feature
     * @param {string} feature - Feature name
     * @returns {boolean} - Success status
     */
    disable(feature) {
        if (!this.features[feature]) {
            logger.warn(`⚠️ Cannot disable unknown feature: ${feature}`);
            return false;
        }
        
        this.features[feature].enabled = false;
        logger.info(`❌ Feature disabled: ${feature}`);
        return true;
    }

    /**
     * Toggle a feature
     * @param {string} feature - Feature name
     * @returns {boolean} - New state
     */
    toggle(feature) {
        if (!this.features[feature]) {
            logger.warn(`⚠️ Cannot toggle unknown feature: ${feature}`);
            return false;
        }
        
        this.features[feature].enabled = !this.features[feature].enabled;
        logger.info(`🔄 Feature toggled: ${feature} -> ${this.features[feature].enabled}`);
        return this.features[feature].enabled;
    }

    /**
     * Get all feature states
     * @returns {Object} - All features with their states
     */
    getAllFeatures() {
        return this.features;
    }

    /**
     * Get features grouped by enabled/disabled
     * @returns {Object} - Grouped features
     */
    getFeaturesGrouped() {
        const enabled = [];
        const disabled = [];
        
        for (const [key, value] of Object.entries(this.features)) {
            if (value.enabled) {
                enabled.push({ name: key, description: value.description });
            } else {
                disabled.push({ name: key, description: value.description });
            }
        }
        
        return { enabled, disabled };
    }

    /**
     * Reset all features to enabled
     */
    resetAll() {
        for (const key of Object.keys(this.features)) {
            this.features[key].enabled = true;
        }
        logger.info('🔄 All features reset to enabled');
    }
}

module.exports = new FeatureManager();