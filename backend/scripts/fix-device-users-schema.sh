#!/bin/bash
set -e

# Fix Device Users API - Apply Missing Database Schema
# This script applies the admin-permissions-schema.sql to fix the 500 error

echo "🔧 Applying missing database schema..."

cd "$(dirname "$0")/.."

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "❌ backend/.env not found!"
    echo "Please create backend/.env with your database credentials"
    exit 1
fi

# Load database credentials from .env
source backend/.env

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in backend/.env"
    exit 1
fi

echo "📊 Applying admin-permissions-schema.sql..."
psql "$DATABASE_URL" -f backend/config/admin-permissions-schema.sql

echo "✅ Schema applied successfully!"
echo ""
echo "The database function 'can_user_access_store' has been created."
echo "You can now restart your backend and the device users API should work."
