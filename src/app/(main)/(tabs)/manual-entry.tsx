import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../providers/AuthProvider';

export default function ManualEntryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ sys?: string; dia?: string; pulse?: string }>();

  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-fill values when coming from Scan Screen
  useEffect(() => {
    if (params.sys) setSystolic(params.sys);
    if (params.dia) setDiastolic(params.dia);
    if (params.pulse) setPulse(params.pulse);
  }, [params.sys, params.dia, params.pulse]);

  const getBPCategory = (sys: number, dia: number) => {
    if (sys > 180 || dia > 120) return 'Crisis';
    if (sys >= 140 || dia >= 90) return 'High BP (Stage 2)';
    if (sys >= 130 || dia >= 80) return 'High BP (Stage 1)';
    if (sys >= 120 && dia < 80) return 'Elevated';
    return 'Normal';
  };

  const handleSave = async () => {
    const sysNum = parseInt(systolic, 10);
    const diaNum = parseInt(diastolic, 10);
    const pulseNum = pulse ? parseInt(pulse, 10) : null;

    if (isNaN(sysNum) || isNaN(diaNum) || sysNum <= 0 || diaNum <= 0) {
      Alert.alert('Missing Info', 'Please enter valid Systolic and Diastolic numbers.');
      return;
    }

    if (!session?.user?.id) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }

    try {
      setLoading(true);
      const category = getBPCategory(sysNum, diaNum);

      const { error } = await supabase.from('bp_readings').insert({
        user_id: session.user.id,
        systolic: sysNum,
        diastolic: diaNum,
        pulse: pulseNum,
        category: category,
        notes: notes.trim() || (params.sys ? 'Scanned from BP Monitor' : 'Manual Entry'),
      });

      setLoading(false);

      if (error) {
        Alert.alert('Save Failed', error.message);
      } else {
        Alert.alert('Success', 'BP reading recorded successfully!', [
          {
            text: 'OK',
            onPress: () => router.push('/(main)/(tabs)/dashboard'),
          },
        ]);
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Error', err.message || 'Something went wrong.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add BP Reading</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.formCard}>
        {/* Systolic */}
        <Text style={styles.label}>Systolic (mmHg) - High Number</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 120"
          placeholderTextColor="#94A3B8"
          value={systolic}
          onChangeText={setSystolic}
        />

        {/* Diastolic */}
        <Text style={styles.label}>Diastolic (mmHg) - Low Number</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 80"
          placeholderTextColor="#94A3B8"
          value={diastolic}
          onChangeText={setDiastolic}
        />

        {/* Pulse */}
        <Text style={styles.label}>Pulse (BPM) - Optional</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 72"
          placeholderTextColor="#94A3B8"
          value={pulse}
          onChangeText={setPulse}
        />

        {/* Notes */}
        <Text style={styles.label}>Notes / Symptoms (Optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="e.g. After morning walk, felt slight headache..."
          placeholderTextColor="#94A3B8"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save Reading</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backArrow: {
    fontSize: 20,
    color: '#0F172A',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notesInput: {
    height: 90,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});