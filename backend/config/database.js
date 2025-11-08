const { Pool } = require('pg');
require('dotenv').config();

const buildPoolConfig = () => {
    const commonOptions = {
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    };

    // Prefer DATABASE_URL when available (e.g., Railway, Render)
    if (process.env.DATABASE_URL) {
        const ssl =
            process.env.DB_SSL === 'false'
                ? false
                : {
                      rejectUnauthorized: process.env.DB_SSL_STRICT === 'true',
                  };

        return {
            connectionString: process.env.DATABASE_URL,
            ssl,
            ...commonOptions,
        };
    }

    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'retail_management',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ...commonOptions,
    };

    if (process.env.DB_SSL === 'true') {
        config.ssl = {
            rejectUnauthorized: process.env.DB_SSL_STRICT === 'true',
        };
    }

    return config;
};

const pool = new Pool(buildPoolConfig());

// Test the connection
pool.on('connect', () => {
    console.log('✅ Database connection established');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

// Helper function to execute queries
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Helper function to get a client from the pool
const getClient = async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;
    
    // Set a timeout on the client
    const timeout = setTimeout(() => {
        console.error('A client has been checked out for more than 5 seconds!');
    }, 5000);
    
    // Monkey patch the query method to log the duration
    client.query = (...args) => {
        client.lastQuery = args;
        return query.apply(client, args);
    };
    
    client.release = () => {
        clearTimeout(timeout);
        client.query = query;
        client.release = release;
        return release.apply(client);
    };
    
    return client;
};

module.exports = {
    pool,
    query,
    getClient
};

