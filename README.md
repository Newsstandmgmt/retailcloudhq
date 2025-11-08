# RetailCloudHQ

A comprehensive, self-hosted retail operations platform designed to replace Excel-based tracking with a modern, automated, web-based solution.

## 🎯 Project Overview

This system digitizes and enhances all retail business operations including:
- Multi-location store management
- Complete financial tracking (revenue, expenses, lottery, cash flow)
- Hierarchical user management (Super Admin → Admin → Manager → Employee)
- Real-time dashboards and reporting
- Customer management
- Automated calculations and data validation

## 🏗️ Architecture

### Technology Stack
- **Frontend**: React.js (to be implemented)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Authentication**: JWT with role-based access control
- **Deployment**: Docker on Synology NAS (planned)

### Project Structure
```
retailcloudhq/
├── backend/          # Node.js/Express API server
│   ├── config/       # Database configuration
│   ├── middleware/   # Auth middleware
│   ├── models/       # Data models
│   ├── routes/       # API routes
│   └── scripts/      # Utility scripts
├── frontend/         # React web application
├── RetailCloudHQApp/ # React Native handheld app
└── docs/             # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- PostgreSQL (v12+)
- npm or yarn

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment:**
   Create a `.env` file:
   ```env
   NODE_ENV=development
   PORT=3000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=retail_management
   DB_USER=postgres
   DB_PASSWORD=your_password
   JWT_SECRET=your-secret-key
   JWT_EXPIRE=7d
   CORS_ORIGIN=http://localhost:3001
   ```

4. **Create database:**
   ```bash
   createdb retail_management
   ```

5. **Initialize database:**
   ```bash
   node scripts/init-db.js
   ```

6. **Start server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## 📊 Features

### Financial Tracking
- **Revenue**: Total cash, credit card, online sales, newspaper sales, etc.
- **Lottery**: Daily lottery tracking, commissions, bank deposits
- **Cash Flow**: Beginning/ending cash, payroll, daily cash
- **COGS**: Cost of goods sold, cigarette rebates
- **Utilities**: Monthly utility expenses (electric, internet, security, etc.)
- **Operating Expenses**: Payroll, fees, meals, parking, etc.
- **License Fees**: Annual license tracking

### User Management
- **Super Admin**: Complete system control
- **Admin**: Manage stores and users under them
- **Manager**: Store-specific operations
- **Employee**: Basic data entry

### Store Management
- Multi-store support
- Store assignments
- Employee management per store
- Store-specific data isolation

## 📝 API Documentation

See `backend/README.md` for complete API documentation.

## 🔐 Security

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Store-level data isolation
- CORS protection
- Helmet.js security headers

## 🗄️ Database Schema

All tables are defined in `backend/config/database.sql`. Key tables include:
- `users` - User accounts with roles
- `stores` - Store information
- `daily_revenue` - Daily revenue entries
- `daily_lottery` - Daily lottery entries
- `daily_cash_flow` - Cash flow tracking
- `daily_cogs` - Cost of goods sold
- `monthly_utilities` - Monthly utility expenses
- `monthly_operating_expenses` - Operating expenses
- `license_fees` - Annual license fees
- `customers` - Customer database
- `user_store_assignments` - User-store relationships

## 🛠️ Development Roadmap

### Phase 1: Foundation ✅
- [x] Database schema
- [x] Authentication system
- [x] API routes
- [x] Models and middleware

### Phase 2: Frontend (In Progress)
- [ ] React application setup
- [ ] Authentication UI
- [ ] Dashboard
- [ ] Data entry forms

### Phase 3: Advanced Features
- [ ] Reporting and analytics
- [ ] Data export
- [ ] Automated calculations
- [ ] Notifications

### Phase 4: Deployment
- [ ] Docker containerization
- [ ] Synology NAS deployment
- [ ] SSL setup
- [ ] Backup automation

## 📖 Documentation

- [Backend API Documentation](backend/README.md)
- [Database Schema](backend/config/database.sql)

## 🤝 Contributing

This is a private project for internal use. For questions or issues, contact the development team.

## 📄 License

Proprietary - Internal use only

