const crypto = require('crypto');
const SquareConnection = require('../models/SquareConnection');
const SquareDailySales = require('../models/SquareDailySales');
const DailyRevenue = require('../models/DailyRevenue');
const Store = require('../models/Store');
const { syncCreditCardFeeExpense } = require('./creditCardFeeExpenseService');

function getEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === null) {
        return fallback;
    }
    const trimmed = String(raw).trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

const DEFAULT_SCOPES = getEnv('SQUARE_SCOPES', 'PAYMENTS_READ SETTLEMENTS_READ');
const DEFAULT_TIMEZONE = getEnv('SQUARE_DEFAULT_TIMEZONE', 'America/New_York');
const STATE_SECRET = getEnv('SQUARE_STATE_SECRET', getEnv('ENCRYPTION_KEY', crypto.randomBytes(32).toString('hex')));

const ensureFetch = async (...args) => {
    if (typeof fetch === 'function') {
        return fetch(...args);
    }
    const { default: nodeFetch } = await import('node-fetch');
    return nodeFetch(...args);
};

function getSquareBaseUrl() {
    const env = getEnv('SQUARE_ENVIRONMENT', 'production').toLowerCase();
    return env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}

function getSquareApiBaseUrl() {
    return `${getSquareBaseUrl()}/v2`;
}

function generateState(payload) {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', STATE_SECRET).update(data).digest('base64url');
    return `${data}.${signature}`;
}

function validateState(state) {
    if (!state || !state.includes('.')) {
        throw new Error('Invalid state parameter');
    }
    const [data, signature] = state.split('.');
    const expected = crypto.createHmac('sha256', STATE_SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        throw new Error('Invalid state signature');
    }
    const json = Buffer.from(data, 'base64url').toString('utf8');
    return JSON.parse(json);
}

function getStoreTimezone(store) {
    return store?.timezone || DEFAULT_TIMEZONE;
}

function toSquareDateRange(date, timezone = DEFAULT_TIMEZONE) {
    const target = new Date(`${date}T00:00:00`);
    const startIso = new Date(target).toISOString();
    const endIso = new Date(new Date(target).setUTCHours(23, 59, 59, 999)).toISOString();
    return { begin_time: startIso, end_time: endIso, timezone };
}

async function fetchJson(url, options = {}) {
    const response = await ensureFetch(url, options);
    const text = await response.text();
    let json = {};
    try {
        json = text ? JSON.parse(text) : {};
    } catch (error) {
        throw new Error(`Square API returned invalid JSON: ${text}`);
    }
    if (!response.ok) {
        const message = json?.errors?.map(err => err.detail || err.message).join('; ') || response.statusText;
        const error = new Error(message);
        error.status = response.status;
        error.response = json;
        throw error;
    }
    return json;
}

async function exchangeCodeForTokens(code) {
    const url = `${getSquareBaseUrl()}/oauth2/token`;
    const clientId = getEnv('SQUARE_CLIENT_ID');
    const clientSecret = getEnv('SQUARE_CLIENT_SECRET');
    const redirectUri = getEnv('SQUARE_REDIRECT_URI');
    console.info('[SquareOAuth] Exchanging code for tokens', {
        env: getEnv('SQUARE_ENVIRONMENT', 'production'),
        clientIdPrefix: clientId ? clientId.slice(0, 6) : null,
        clientSecretLength: clientSecret ? clientSecret.length : 0,
        redirectPrefix: redirectUri ? redirectUri.slice(0, 40) : null,
    });
    const body = {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
    };
    const response = await ensureFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const text = await response.text();
    let json = {};
    try {
        json = text ? JSON.parse(text) : {};
    } catch (error) {
        throw new Error(`Square token response was not valid JSON: ${text}`);
    }
    if (!response.ok) {
        const message =
            json?.errors?.map(err => err.detail || err.message).join('; ') ||
            response.statusText ||
            `Square token exchange failed with status ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.response = json;
        throw error;
    }
    if (json.error || json.errors) {
        const message =
            json.error_description ||
            json?.errors?.map(err => err.detail || err.message).join('; ') ||
            'Square OAuth returned an error';
        const error = new Error(message);
        error.status = response.status || 400;
        error.response = json;
        throw error;
    }
    return json;
}

async function refreshAccessToken(connection) {
    if (!connection.refresh_token) {
        throw new Error('Square refresh token missing');
    }
    const url = `${getSquareBaseUrl()}/oauth2/token`;
    const body = {
        client_id: getEnv('SQUARE_CLIENT_ID'),
        client_secret: getEnv('SQUARE_CLIENT_SECRET'),
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
    };
    const response = await fetchJson(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    await SquareConnection.updateTokens(connection.store_id, {
        access_token: response.access_token,
        refresh_token: response.refresh_token || connection.refresh_token,
        token_expires_at: response.expires_at || null,
    });

    return SquareConnection.findByStore(connection.store_id);
}

async function listLocations(accessToken) {
    const url = `${getSquareApiBaseUrl()}/locations`;
    const response = await fetchJson(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });
    return response.locations || [];
}

async function fetchDailySalesFromSquare(connection, date, timezone) {
    let totals = {
        gross_card_sales: 0,
        card_fees: 0,
        net_card_sales: 0,
        currency: 'USD',
        raw_payments: [],
    };

    if (!connection.location_id) {
        throw new Error('Square location is not set for this store. Please select a location.');
    }

    const { begin_time, end_time } = toSquareDateRange(date, timezone);
    let cursor = null;

    do {
        const params = new URLSearchParams({
            begin_time,
            end_time,
            location_id: connection.location_id,
            sort_order: 'ASC',
            limit: '100',
        });
        if (cursor) {
            params.append('cursor', cursor);
        }

        const url = `${getSquareApiBaseUrl()}/payments?${params.toString()}`;
        const response = await fetchJson(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${connection.access_token}`,
                'Content-Type': 'application/json',
            },
        });

        (response.payments || []).forEach(payment => {
            if (!payment.card_details) {
                return;
            }
            const totalAmount = payment.amount_money?.amount || 0;
            const currency = payment.amount_money?.currency || totals.currency || 'USD';
            const processingFees = (payment.processing_fee || []).reduce((sum, fee) => {
                return sum + (fee.amount_money?.amount || 0);
            }, 0);

            totals.currency = currency;
            totals.gross_card_sales += totalAmount;
            totals.card_fees += processingFees;
            totals.raw_payments.push(payment);
        });

        cursor = response.cursor || null;
    } while (cursor);

    totals.net_card_sales = totals.gross_card_sales - totals.card_fees;
    totals.gross_card_sales = parseFloat((totals.gross_card_sales / 100).toFixed(2));
    totals.card_fees = parseFloat((totals.card_fees / 100).toFixed(2));
    totals.net_card_sales = parseFloat((totals.net_card_sales / 100).toFixed(2));

    return totals;
}

