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

// Enhanced AAMVA PDF417 parser for DOB and Expiry
function parsePDF417(raw: string) {
  console.log('[AgeCheck] Raw barcode data:', raw.substring(0, 200)); // Log first 200 chars for debugging
  
  const clean = raw.replace(/\r/g, '\n').replace(/\0/g, ''); // Remove null bytes
  const lines = clean.split('\n').filter(l => l.trim().length > 0);
  
  const get = (re: RegExp) => {
    const m = clean.match(re);
    return m ? m[1] : null;
  };
  
  // Try multiple patterns for DOB (Date of Birth)
  // AAMVA format variations:
  // - DBB = DOB (most common)
  // - DAA = DOB (some states)
  // - DAQ = DOB (some versions)
  // Format: DBBYYYYMMDD or DBB YYYYMMDD
  let dob: string | null = null;
  
  // Try various DOB patterns
  dob = get(/DBB(\d{8})/) ||           // DBBYYYYMMDD
        get(/DAA(\d{8})/) ||           // DAAYYYYMMDD
        get(/DAQ(\d{8})/) ||           // DAQYYYYMMDD
        get(/DBB\s*(\d{8})/) ||        // DBB YYYYMMDD (with space)
        get(/DOB[:\s]*(\d{8})/i) ||    // DOB: YYYYMMDD or DOB YYYYMMDD
        get(/DATE\s+OF\s+BIRTH[:\s]*(\d{8})/i) || // DATE OF BIRTH: YYYYMMDD
        get(/BIRTH[:\s]*(\d{8})/i) ||  // BIRTH: YYYYMMDD
        null;
  
  // If no DOB found, try to find any 8-digit date pattern that looks like YYYYMMDD
  if (!dob) {
    // Look for 8-digit sequences that could be dates (1900-2100 range)
    const datePattern = /(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/;
    const dateMatch = clean.match(datePattern);
    if (dateMatch) {
      dob = dateMatch[0];
      console.log('[AgeCheck] Found date pattern:', dob);
    }
  }
  
  // Try multiple patterns for Expiry
  // DBA = Expiry (most common)
  // DCS = Expiry (some states)
  // DCD = Expiry (some versions)
  let exp: string | null = null;
  
  exp = get(/DBA(\d{8})/) ||           // DBAYYYYMMDD
        get(/DCS(\d{8})/) ||           // DCSYYYYMMDD
        get(/DCD(\d{8})/) ||           // DCDYYYYMMDD
        get(/DBA\s*(\d{8})/) ||        // DBA YYYYMMDD (with space)
        get(/EXP[:\s]*(\d{8})/i) ||    // EXP: YYYYMMDD
        get(/EXPIR[:\s]*(\d{8})/i) ||  // EXPIR: YYYYMMDD
        get(/EXPIRY[:\s]*(\d{8})/i) || // EXPIRY: YYYYMMDD
        null;
  
  // If no expiry found, try to find another 8-digit date pattern
  if (!exp && dob) {
    const allDates = clean.match(/(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/g);
    if (allDates && allDates.length > 1) {
      // Use the second date as expiry (first is DOB)
      exp = allDates[1];
      console.log('[AgeCheck] Found expiry pattern:', exp);
    }
  }
  
  const toDate = (yyyymmdd: string | null) => {
    if (!yyyymmdd || yyyymmdd.length !== 8) return null;
    const y = Number(yyyymmdd.slice(0, 4));
    const m = Number(yyyymmdd.slice(4, 6)) - 1;
    const d = Number(yyyymmdd.slice(6, 8));
    
    // Validate date
    if (y < 1900 || y > 2100 || m < 0 || m > 11 || d < 1 || d > 31) {
      console.warn('[AgeCheck] Invalid date values:', { y, m: m + 1, d });
      return null;
    }
    
    const dt = new Date(Date.UTC(y, m, d));
    if (isNaN(dt.getTime())) {
      console.warn('[AgeCheck] Invalid date:', yyyymmdd);
      return null;
    }
    return dt;
  };
  
  const dobDate = toDate(dob);
  const expDate = toDate(exp);
  
  console.log('[AgeCheck] Parsed DOB:', dob, '->', dobDate);
  console.log('[AgeCheck] Parsed Expiry:', exp, '->', expDate);
  
  return { dob: dobDate, expiry: expDate };
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
  const [parseError, setParseError] = useState<string | null>(null);
  const [lastScanData, setLastScanData] = useState<string | null>(null);

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
    setParseError(null);
    setLastScanData(null);
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
          // Auto-parse when scanner finishes (typically ends with newline, Enter, or Tab)
          // Also trigger if we have enough data (barcodes are usually 100+ characters)
          // Most scanners send data all at once or end with newline/return
          const shouldParse = text.length > 50 && (
            text.endsWith('\n') || 
            text.endsWith('\r') || 
            text.endsWith('\t') ||
            text.endsWith('\0') || // Null terminator
            (text.length > 100) // Long enough to be a complete barcode
          );
          
          if (shouldParse) {
            console.log('[AgeCheck] Triggering parse, text length:', text.length);
            setLastScanData(text.substring(0, 500)); // Store first 500 chars for debugging
            setTimeout(() => {
              const trimmed = text.trim();
              const { dob: d, expiry: e } = parsePDF417(trimmed);
              setDob(d);
              setExpiry(e);
              const a = calcAge(d);
              setAge(a);
              
              console.log('[AgeCheck] Parse result:', { dob: d, expiry: e, age: a });
              
              // Determine result
              let pass = false;
              let errorMsg: string | null = null;
              
              if (a !== null) {
                pass = a >= 21;
                // Also check expiry if available
                if (e && e.getTime() < Date.now()) {
                  pass = false; // Expired ID
                  errorMsg = 'ID expired';
                }
              } else {
                // If we can't parse DOB, fail
                pass = false;
                errorMsg = 'Could not parse date of birth from ID';
              }
              
              setResult(pass ? 'pass' : 'fail');
              setParseError(errorMsg);
              
              // Auto-log after successful scan
              if (d) { // Only log if we got a DOB
                handleLog().catch(() => {});
              } else {
                console.warn('[AgeCheck] Could not parse DOB from barcode, not logging');
              }
            }, 150); // Slightly longer delay to ensure scanner is done
          }
        }}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType="default"
        returnKeyType="done"
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
            <>
              <Text style={styles.resultSubtext}>
                {age !== null && age < 21 
                  ? `Age: ${age} (Under 21)` 
                  : parseError || 'ID expired or invalid'}
              </Text>
              {parseError && lastScanData && (
                <View style={styles.debugContainer}>
                  <Text style={styles.debugLabel}>Debug Info (first 200 chars):</Text>
                  <Text style={styles.debugText} selectable>
                    {lastScanData.substring(0, 200)}
                  </Text>
                </View>
              )}
            </>
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
  debugContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    maxWidth: '90%',
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
});


