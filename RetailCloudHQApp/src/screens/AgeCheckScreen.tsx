import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { getApiBaseUrl } from '../config/api';

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

export default function AgeCheckScreen() {
  const [raw, setRaw] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [expiry, setExpiry] = useState<Date | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [result, setResult] = useState<'pass' | 'fail' | null>(null);
  const [last4, setLast4] = useState('');

  const computed = useMemo(() => {
    const a = calcAge(dob);
    const isExpired = expiry ? expiry.getTime() < Date.now() : false;
    const ok = (a ?? 0) >= 21 && !isExpired;
    return { a, isExpired, ok };
  }, [dob, expiry]);


  const handleParse = () => {
    const { dob: d, expiry: e } = parsePDF417(raw);
    setDob(d);
    setExpiry(e);
    const a = calcAge(d);
    setAge(a);
    const pass = (a ?? 0) >= 21 && !(e && e.getTime() < Date.now());
    setResult(pass ? 'pass' : 'fail');
  };

  const handleLog = async () => {
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
        id_fragment: last4 || null,
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeout: 5000,
      });
      Alert.alert('Logged', 'Age check recorded.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to log age check');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Age Checker (21+)</Text>
      <Text style={styles.subtitle}>Scan ID barcode with external scanner or paste PDF417 data</Text>

      <TextInput
        style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
        placeholder="Scan barcode or paste PDF417 raw data here..."
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
            }, 100);
          }
        }}
        placeholderTextColor="#999"
        multiline
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleParse}>
        <Text style={styles.buttonText}>Check Age</Text>
      </TouchableOpacity>

      <View style={styles.resultBox}>
        <Text style={styles.row}>
          <Text style={styles.key}>DOB: </Text>
          <Text style={styles.val}>{dob ? dob.toISOString().slice(0, 10) : '—'}</Text>
        </Text>
        <Text style={styles.row}>
          <Text style={styles.key}>Age: </Text>
          <Text style={styles.val}>{age ?? '—'}</Text>
        </Text>
        <Text style={styles.row}>
          <Text style={styles.key}>Expiry: </Text>
          <Text style={styles.val}>{expiry ? expiry.toISOString().slice(0, 10) : '—'}</Text>
        </Text>
        <Text style={styles.row}>
          <Text style={styles.key}>Result: </Text>
          <Text style={[styles.badge, result === 'pass' ? styles.pass : result === 'fail' ? styles.fail : styles.neutral]}>
            {result ? (result === 'pass' ? 'Allowed' : 'Not Allowed') : '—'}
          </Text>
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Optional: last 4 of ID to hash for audit (never stored raw)"
        value={last4}
        onChangeText={(t) => setLast4(t.replace(/[^0-9]/g, '').slice(0, 4))}
        placeholderTextColor="#999"
        keyboardType="numeric"
      />
      <TouchableOpacity style={[styles.button, { backgroundColor: '#374151' }]} onPress={handleLog} disabled={!result}>
        <Text style={styles.buttonText}>Log Check</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 12, color: '#666', marginBottom: 16, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 14, color: '#000', backgroundColor: '#fff', marginBottom: 12
  },
  button: { backgroundColor: '#2d8659', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  resultBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, marginTop: 4, marginBottom: 12 },
  row: { marginBottom: 6, fontSize: 14, color: '#111' },
  key: { fontWeight: '600', color: '#374151' },
  val: { color: '#111' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, color: '#fff', overflow: 'hidden' },
  pass: { backgroundColor: '#059669' },
  fail: { backgroundColor: '#b91c1c' },
  neutral: { backgroundColor: '#6b7280' },
});


