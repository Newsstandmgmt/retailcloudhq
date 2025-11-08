const express = require('express');
const Customer = require('../models/Customer');
const { authenticate, canAccessStore } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Create new customer
router.post('/:storeId', canAccessStore, async (req, res) => {
    try {
        const customer = await Customer.create(req.params.storeId, req.body);
        
        res.status(201).json({
            message: 'Customer created successfully',
            customer
        });
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// Get all customers for a store
router.get('/:storeId', canAccessStore, async (req, res) => {
    try {
        const customers = await Customer.findAllByStore(req.params.storeId);
        res.json({ customers });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get single customer
router.get('/:storeId/:customerId', canAccessStore, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Verify customer belongs to the store
        if (customer.store_id !== req.params.storeId) {
            return res.status(403).json({ error: 'Customer does not belong to this store' });
        }
        
        res.json({ customer });
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// Update customer
router.put('/:storeId/:customerId', canAccessStore, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Verify customer belongs to the store
        if (customer.store_id !== req.params.storeId) {
            return res.status(403).json({ error: 'Customer does not belong to this store' });
        }
        
        const updatedCustomer = await Customer.update(req.params.customerId, req.body);
        res.json({
            message: 'Customer updated successfully',
            customer: updatedCustomer
        });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// Delete customer
router.delete('/:storeId/:customerId', canAccessStore, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.customerId);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Verify customer belongs to the store
        if (customer.store_id !== req.params.storeId) {
            return res.status(403).json({ error: 'Customer does not belong to this store' });
        }
        
        await Customer.delete(req.params.customerId);
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

module.exports = router;

