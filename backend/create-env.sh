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
DB_USER=postgres
DB_PASSWORD=

# JWT Configuration
# Generate a secure secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# Encryption key for securing tokens (generate a 64-character hex string)
ENCRYPTION_KEY=

# CORS Configuration
CORS_ORIGIN=http://localhost:3001

# Square POS Integration
# Provide production credentials from Square Developer Dashboard before deploying
SQUARE_CLIENT_ID=
SQUARE_CLIENT_SECRET=
SQUARE_REDIRECT_URI=https://retailcloudhq-production.up.railway.app/api/square/oauth/callback
SQUARE_SCOPES="PAYMENTS_READ SETTLEMENTS_READ"
SQUARE_ENVIRONMENT=production
SQUARE_DEFAULT_TIMEZONE=America/New_York
# Generate a 64-character hex string: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SQUARE_STATE_SECRET=

# Optional: Create super admin during initialization
SUPER_ADMIN_EMAIL=patelmit101@gmail.com
SUPER_ADMIN_PASSWORD=Retail123
SUPER_ADMIN_FIRST_NAME=Super
SUPER_ADMIN_LAST_NAME=Admin

# Production (Railway) overrides
DATABASE_PUBLIC_URL="postgresql://${PGUSER}:${POSTGRES_PASSWORD}@${RAILWAY_TCP_PROXY_DOMAIN}:${RAILWAY_TCP_PROXY_PORT}/${PGDATABASE}"
DATABASE_URL="postgresql://${PGUSER}:${POSTGRES_PASSWORD}@${RAILWAY_PRIVATE_DOMAIN}:5432/${PGDATABASE}"
PGDATA="/var/lib/postgresql/data/pgdata"
PGDATABASE="${POSTGRES_DB}"
PGHOST="${RAILWAY_PRIVATE_DOMAIN}"
PGPASSWORD="${POSTGRES_PASSWORD}"
PGPORT="5432"
PGUSER="${POSTGRES_USER}"
POSTGRES_DB="railway"
POSTGRES_PASSWORD="wWhyDXcfsnTDLaBRDeaijLeVHKtFnQoO"
POSTGRES_USER="postgres"
RAILWAY_DEPLOYMENT_DRAINING_SECONDS="60"
SSL_CERT_DAYS="820"
DB_SSL=true
EOF

echo "✅ .env file created successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env and set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD"
echo "2. Generate a secure JWT_SECRET (optional but recommended)"
echo "3. Run: node scripts/init-db.js"

