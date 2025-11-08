// Script to deactivate test users, keeping only the user with stores
// Run with: node backend/scripts/deactivate-test-users.js

const { query } = require('../config/database');

async function deactivateTestUsers() {
    try {
        console.log('Finding active users...');
        
        // Get all active users with their store counts
        const usersResult = await query(`
            SELECT 
                u.id,
                u.email,
                u.first_name,
                u.last_name,
                u.role,
                COUNT(s.id) FILTER (WHERE s.is_active = true AND s.deleted_at IS NULL) as store_count
            FROM users u
            LEFT JOIN stores s ON s.created_by = u.id OR s.admin_id = u.id
            WHERE u.is_active = true
            GROUP BY u.id, u.email, u.first_name, u.last_name, u.role
            ORDER BY store_count DESC, u.created_at ASC
        `);
        
        console.log('\nActive users found:');
        usersResult.rows.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email} (${user.first_name} ${user.last_name}) - Role: ${user.role}, Stores: ${user.store_count}`);
        });
        
        // Find the user with stores (this should be the real user)
        const userWithStores = usersResult.rows.find(u => parseInt(u.store_count) > 0);
        
        if (!userWithStores) {
            console.log('\n⚠️  No user found with active stores.');
            console.log('Please manually identify which user to keep active.');
            console.log('You can run: UPDATE users SET is_active = false WHERE id != \'<user-id-here>\';');
            process.exit(1);
        }
        
        console.log(`\n✅ Keeping user active: ${userWithStores.email} (${userWithStores.first_name} ${userWithStores.last_name})`);
        console.log(`   This user has ${userWithStores.store_count} active store(s).\n`);
        
        // Deactivate all other users
        const deactivateResult = await query(`
            UPDATE users 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id != $1 AND is_active = true
            RETURNING id, email, first_name, last_name
        `, [userWithStores.id]);
        
        if (deactivateResult.rows.length > 0) {
            console.log(`\n✅ Deactivated ${deactivateResult.rows.length} user(s):`);
            deactivateResult.rows.forEach(user => {
                console.log(`   - ${user.email} (${user.first_name} ${user.last_name})`);
            });
        } else {
            console.log('\n✅ No other users to deactivate. All users are already correctly set.');
        }
        
        console.log(`\n✅ Total active users: 1 (${userWithStores.email})`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

deactivateTestUsers();

