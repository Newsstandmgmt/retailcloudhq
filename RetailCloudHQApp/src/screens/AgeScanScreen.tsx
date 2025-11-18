import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let Camera: any, useCameraDevices: any, useScanBarcodes: any, BarcodeFormat: any;
try {
  // Dynamic requires so app still builds if modules aren’t installed
  const vc = require('react-native-vision-camera');
  Camera = vc.Camera;
  useCameraDevices = vc.useCameraDevices;
  const scanner = require('vision-camera-code-scanner');
  useScanBarcodes = scanner.useScanBarcodes;
  BarcodeFormat = scanner.BarcodeFormat;
} catch (e) {
  // libs not available; screen will show info message
}

export default function AgeScanScreen({ onBack }: any) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const devices = useCameraDevices ? useCameraDevices() : null;
  const device = devices?.back || null;
  const formats = useMemo(() => (BarcodeFormat ? [BarcodeFormat.PDF417] : []), []);
  const [frameProcessor, barcodes] = useScanBarcodes ? useScanBarcodes(formats) : [null, []];

  useEffect(() => {
    const request = async () => {
      if (!Camera) {
        setHasPermission(false);
        return;
      }
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    };
    request().catch(() => setHasPermission(false));
  }, []);

  useEffect(() => {
    const handleDetected = async () => {
      if (scanned) return;
      const bc = barcodes?.[0];
      const value = bc?.displayValue || bc?.rawValue;
      if (value && typeof value === 'string') {
        setScanned(true);
        await AsyncStorage.setItem('age_scan_raw', value);
        Alert.alert('Scanned', 'ID scanned successfully.', [{ text: 'OK', onPress: () => onBack && onBack() }]);
      }
    };
    if (barcodes && barcodes.length > 0) handleDetected().catch(() => {});
  }, [barcodes, scanned, onBack]);

  if (!Camera || !useScanBarcodes) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera scanner unavailable</Text>
        <Text style={styles.text}>
          Install react-native-vision-camera and vision-camera-code-scanner to enable barcode scanning.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => onBack && onBack()}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera permission denied</Text>
        <TouchableOpacity style={styles.button} onPress={() => onBack && onBack()}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device || hasPermission === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Preparing camera…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Camera
        style={{ flex: 1 }}
        device={device}
        isActive={!scanned}
        frameProcessor={frameProcessor}
        frameProcessorFps={5}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>Align PDF417 barcode within the frame</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: '#111827' }]} onPress={() => onBack && onBack()}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 8, textAlign: 'center' },
  text: { fontSize: 14, color: '#444', textAlign: 'center' },
  button: { marginTop: 12, backgroundColor: '#2d8659', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  overlay: { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' },
  overlayText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 8 },
});


