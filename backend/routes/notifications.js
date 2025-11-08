const express = require('express');
const NotificationService = require('../services/notificationService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Create notification
router.post('/', async (req, res) => {
    try {
        const {
            store_id,
            notification_type,
            title,
            message,
            entity_type = null,
            entity_id = null,
            priority = 'normal',
            action_url = null,
            metadata = null,
            expires_at = null
        } = req.body;

        if (!notification_type || !title || !message) {
            return res.status(400).json({ error: 'notification_type, title, and message are required' });
        }

        const notification = await NotificationService.create({
            user_id: req.user.id,
            store_id: store_id || null,
            notification_type,
            title,
            message,
            entity_type,
            entity_id,
            priority,
            action_url,
            metadata,
            expires_at
        });

        res.status(201).json({ notification });
    } catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

// Get user notifications
router.get('/', async (req, res) => {
    try {
        const filters = {
            is_read: req.query.is_read === 'true' ? true : req.query.is_read === 'false' ? false : null,
            notification_type: req.query.type || null,
            store_id: req.query.store_id || null,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const notifications = await NotificationService.getUserNotifications(req.user.id, filters);
        res.json({ notifications });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
    try {
        const storeId = req.query.store_id || null;
        const count = await NotificationService.getUnreadCount(req.user.id, storeId);
        res.json({ count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// Mark notification as read
router.put('/:notificationId/read', async (req, res) => {
    try {
        const notification = await NotificationService.markAsRead(req.params.notificationId, req.user.id);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ notification });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// Mark all notifications as read
router.put('/read-all', async (req, res) => {
    try {
        const storeId = req.body.store_id || null;
        const count = await NotificationService.markAllAsRead(req.user.id, storeId);
        res.json({ message: 'All notifications marked as read', count });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});

// Delete notification
router.delete('/:notificationId', async (req, res) => {
    try {
        const notification = await NotificationService.delete(req.params.notificationId, req.user.id);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

module.exports = router;

