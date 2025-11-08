#!/bin/bash

# Create .env file for RetailCloudHQ
# This script creates the .env file with your macOS username

echo "Creating .env file..."

cat > .env << 'EOF'
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=retail_management
DB_USER=mitpatel
DB_PASSWORD=

# JWT Configuration
# Generate a secure secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3001

# Optional: Create super admin during initialization
SUPER_ADMIN_EMAIL=patelmit101@gmail.com
SUPER_ADMIN_PASSWORD=Retail123
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin
EOF

echo "✅ .env file created successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env and set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD"
echo "2. Generate a secure JWT_SECRET (optional but recommended)"
echo "3. Run: node scripts/init-db.js"

