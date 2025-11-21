# RetailCloudHQ - Backend API

A comprehensive REST API for managing retail operations, built with Node.js, Express, and PostgreSQL.

## Features

- **User Authentication & Authorization**: JWT-based authentication with role-based access control (Super Admin, Admin, Manager, Employee)
- **Multi-Store Management**: Hierarchical store management with user assignments
- **Financial & Compliance Tracking**: Revenue, expenses, lottery, cash flow, COGS, payroll, utilities, licenses, and audit history
- **Customer & Device Management**: Store-specific customer database plus handheld device registration, assignment, remote wipe, debug logs, and permissions
- **RESTful API**: Clean, well-structured API endpoints including `/api/mobile-devices`, `/api/mobile-logs`, and `/api/age-checks` for the handheld app

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn (npm is used in this repo)

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the backend directory:
   ```env
   NODE_ENV=development
   PORT=3000
   
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=retail_management
   DB_USER=postgres
   DB_PASSWORD=your_password
   
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRE=7d
   
   CORS_ORIGIN=http://localhost:3001
   
   # Optional: Create super admin during initialization
   SUPER_ADMIN_EMAIL=admin@example.com
   SUPER_ADMIN_PASSWORD=secure_password
   SUPER_ADMIN_FIRST_NAME=Super
   SUPER_ADMIN_LAST_NAME=Admin
   ```

3. **Create PostgreSQL database:**
   ```bash
   createdb retail_management
   ```

4. **Initialize database schema:**
   ```bash
   node scripts/init-db.js
   ```

5. **Start the server:**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user (Admin+ only)
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/change-password` - Change password

### Stores
- `GET /api/stores` - Get all stores (filtered by user role)
- `GET /api/stores/:storeId` - Get single store
- `POST /api/stores` - Create store (Admin+ only)
- `PUT /api/stores/:storeId` - Update store (Admin+ only)
- `DELETE /api/stores/:storeId` - Delete store (Super Admin only)
- `POST /api/stores/:storeId/employees` - Assign employee to store
- `GET /api/stores/:storeId/employees` - Get store employees

### Revenue
- `POST /api/revenue/:storeId/daily` - Create/update daily revenue
- `GET /api/revenue/:storeId/daily/:date` - Get revenue for date
- `GET /api/revenue/:storeId/range` - Get revenue for date range
- `GET /api/revenue/:storeId/totals` - Calculate totals for date range

### Lottery
- `POST /api/lottery/:storeId/daily` - Create/update daily lottery
- `GET /api/lottery/:storeId/daily/:date` - Get lottery for date
- `GET /api/lottery/:storeId/range` - Get lottery for date range

### Cash Flow
- `POST /api/cashflow/:storeId/daily` - Create/update daily cash flow
- `GET /api/cashflow/:storeId/daily/:date` - Get cash flow for date
- `GET /api/cashflow/:storeId/range` - Get cash flow for date range

### COGS (Cost of Goods Sold)
- `POST /api/cogs/:storeId/daily` - Create/update daily COGS
- `GET /api/cogs/:storeId/daily/:date` - Get COGS for date
- `GET /api/cogs/:storeId/range` - Get COGS for date range

### Utilities (Monthly)
- `POST /api/utilities/:storeId/monthly` - Create/update monthly utilities
- `GET /api/utilities/:storeId/monthly/:month` - Get utilities for month
- `GET /api/utilities/:storeId/range` - Get utilities for date range

### Operating Expenses (Monthly)
- `POST /api/expenses/:storeId/monthly` - Create/update monthly expenses
- `GET /api/expenses/:storeId/monthly/:month` - Get expenses for month
- `GET /api/expenses/:storeId/range` - Get expenses for date range

### License Fees (Yearly)
- `POST /api/licenses/:storeId/yearly` - Create/update yearly license fees
- `GET /api/licenses/:storeId/yearly/:year` - Get license fees for year
- `GET /api/licenses/:storeId/range` - Get license fees for year range

### Customers
- `POST /api/customers/:storeId` - Create customer
- `GET /api/customers/:storeId` - Get all customers for store
- `GET /api/customers/:storeId/:customerId` - Get single customer
- `PUT /api/customers/:storeId/:customerId` - Update customer
- `DELETE /api/customers/:storeId/:customerId` - Delete customer

### Users
- `GET /api/users` - Get all users (filtered by role)
- `GET /api/users/:userId` - Get single user
- `PUT /api/users/:userId` - Update user (Admin+ only)
- `DELETE /api/users/:userId` - Delete user (Super Admin only)
- `GET /api/users/store/:storeId` - Get users assigned to store

### Mobile Devices & Logs
- `POST /api/mobile-devices/register` - Register a handheld device using admin-generated codes
- `PUT /api/mobile-devices/device/:deviceId` - Update metadata, last seen, or assigned user
- `POST /api/mobile-devices/:deviceId/reassign` - Super Admin reassigns device to a new store and flags wipe
- `POST /api/mobile-devices/:deviceId/mark-wipe` - Mark device for remote wipe
- `GET /api/mobile-devices/device/:deviceId` - Fetch device status, lock state, and permissions
- `POST /api/mobile-logs` - Ingest device log batches from the React Native app
- `GET /api/mobile-logs/device/:deviceId` - Super Admin views debug logs for troubleshooting

### Age Checks
- `POST /api/age-checks/log` - Log a handheld age verification (DOB, expiry, pass/fail, hashed ID)
- `GET /api/age-checks/store/:storeId` - Admin/Manager fetch store age-check history
- `GET /api/age-checks/device/:deviceId` - Super Admin/Auditors fetch age checks by device

## User Roles & Permissions

### Super Admin
- Full system access
- Create/manage all users and stores
- View all data across all stores
- System configuration

### Admin
- Manage stores assigned to them
- Create/manage managers and employees
- View data for their stores
- Manage suppliers and expenses

### Manager
- Manage their assigned store
- Create/manage employees
- View and enter data for their store
- Basic reporting

### Employee
- Enter data for assigned stores
- View data for assigned stores
- Basic customer management

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Database Schema

The database schema includes tables for:
- Users (with hierarchical roles)
- Stores
- Daily Revenue
- Daily Lottery
- Daily Cash Flow
- Daily COGS
- Monthly Utilities
- Monthly Operating Expenses
- Yearly License Fees
- Customers
- Suppliers
- User-Store Assignments

See `config/database.sql` for the complete schema.

## Development

### Project Structure
```
backend/
├── config/          # Database configuration and schema
├── middleware/      # Authentication and authorization middleware
├── models/          # Data models
├── routes/          # API route handlers
├── scripts/         # Utility scripts
├── app.js           # Express app configuration
└── server.js        # Server entry point
```

## Testing the API

You can test the API using tools like:
- Postman
- curl
- Thunder Client (VS Code extension)
- Your frontend application

Example login request:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secure_password"}'
```

## Production Deployment

For production deployment on Synology NAS:

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure proper CORS origins
4. Set up SSL/HTTPS
5. Configure database connection pooling
6. Set up automated backups
7. Use environment variables for all sensitive data

## License

This project is proprietary software for internal use.

