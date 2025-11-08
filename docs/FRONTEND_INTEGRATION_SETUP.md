# Frontend Integration Setup Guide

## 🎯 Overview

This guide explains how to integrate the Android app with the existing web frontend and ensure everything works together.

## ✅ Prerequisites

- Backend server running
- Frontend already set up (React app)
- Android app setup (from ANDROID_APP_SETUP.md)

## 🔧 Step 1: Update Frontend API Configuration

The frontend already has the mobile devices API set up. Verify it's working:

### Check `frontend/src/services/api.js`:

```javascript
// Should already have mobileDevicesAPI exported
export const mobileDevicesAPI = {
  register: (code, deviceId, deviceName, metadata) => { ... },
  generateCode: (storeId, options = {}) => { ... },
  getCodes: (storeId, includeUsed = false) => { ... },
  // ... other methods
};
```

## 📱 Step 2: Test Device Registration Flow

### 2.1 Generate a Registration Code

1. Log in as admin
2. Go to **Settings → Handheld Devices**
3. Click **"Generate Registration Code"**
4. Copy the generated code (e.g., `ABC12345`)

### 2.2 Test Registration Endpoint

You can test the registration endpoint directly:

```bash
curl -X POST http://localhost:3000/api/mobile-devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ABC12345",
    "device_id": "test-device-123",
    "device_name": "Test Device",
    "metadata": {
      "os_version": "Android 12",
      "app_version": "1.0.0"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "device": {
    "id": "...",
    "device_id": "test-device-123",
    "store_id": "..."
  },
  "store": {
    "id": "..."
  },
  "user_assigned": false,
  "message": "Device registered successfully. Please wait for admin to assign a user."
}
```

## 👤 Step 3: Assign User to Device

1. In **Settings → Handheld Devices**
2. Find the registered device in the **"Registered Devices"** table
3. Click **"Assign User"** button
4. Select a user from the dropdown
5. Customize permissions (checkboxes)
6. Click **"Assign User"**

## 🔐 Step 4: Test Permissions

After assigning a user, verify permissions are working:

```bash
# Get device info (requires auth token)
curl -X GET http://localhost:3000/api/mobile-devices/device/test-device-123 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return:
{
  "device": {
    "id": "...",
    "user_id": "...",
    "is_locked": false,
    ...
  },
  "permissions": {
    "can_scan_barcode": true,
    "can_adjust_inventory": true,
    "can_create_orders": false,
    ...
  },
  "user_assigned": true
}
```

## 🔄 Step 5: Update Android App API URL

In your Android app, update the API base URL:

### For Development:
```typescript
// src/api/mobileDevicesAPI.ts
const API_BASE_URL = 'http://YOUR_COMPUTER_IP:3000';
// Example: 'http://192.168.1.100:3000'
```

### For Production:
```typescript
const API_BASE_URL = 'https://your-production-domain.com';
```

### Find Your Computer's IP:
- **Mac/Linux**: Run `ifconfig | grep "inet "`
- **Windows**: Run `ipconfig`
- Look for your local network IP (usually starts with 192.168.x.x)

## 🌐 Step 6: CORS Configuration

Ensure your backend allows requests from the Android app:

### Update `backend/app.js`:

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:5173', // Frontend dev
    'http://localhost:3000',  // Frontend prod
    'http://192.168.1.100:3000', // Android dev (your IP)
    // Add your production frontend URL
  ],
  credentials: true,
}));
```

## 📊 Step 7: Monitor Device Activity

The frontend shows device activity in real-time:

1. **Settings → Handheld Devices**
2. View **"Registered Devices"** table
3. See **"Last Seen"** timestamp (updates when device calls API)
4. See device status (Active, Locked, Inactive)

## 🔒 Step 8: Test Device Locking

1. In **Settings → Handheld Devices**
2. Find a device
3. Click **"Lock"** button
4. Device should show locked status
5. Android app should detect lock and show lock screen

## 🧪 Step 9: Testing Checklist

- [ ] Generate registration code
- [ ] Register device with code (via Android app)
- [ ] Device appears in "Registered Devices" list
- [ ] Assign user to device
- [ ] Customize permissions
- [ ] Android app receives permissions
- [ ] Test barcode scanning (if permission enabled)
- [ ] Test inventory adjustment (if permission enabled)
- [ ] Lock device remotely
- [ ] Android app shows lock screen
- [ ] Unlock device
- [ ] Android app resumes normal operation

## 🐛 Common Issues

### Issue: Android app can't connect to backend

**Solution:**
1. Check API_BASE_URL is correct
2. Verify backend is running
3. Check firewall settings
4. For HTTP (not HTTPS), ensure `usesCleartextTraffic="true"` in AndroidManifest.xml

### Issue: Device not appearing after registration

**Solution:**
1. Refresh the "Registered Devices" list
2. Check browser console for errors
3. Verify device was registered successfully (check backend logs)

### Issue: Permissions not updating

**Solution:**
1. Refresh device list after updating permissions
2. Android app needs to call `getDeviceInfo()` to get updated permissions
3. Check backend logs for errors

### Issue: CORS errors

**Solution:**
1. Update CORS configuration in `backend/app.js`
2. Add your IP address to allowed origins
3. Restart backend server

## 📱 Step 10: Production Deployment

### Backend:
1. Deploy backend to production server
2. Update CORS to include production domain
3. Use HTTPS for security

### Android App:
1. Update `API_BASE_URL` to production URL
2. Build release APK:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
3. APK will be in `android/app/build/outputs/apk/release/`

### Frontend:
1. Already configured to work with backend
2. No changes needed for Android app integration

## 🔄 Step 11: Sync Strategy

The Android app should periodically sync with backend:

```typescript
// In Android app
useEffect(() => {
  const interval = setInterval(async () => {
    // Update last seen
    await mobileDevicesAPI.updateDevice({
      last_seen_at: new Date().toISOString(),
    });
    
    // Check lock status
    const isLocked = await mobileDevicesAPI.checkLockStatus();
    if (isLocked) {
      // Show lock screen
    }
  }, 30000); // Every 30 seconds
  
  return () => clearInterval(interval);
}, []);
```

## 📝 Next Steps

1. Implement inventory tracking features in Android app
2. Add offline mode with sync
3. Implement push notifications
4. Add analytics and reporting
5. Test on multiple devices

## 🎉 You're All Set!

The frontend and Android app are now integrated. Admins can:
- Generate registration codes
- Assign users to devices
- Customize permissions
- Monitor device activity
- Lock/unlock devices remotely

