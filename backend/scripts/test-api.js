/**
 * API Testing Script
 * 
 * Automated tests for the RetailCloudHQ API
 * 
 * Usage: node scripts/test-api.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let authToken = null;
let storeId = null;

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
        }

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body, headers: res.headers });
                }
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Test functions
async function testHealth() {
    console.log('\n1. Testing Health Endpoint...');
    const response = await makeRequest('GET', '/health');
    if (response.status === 200) {
        console.log('   ✅ Health check passed');
        return true;
    } else {
        console.log('   ❌ Health check failed:', response.status);
        return false;
    }
}

async function testLogin() {
    console.log('\n2. Testing Login...');
    const response = await makeRequest('POST', '/api/auth/login', {
        email: 'patelmit101@gmail.com',
        password: 'Retail123'
    });

    if (response.status === 200 && response.data.token) {
        authToken = response.data.token;
        console.log('   ✅ Login successful');
        console.log(`   User: ${response.data.user.first_name} ${response.data.user.last_name}`);
        console.log(`   Role: ${response.data.user.role}`);
        return true;
    } else {
        console.log('   ❌ Login failed:', response.data.error || response.status);
        return false;
    }
}

async function testGetProfile() {
    console.log('\n3. Testing Get Profile...');
    const response = await makeRequest('GET', '/api/auth/me', null, authToken);
    
    if (response.status === 200) {
        console.log('   ✅ Profile retrieved');
        return true;
    } else {
        console.log('   ❌ Get profile failed:', response.data.error || response.status);
        return false;
    }
}

async function testCreateStore() {
    console.log('\n4. Testing Create Store...');
    const response = await makeRequest('POST', '/api/stores', {
        name: 'Test Store',
        store_type: 'galaxy',
        address: '123 Test St',
        city: 'Philadelphia',
        state: 'PA',
        zip_code: '19101'
    }, authToken);

    if (response.status === 201 && response.data.store) {
        storeId = response.data.store.id;
        console.log('   ✅ Store created');
        console.log(`   Store ID: ${storeId}`);
        console.log(`   Store Name: ${response.data.store.name}`);
        return true;
    } else {
        console.log('   ❌ Create store failed:', response.data.error || response.status);
        return false;
    }
}

async function testGetStores() {
    console.log('\n5. Testing Get All Stores...');
    const response = await makeRequest('GET', '/api/stores', null, authToken);
    
    if (response.status === 200 && Array.isArray(response.data.stores)) {
        console.log(`   ✅ Retrieved ${response.data.stores.length} store(s)`);
        return true;
    } else {
        console.log('   ❌ Get stores failed:', response.data.error || response.status);
        return false;
    }
}

async function testCreateRevenue() {
    if (!storeId) {
        console.log('\n6. ⏭️  Skipping revenue test (no store ID)');
        return false;
    }

    console.log('\n6. Testing Create Daily Revenue...');
    const response = await makeRequest('POST', `/api/revenue/${storeId}/daily`, {
        entry_date: new Date().toISOString().split('T')[0],
        total_cash: 1500.00,
        business_credit_card: 800.00,
        online_sales: 200.00,
        sales_tax_amount: 120.00
    }, authToken);

    if (response.status === 201) {
        console.log('   ✅ Revenue entry created');
        return true;
    } else {
        console.log('   ❌ Create revenue failed:', response.data.error || response.status);
        return false;
    }
}

async function testGetRevenue() {
    if (!storeId) {
        console.log('\n7. ⏭️  Skipping get revenue test (no store ID)');
        return false;
    }

    console.log('\n7. Testing Get Revenue...');
    const today = new Date().toISOString().split('T')[0];
    const response = await makeRequest('GET', `/api/revenue/${storeId}/daily/${today}`, null, authToken);
    
    if (response.status === 200 || response.status === 404) {
        console.log('   ✅ Revenue endpoint accessible');
        return true;
    } else {
        console.log('   ❌ Get revenue failed:', response.data.error || response.status);
        return false;
    }
}

async function testUnauthorizedAccess() {
    console.log('\n8. Testing Unauthorized Access...');
    const response = await makeRequest('GET', '/api/stores');
    
    if (response.status === 401) {
        console.log('   ✅ Unauthorized access properly blocked');
        return true;
    } else {
        console.log('   ⚠️  Unauthorized access not blocked (status:', response.status, ')');
        return false;
    }
}

// Run all tests
async function runTests() {
    console.log('🧪 Starting API Tests...');
    console.log('=' .repeat(60));

    const tests = [
        testHealth,
        testLogin,
        testGetProfile,
        testCreateStore,
        testGetStores,
        testCreateRevenue,
        testGetRevenue,
        testUnauthorizedAccess
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await test();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error('   ❌ Test error:', error.message);
            failed++;
        }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('📊 Test Results');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   Total: ${passed + failed}`);

    if (failed === 0) {
        console.log('\n🎉 All tests passed!');
    } else {
        console.log('\n⚠️  Some tests failed. Check the output above.');
    }

    console.log('\n💡 Tips:');
    console.log('   - Make sure the server is running: npm run dev');
    console.log('   - Check server logs for detailed error messages');
    console.log('   - Use Postman or Thunder Client for interactive testing');
}

// Check if server is running first
async function checkServer() {
    try {
        const response = await makeRequest('GET', '/health');
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// Main execution
(async () => {
    const serverRunning = await checkServer();
    if (!serverRunning) {
        console.error('❌ Server is not running!');
        console.log('   Start the server first: npm run dev');
        process.exit(1);
    }

    await runTests();
})();

