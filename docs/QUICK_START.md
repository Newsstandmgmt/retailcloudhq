# Quick Start Guide - Android App & Frontend Setup

## 🚀 Quick Setup (5 Minutes)

### Prerequisites Check
- [ ] Node.js 18+ installed
- [ ] Android Studio installed
- [ ] Backend server running
- [ ] Frontend running

## 📱 Android App Setup (React Native)

### 1. Create Project
```bash
npx react-native init RetailCloudHQApp --template react-native-template-typescript
cd RetailCloudHQApp
npm install
```

### 2. Install Dependencies
```bash
npm install axios @react-native-async-storage/async-storage
npm install react-native-device-info react-native-vision-camera
npm install @react-navigation/native @react-navigation/stack
```

### 3. Copy API Service
Copy the API service from `docs/ANDROID_APP_SETUP.md` (Step 5) to `src/api/mobileDevicesAPI.ts`

### 4. Update API URL
In `src/api/mobileDevicesAPI.ts`, set:
```typescript
const API_BASE_URL = 'http://YOUR_COMPUTER_IP:3000';
```

### 5. Run App
```bash
npm run android
```

## 🌐 Frontend Setup

### Already Configured! ✅

The frontend already has:
- ✅ Mobile Devices API (`frontend/src/services/api.js`)
- ✅ Handheld Devices Settings UI (`frontend/src/components/settings/HandheldDevices.jsx`)
- ✅ User assignment and permissions management

### Just Test It:

1. **Generate Code:**
   - Go to Settings → Handheld Devices
   - Click "Generate Registration Code"
   - Copy the code

2. **Register Device:**
   - Enter code in Android app
   - Device registers automatically

3. **Assign User:**
   - In Settings → Handheld Devices
   - Find registered device
   - Click "Assign User"
   - Select user and set permissions

## 🔗 Connect Everything

### Backend (Already Running)
- Port: 3000
- Endpoints: `/api/mobile-devices/*`

### Frontend (Already Running)
- Port: 5173 (or your configured port)
- Settings page: `/settings` → "Handheld Devices" tab

### Android App
- API URL: `http://YOUR_IP:3000`
- Registration screen on first launch

## 📋 Testing Checklist

1. [ ] Backend running on port 3000
2. [ ] Frontend running and accessible
3. [ ] Android app installed on device/emulator
4. [ ] Generated registration code in Settings
5. [ ] Registered device with code in Android app
6. [ ] Device appears in "Registered Devices" list
7. [ ] Assigned user to device
8. [ ] Permissions working in Android app

## 🐛 Quick Troubleshooting

**Android app can't connect:**
- Check API_BASE_URL matches your computer's IP
- Verify backend is running
- Check AndroidManifest.xml has internet permission

**Device not appearing:**
- Refresh the device list
- Check backend logs for errors
- Verify registration was successful

**CORS errors:**
- Update CORS in `backend/app.js` to include your IP
- Restart backend

## 📚 Full Documentation

- [Complete Android Setup](./ANDROID_APP_SETUP.md) - Detailed setup guide
- [Frontend Integration](./FRONTEND_INTEGRATION_SETUP.md) - Integration details
- [Device Registration](./DEVICE_REGISTRATION_IMPLEMENTATION.md) - How it works

## 🎉 You're Ready!

Once setup is complete:
1. Admin generates codes in Settings
2. Devices register with codes
3. Admin assigns users and permissions
4. Android app syncs with backend
5. Everything works together! 🚀

