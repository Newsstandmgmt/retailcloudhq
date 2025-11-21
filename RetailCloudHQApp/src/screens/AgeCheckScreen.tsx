import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getApiBaseUrl } from '../config/api';

interface AgeCheckScreenProps {
  navigation?: {
    goBack: () => void;
  };
}

interface ParsedFields {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  licenseNumber?: string | null;
  genderCode?: string | null;
}

// Enhanced AAMVA PDF417 parser returning dates and extra fields
function parsePDF417(raw: string) {
  console.log('[AgeCheck] Raw barcode data:', raw.substring(0, 200));

  const clean = raw.replace(/\r/g, '\n').replace(/\0/g, '');

  const get = (re: RegExp) => {
    const match = clean.match(re);
    return match ? match[1] : null;
  };

  const readField = (codes: string[]): string | null => {
    for (const code of codes) {
      const pattern = new RegExp(`${code}([^\\r\\n]+)`);
      const match = clean.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  };

  let dob = get(/DBB(\d{8})/)
    || get(/DAA(\d{8})/)
    || get(/DAQ(\d{8})/)
    || get(/DBB\s*(\d{8})/)
    || get(/DOB[:\s]*(\d{8})/i)
    || get(/DATE\s+OF\s+BIRTH[:\s]*(\d{8})/i)
    || get(/BIRTH[:\s]*(\d{8})/i)
    || null;

  let exp = get(/DBA(\d{8})/)
    || get(/DCS(\d{8})/)
    || get(/DCD(\d{8})/)
    || get(/DBA\s*(\d{8})/)
    || get(/EXP[:\s]*(\d{8})/i)
    || get(/EXPIR[:\s]*(\d{8})/i)
    || get(/EXPIRY[:\s]*(\d{8})/i)
    || null;

  if (!dob) {
    const fallback = clean.match(/(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
    if (fallback) {
      dob = fallback[0];
    }
  }

  if (!exp && dob) {
    const dates = clean.match(/(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/g);
    if (dates && dates.length > 1) {
      exp = dates[1];
    }
  }

  const toDate = (yyyymmdd: string | null) => {
    if (!yyyymmdd || yyyymmdd.length !== 8) return null;
    const year = Number(yyyymmdd.slice(0, 4));
    const month = Number(yyyymmdd.slice(4, 6)) - 1;
    const day = Number(yyyymmdd.slice(6, 8));
    if (year < 1900 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month, day));
    return isNaN(date.getTime()) ? null : date;
  };

  const dobDate = toDate(dob);
  const expDate = toDate(exp);

  const fullName = readField(['DAA']);
  let firstName = readField(['DAC', 'DAF']);
  let lastName = readField(['DCS']);
  let middleName = readField(['DAD']);

  if (fullName && (!firstName || !lastName)) {
    const parts = fullName.split(',');
    if (!lastName && parts.length > 0) lastName = parts[0]?.trim();
    if (!firstName && parts.length > 1) firstName = parts[1]?.trim();
    if (!middleName && parts.length > 2) middleName = parts[2]?.trim();
  }

  const address = readField(['DAG']);
  const city = readField(['DAI']);
  const state = readField(['DAJ']);
  const postal = readField(['DAK', 'DAZ']);
  const licenseNumber = readField(['DAQ', 'DBJ', 'DBK']);
  const genderCode = readField(['DBC']);

  console.log('[AgeCheck] Parsed DOB:', dob, '->', dobDate);
  console.log('[AgeCheck] Parsed Expiry:', exp, '->', expDate);

  return {
    dob: dobDate,
    expiry: expDate,
    fields: {
      firstName,
      middleName,
      lastName,
      address,
      city,
      state,
      postalCode: postal,
      licenseNumber,
      genderCode,
    } as ParsedFields,
  };
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
  const [personFields, setPersonFields] = useState<ParsedFields | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const ensureFocus = () => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

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
    setPersonFields(null);
  };

  const formatDateDisplay = (date: Date | null) => {
    if (!date) return '—';
    return date.toLocaleDateString();
  };

  const getGenderLabel = (code?: string | null) => {
    if (!code) return '—';
    switch (code) {
      case '1':
        return 'M';
      case '2':
        return 'F';
      case '7':
        return 'X';
      default:
        return code.toUpperCase();
    }
  };

  const fullName = personFields
    ? [personFields.firstName, personFields.middleName, personFields.lastName].filter(Boolean).join(' ').trim()
    : '';

  const addressLine = personFields?.address || '—';
  const cityLine = personFields?.city || personFields?.state
    ? `${personFields?.city ?? ''}${personFields?.city && personFields?.state ? ', ' : ''}${personFields?.state ?? ''} ${personFields?.postalCode ?? ''}`.trim()
    : '—';

  const genderLabel = getGenderLabel(personFields?.genderCode);
  const idNumber = personFields?.licenseNumber || '—';

  const isPass = result === 'pass';
  const statusText = isPass ? 'OVER 21' : parseError === 'ID expired' ? 'ID EXPIRED' : 'UNDER 21';
  const statusDescription = parseError
    ? parseError
    : isPass
    ? 'Customer meets the 21+ requirement'
    : 'Unable to verify ID. Please check manually.';
  const statusStyle = isPass ? styles.statusPass : styles.statusFail;

  return (
    <TouchableWithoutFeedback onPress={ensureFocus}>
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

      {/* Keep a hidden input focused so the scanner can type into it */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={raw}
        onChangeText={(text) => {
          setRaw(text);
          const shouldParse = text.length > 30 && (
            text.endsWith('\n') ||
            text.endsWith('\r') ||
            text.endsWith('\t') ||
            text.endsWith('\0') ||
            text.length > 80
          );

          if (shouldParse) {
            console.log('[AgeCheck] Triggering parse, text length:', text.length);
            setLastScanData(text.substring(0, 500));
            setTimeout(() => {
              const trimmed = text.trim();
              const parsed = parsePDF417(trimmed);
              const d = parsed.dob || null;
              const e = parsed.expiry || null;
              setDob(d);
              setExpiry(e);
              setPersonFields(parsed.fields || null);
              const a = calcAge(d);
              setAge(a);

              console.log('[AgeCheck] Parse result:', { dob: d, expiry: e, age: a, fields: parsed.fields });

              let pass = false;
              let errorMsg: string | null = null;

              if (d && a !== null) {
                pass = a >= 21;
                if (!pass) {
                  errorMsg = 'Customer under 21';
                }
                if (e && e.getTime() < Date.now()) {
                  pass = false;
                  errorMsg = 'ID expired';
                }
              } else {
                pass = false;
                errorMsg = 'Could not parse date of birth from ID';
              }

              setResult(pass ? 'pass' : 'fail');
              setParseError(errorMsg);

              if (d) {
                handleLog().catch(() => {});
              } else {
                console.warn('[AgeCheck] Could not parse DOB from barcode, not logging');
              }
              setRaw('');
            }, 150);
          }
        }}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType="default"
        returnKeyType="done"
        showSoftInputOnFocus={false}
        blurOnSubmit={false}
        onBlur={ensureFocus}
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
          <View style={[styles.statusBanner, statusStyle]}>
            <Text style={styles.statusText}>{statusText}</Text>
            <Text style={styles.statusSubtext}>{statusDescription}</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>F:</Text>
                <Text style={styles.infoValue}>{personFields?.firstName || '—'}</Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>S:</Text>
                <Text style={styles.infoValue}>{genderLabel}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>L:</Text>
                <Text style={styles.infoValue}>{personFields?.lastName || '—'}</Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>ID:</Text>
                <Text style={styles.infoValue}>{idNumber}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoCellWide}>
                <Text style={styles.infoLabel}>A:</Text>
                <Text style={styles.infoValue}>{addressLine}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoCellWide}>
                <Text style={styles.infoLabel}>C/S/Z:</Text>
                <Text style={styles.infoValue}>{cityLine}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>DOB:</Text>
                <Text style={styles.infoValue}>{formatDateDisplay(dob)}</Text>
              </View>
              <View style={styles.infoCell}>
                <Text style={styles.infoLabel}>Exp:</Text>
                <Text style={styles.infoValue}>{formatDateDisplay(expiry)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.ageCard}>
            <Text style={[styles.ageTitle, isPass ? styles.ageTitlePass : styles.ageTitleFail]}>
              {isPass ? 'AGE VERIFIED' : 'CHECK REQUIRED'}
            </Text>
            <View style={styles.ageDisplay}>
              <Text style={styles.ageNumber}>{age ?? '--'}</Text>
              <Text style={styles.ageCaption}>YEARS OLD</Text>
            </View>
            <Text style={styles.over21Text}>
              {isPass ? 'OVER 21' : 'UNDER 21'}
            </Text>
          </View>

          {parseError && lastScanData && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugLabel}>Debug Info (first 200 chars):</Text>
              <Text style={styles.debugText} selectable>
                {lastScanData.substring(0, 200)}
              </Text>
            </View>
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
    </TouchableWithoutFeedback>
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
  statusBanner: {
    width: '100%',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statusPass: {
    backgroundColor: '#16a34a',
  },
  statusFail: {
    backgroundColor: '#dc2626',
  },
  statusText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusSubtext: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  infoCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCellWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontWeight: '700',
    color: '#111827',
    marginRight: 6,
  },
  infoValue: {
    fontWeight: '600',
    color: '#1f2937',
    flexShrink: 1,
  },
  ageCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  ageTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  ageTitlePass: {
    color: '#16a34a',
  },
  ageTitleFail: {
    color: '#dc2626',
  },
  ageDisplay: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 180,
  },
  ageNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: '#111827',
  },
  ageCaption: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    letterSpacing: 1,
  },
  over21Text: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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


