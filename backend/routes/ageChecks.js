const express = require('express');
const crypto = require('crypto');
const { query } = require('../config/database');
const { authenticate, authorize, canAccessStore } = require('../middleware/auth');

const router = express.Router();

// Log an age check (any authenticated role)
router.post('/log', authenticate, async (req, res) => {
  try {
    const { device_id, store_id, dob, expiry, age, result, id_fragment } = req.body || {};
    if (!device_id || !result) {
      return res.status(400).json({ error: 'device_id and result are required' });
    }
    // Optional hashed identifier (last 4) without storing PII
    let id_hash = null;
    if (id_fragment && typeof id_fragment === 'string') {
      id_hash = crypto.createHash('sha256').update(id_fragment).digest('hex').slice(0, 16);
    }
    const values = [
      store_id || null,
      device_id,
      req.user?.userId || null,
      dob ? new Date(dob) : null,
      expiry ? new Date(expiry) : null,
      age || null,
      String(result).toLowerCase(),
      id_hash,
    ];
    const resultInsert = await query(
      `INSERT INTO age_check_logs (store_id, device_id, user_id, dob, expiry, age, result, id_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, created_at`,
      values
    );
    res.json({ success: true, id: resultInsert.rows[0].id, created_at: resultInsert.rows[0].created_at });
  } catch (error) {
    console.error('Age check log error:', error);
    res.status(500).json({ error: 'Failed to log age check' });
  }
});

// List by store (admin/manager)
router.get('/store/:storeId', authenticate, canAccessStore, authorize('admin', 'manager', 'super_admin'), async (req, res) => {
  try {
    const { start, end, result, limit = 200 } = req.query;
    const clauses = ['store_id = $1'];
    const params = [req.params.storeId];
    let idx = 2;
    if (result) {
      clauses.push('result = $' + idx++);
      params.push(String(result).toLowerCase());
    }
    if (start) { clauses.push('created_at >= $' + idx++); params.push(new Date(start)); }
    if (end) { clauses.push('created_at <= $' + idx++); params.push(new Date(end)); }
    const q = `
      SELECT id, device_id, age, result, dob, expiry, id_hash, created_at
      FROM age_check_logs
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ${Math.min(parseInt(limit, 10) || 200, 1000)}
    `;
    const r = await query(q, params);
    res.json({ checks: r.rows });
  } catch (error) {
    console.error('Age check list store error:', error);
    res.status(500).json({ error: 'Failed to fetch age checks' });
  }
});

// List by device (admin/manager/super_admin)
router.get('/device/:deviceId', authenticate, authorize('admin', 'manager', 'super_admin'), async (req, res) => {
  try {
    const { start, end, result, limit = 200 } = req.query;
    const clauses = ['device_id = $1'];
    const params = [req.params.deviceId];
    let idx = 2;
    if (result) { clauses.push('result = $' + idx++); params.push(String(result).toLowerCase()); }
    if (start) { clauses.push('created_at >= $' + idx++); params.push(new Date(start)); }
    if (end) { clauses.push('created_at <= $' + idx++); params.push(new Date(end)); }
    const q = `
      SELECT id, device_id, age, result, dob, expiry, id_hash, created_at, store_id
      FROM age_check_logs
      WHERE ${clauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ${Math.min(parseInt(limit, 10) || 200, 1000)}
    `;
    const r = await query(q, params);
    res.json({ checks: r.rows });
  } catch (error) {
    console.error('Age check list device error:', error);
    res.status(500).json({ error: 'Failed to fetch age checks' });
  }
});

module.exports = router;


