// Script to add License Management feature to the database
// Run with: node backend/scripts/add-license-management-feature.js

const { query } = require('../config/database');

async function addLicenseManagementFeature() {
    try {
        console.log('Adding License Management feature...');
        
        const result = await query(
            `INSERT INTO store_features (feature_key, feature_name, description, category)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (feature_key) DO NOTHING
             RETURNING *`,
            [
                'license_management',
                'License Management',
                'Manage store licenses, expiration dates, renewals, and reminders',
                'operations'
            ]
        );

        if (result.rows.length > 0) {
            console.log('✅ License Management feature added successfully!');
            console.log('Feature:', result.rows[0]);
        } else {
            console.log('ℹ️  License Management feature already exists in the database.');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding License Management feature:', error);
        process.exit(1);
    }
}

addLicenseManagementFeature();

