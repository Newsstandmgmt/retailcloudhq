// Script to check all users and their status
const { query } = require('../config/database');

async function checkAllUsers() {
    try {
        console.log('Checking all users in the database...\n');
        
        // Get all users with their status
        const result = await query(`
            SELECT 
                id,
                email,
                first_name,
                last_name,
                role,
                is_active,
                created_at
            FROM users
            ORDER BY is_active DESC, role, created_at DESC
        `);
        
        console.log(`Total users found: ${result.rows.length}\n`);
        console.log('Users by status:\n');
        
        const activeUsers = result.rows.filter(u => u.is_active === true);
        const inactiveUsers = result.rows.filter(u => u.is_active === false);
        
        console.log(`Active users: ${activeUsers.length}`);
        activeUsers.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.email} (${user.first_name} ${user.last_name}) - Role: ${user.role}`);
        });
        
        console.log(`\nInactive users: ${inactiveUsers.length}`);
        inactiveUsers.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.email} (${user.first_name} ${user.last_name}) - Role: ${user.role}`);
        });
        
        console.log('\n\nUsers by role:');
        const byRole = {};
        result.rows.forEach(user => {
            if (!byRole[user.role]) {
                byRole[user.role] = { active: 0, inactive: 0 };
            }
            if (user.is_active) {
                byRole[user.role].active++;
            } else {
                byRole[user.role].inactive++;
            }
        });
        
        Object.keys(byRole).forEach(role => {
            console.log(`  ${role}: ${byRole[role].active} active, ${byRole[role].inactive} inactive`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAllUsers();

