const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Ingest logs from device - require auth with deviceId in token
router.post('/', authenticate, async (req, res) => {
  try {
    const { entries = [], device_id: deviceIdBody } = req.body || {};
    const tokenDeviceId = req.user?.deviceId || null;
    const deviceId = deviceIdBody || tokenDeviceId;
    if (!deviceId) {
      return res.status(400).json({ error: 'device_id missing' });
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.json({ ingested: 0 });
    }
    // Get store_id for device if exists
    let storeId = null;
    try {
      const r = await query('SELECT store_id FROM mobile_devices WHERE device_id = $1', [deviceId]);
      storeId = r.rows[0]?.store_id || null;
    } catch {}
    const values = [];
    const params = [];
    let i = 1;
    for (const e of entries.slice(0, 200)) {
      const level = String(e.level || 'info').toLowerCase();
      const message = String(e.message || '');
      const ctx = e.context ? JSON.stringify(e.context) : JSON.stringify({});
      const ts = e.timestamp ? new Date(e.timestamp) : new Date();
      params.push(deviceId, storeId, level, message, ctx, ts);
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    }
    await query(
      `INSERT INTO device_logs (device_id, store_id, level, message, context, created_at)
       VALUES ${values.join(',')}`,
      params
    );
    res.json({ ingested: Math.min(entries.length, 200) });
  } catch (error) {
    console.error('Device log ingest error:', error);
    res.status(500).json({ error: 'Failed to ingest logs' });
  }
});

// Super admin: list logs for a device
router.get('/device/:deviceId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { start, end, level, limit = 200 } = req.query;
    const clauses = ['device_id = $1'];
    const params = [req.params.deviceId];
    let idx = 2;
    if (level) {
      clauses.push('level = $' + idx++);
      params.push(String(level).toLowerCase());
    }
    if (start) {
      clauses.push('created_at >= $' + idx++);
      params.push(new Date(start));
    }
    if (end) {
      clauses.push('created_at <= $' + idx++);
      params.push(new Date(end));
    }
    const q = `
      SELECT id, device_id, store_id, level, message, context, created_at
      FROM device_logs
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ${Math.min(parseInt(limit, 10) || 200, 1000)}
    `;
    const result = await query(q, params);
    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Device log list error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;


