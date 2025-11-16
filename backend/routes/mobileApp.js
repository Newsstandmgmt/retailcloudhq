const express = require('express');

const router = express.Router();

// Returns the latest Android APK metadata for in-app updater
router.get('/latest-app', async (req, res) => {
    try {
        const version = (process.env.MOBILE_APP_VERSION || '1.0.0').replace(/^"+|"+$/g, '');
        const apkUrl = (process.env.MOBILE_APP_APK_URL || '').replace(/^"+|"+$/g, '');
        const releaseNotes = (process.env.MOBILE_APP_RELEASE_NOTES || 'Stability improvements and bug fixes').replace(/^"+|"+$/g, '');

        if (!apkUrl) {
            return res.status(404).json({ error: 'APK URL is not configured' });
        }

        res.json({
            platform: 'android',
            version,
            apkUrl,
            releaseNotes,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('latest-app error:', error);
        res.status(500).json({ error: 'Failed to fetch latest app metadata' });
    }
});

module.exports = router;