async function syncDailySales(storeId, salesDate, options = {}) {
    const connection = await SquareConnection.findByStore(storeId);
    if (!connection || !connection.is_active) {
        throw new Error('Square is not connected for this store.');
    }

    let activeConnection = connection;
    if (!connection.access_token) {
        throw new Error('Square access token missing.');
    }

    const store = await Store.findById(storeId);
    const timezone = getStoreTimezone(store);

    try {
        const totals = await fetchDailySalesFromSquare(activeConnection, salesDate, timezone);
        await SquareDailySales.upsert(storeId, salesDate, activeConnection.id, {
            gross_card_sales: totals.gross_card_sales,
            card_fees: totals.card_fees,
            net_card_sales: totals.net_card_sales,
            currency: totals.currency,
            raw_payload: totals.raw_payments,
        });

        await SquareConnection.markLastSynced(storeId);

        await DailyRevenue.upsert(storeId, salesDate, {
            business_credit_card: totals.gross_card_sales,
            credit_card_transaction_fees: totals.card_fees,
            square_gross_card_sales: totals.gross_card_sales,
            square_card_fees: totals.card_fees,
            square_net_card_sales: totals.net_card_sales,
            square_synced_at: new Date().toISOString(),
            entered_by: options.enteredBy || null,
        });
        try {
            await syncCreditCardFeeExpense(storeId, salesDate, totals.card_fees, options.enteredBy || null);
        } catch (feeError) {
            console.error('Square sync: failed to sync credit card fee expense', feeError);
        }

        return totals;
    } catch (error) {
        if (error.status === 401) {
            activeConnection = await refreshAccessToken(connection);
            const totals = await fetchDailySalesFromSquare(activeConnection, salesDate, timezone);
            await SquareDailySales.upsert(storeId, salesDate, activeConnection.id, {
                gross_card_sales: totals.gross_card_sales,
                card_fees: totals.card_fees,
                net_card_sales: totals.net_card_sales,
                currency: totals.currency,
                raw_payload: totals.raw_payments,
            });
            await SquareConnection.markLastSynced(storeId);
            await DailyRevenue.upsert(storeId, salesDate, {
                business_credit_card: totals.gross_card_sales,
                credit_card_transaction_fees: totals.card_fees,
                square_gross_card_sales: totals.gross_card_sales,
                square_card_fees: totals.card_fees,
                square_net_card_sales: totals.net_card_sales,
                square_synced_at: new Date().toISOString(),
                entered_by: options.enteredBy || null,
            });
            try {
                await syncCreditCardFeeExpense(storeId, salesDate, totals.card_fees, options.enteredBy || null);
            } catch (feeError) {
                console.error('Square sync (post-refresh): failed to sync credit card fee expense', feeError);
            }
            return totals;
        }
        throw error;
    }
}

module.exports = {
    getOAuthUrl: (storeId, userId, locationHint = null) => {
        const clientId = getEnv('SQUARE_CLIENT_ID');
        const redirectUri = getEnv('SQUARE_REDIRECT_URI');
        if (!clientId || !redirectUri) {
            throw new Error('Square client configuration is missing');
        }
        const state = generateState({
            storeId,
            userId,
            locationHint: locationHint || null,
            timestamp: Date.now(),
        });
        const params = new URLSearchParams({
            client_id: clientId,
            scope: DEFAULT_SCOPES,
            session: 'false',
            state,
            redirect_uri: redirectUri,
        });
        return `${getSquareBaseUrl()}/oauth2/authorize?${params.toString()}`;
    },
    validateState,
    exchangeCodeForTokens,
    listLocations,
    refreshAccessToken,
    syncDailySales,
};

