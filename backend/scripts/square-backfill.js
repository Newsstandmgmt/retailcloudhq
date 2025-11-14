#!/usr/bin/env node

/**
 * Backfill Square credit card totals over a date range.
 *
 * Usage:
 *   node scripts/square-backfill.js --store=<storeId> --start=2025-11-01 --end=2025-11-30
 *   node scripts/square-backfill.js --all --start=2025-11-01
 */

require('dotenv').config();

const path = require('path');
const SquareConnection = require('../models/SquareConnection');
const SquareService = require('../services/squareService');

const DEFAULT_START = process.env.SQUARE_SYNC_START_DATE || '2025-11-01';
const DEFAULT_END = new Date().toISOString().slice(0, 10);

function parseArgs() {
    const args = process.argv.slice(2);
    const params = {};

    args.forEach((arg) => {
        if (arg.startsWith('--store=')) {
            params.storeId = arg.split('=')[1];
        } else if (arg === '--all') {
            params.all = true;
        } else if (arg.startsWith('--start=')) {
            params.start = arg.split('=')[1];
        } else if (arg.startsWith('--end=')) {
            params.end = arg.split('=')[1];
        }
    });

    return params;
}

function addDays(dateString, days = 1) {
    const date = new Date(`${dateString}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function isBeforeOrEqual(a, b) {
    return new Date(`${a}T00:00:00Z`) <= new Date(`${b}T00:00:00Z`);
}

async function backfillForStore(storeId, startDate, endDate) {
    console.log(`\n📆 Backfilling Square data for store ${storeId} (${startDate} → ${endDate})`);
    let current = startDate;
    let processed = 0;

    while (isBeforeOrEqual(current, endDate)) {
        try {
            await SquareService.syncDailySales(storeId, current, { enteredBy: null });
            console.log(`   ✅ ${current}`);
        } catch (error) {
            console.error(`   ⚠️  Failed on ${current}: ${error.message || error}`);
        }
        processed += 1;
        current = addDays(current, 1);
    }

    console.log(`➡️  Finished store ${storeId}. Days processed: ${processed}`);
}

async function main() {
    const args = parseArgs();
    const startDate = args.start || DEFAULT_START;
    const endDate = args.end || DEFAULT_END;

    if (!args.storeId && !args.all) {
        console.error('Please pass --store=<storeId> or --all');
        process.exit(1);
    }

    let connections;
    if (args.storeId) {
        const connection = await SquareConnection.findByStore(args.storeId);
        if (!connection) {
            console.error(`No Square connection found for store ${args.storeId}`);
            process.exit(1);
        }
        connections = [connection];
    } else {
        connections = await SquareConnection.findActiveConnections();
    }

    if (!connections || connections.length === 0) {
        console.error('No active Square connections to backfill.');
        process.exit(1);
    }

    for (const connection of connections) {
        await backfillForStore(connection.store_id, startDate, endDate);
    }

    console.log('\n🎉 Square backfill complete');
    process.exit(0);
}

main().catch((error) => {
    console.error('Square backfill script failed:', error);
    process.exit(1);
});

