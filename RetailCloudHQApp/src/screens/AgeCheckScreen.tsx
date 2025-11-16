import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getApiBaseUrl } from '../config/api';

interface AgeCheckScreenProps {
  navigation?: {
    goBack: () => void;
  };
}

// Basic AAMVA PDF417 parser for DOB (DA B), Expiry ( D B), fallback patterns
function parsePDF417(raw: string) {
  const clean = raw.replace(/\r/g, '\n');
  const get = (re: RegExp) => {
    const m = clean.match(re);
    return m ? m[1] : null;
  };
  // AAMVA: D B = DOB, D A I = Expiry (varies by version)
  const dobAamva = get(/D?B?B(\d{8})/); // DBBYYYYMMDD or D BB
  const dobLabel = get(/DBB(\d{8})/);
  const dob = dobLabel || dobAamva;
  const exp = get(/D[A|E]D?(\d{8})/) || get(/DBA(\d{8})/);
  const toDate = (yyyymmdd: string | null) => {
    if (!yyyymmdd || yyyymmdd.length !== 8) return null;
    const y = Number(yyyymmdd.slice(0, 4));
    const m = Number(yyyymmdd.slice(4, 6)) - 1;
    const d = Number(yyyymmdd.slice(6, 8));
    const dt = new Date(Date.UTC(y, m, d));
    return isNaN(dt.getTime()) ? null : dt;
  };
  return { dob: toDate(dob), expiry: toDate(exp) };
}

function calcAge(dob: Date | null) {
  if (!dob) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const m = today.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export default function AgeCheckScreen({ navigation }: AgeCheckScreenProps) {
  const [raw, setRaw] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [expiry, setExpiry] = useState<Date | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [result, setResult] = useState<'pass' | 'fail' | null>(null);

  const handleLog = async () => {
    if (!result || !dob) return; // Don't log if no result or DOB
    try {
      const storeId = await AsyncStorage.getItem('store_id');
      const deviceId = await AsyncStorage.getItem('device_id');
      const token = await AsyncStorage.getItem('auth_token');
      await axios.post(`${getApiBaseUrl()}/api/age-checks/log`, {
        store_id: storeId || null,
        device_id: deviceId,
        dob: dob ? dob.toISOString().slice(0, 10) : null,
        expiry: expiry ? expiry.toISOString().slice(0, 10) : null,
        age,
        result,
        id_fragment: null, // No longer collecting last4
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeout: 5000,
      });
      // Silent success - no alert for auto-log
    } catch (e: any) {
      console.error('Failed to log age check:', e?.response?.data?.error || e.message);
      // Silent fail for auto-log
    }
  };

  const handleClear = () => {
    setRaw('');
    setDob(null);
    setExpiry(null);
    setAge(null);
    setResult(null);
  };

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (navigation?.goBack) {
              navigation.goBack();
            }
          }}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Age Checker</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Scan Input - Hidden but auto-focused for scanner */}
      <TextInput
        style={styles.hiddenInput}
        value={raw}
        onChangeText={(text) => {
          setRaw(text);
          // Auto-parse when scanner finishes (typically ends with newline or Enter)
          if (text.length > 50 && (text.endsWith('\n') || text.endsWith('\r'))) {
            setTimeout(() => {
              const { dob: d, expiry: e } = parsePDF417(text.trim());
              setDob(d);
              setExpiry(e);
              const a = calcAge(d);
              setAge(a);
              const pass = (a ?? 0) >= 21 && !(e && e.getTime() < Date.now());
              setResult(pass ? 'pass' : 'fail');
              // Auto-log after successful scan
              if (pass || !pass) {
                handleLog().catch(() => {});
              }
            }, 100);
          }
        }}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
      />

      {/* Main Display */}
      {!result ? (
        <View style={styles.scanPromptContainer}>
          <Text style={styles.scanPromptEmoji}>🆔</Text>
          <Text style={styles.scanPromptText}>Scan ID to verify age</Text>
          <Text style={styles.scanPromptSubtext}>21+ required</Text>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          <View style={[styles.resultBadge, result === 'pass' ? styles.resultPass : styles.resultFail]}>
            <Text style={styles.resultBadgeText}>
              {result === 'pass' ? '✓ ALLOWED' : '✗ NOT ALLOWED'}
            </Text>
          </View>
          {result === 'pass' && (
            <Text style={styles.resultSubtext}>Customer is 21 or older</Text>
          )}
          {result === 'fail' && (
            <Text style={styles.resultSubtext}>
              {age !== null && age < 21 ? `Age: ${age} (Under 21)` : 'ID expired or invalid'}
            </Text>
          )}
          <TouchableOpacity 
            style={[styles.button, styles.clearButton]} 
            onPress={handleClear}
          >
            <Text style={styles.buttonText}>Scan Another</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#2d8659',
    borderBottomWidth: 1,
    borderBottomColor: '#1e6b47',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60, // Balance the back button width
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  scanPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  scanPromptEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  scanPromptText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  scanPromptSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  resultBadge: {
    paddingVertical: 24,
    paddingHorizontal: 48,
    borderRadius: 16,
    marginBottom: 16,
    minWidth: 280,
    alignItems: 'center',
  },
  resultPass: {
    backgroundColor: '#059669',
  },
  resultFail: {
    backgroundColor: '#b91c1c',
  },
  resultBadgeText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  resultSubtext: {
    fontSize: 18,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2d8659',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});


