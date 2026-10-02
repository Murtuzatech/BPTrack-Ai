import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../providers/AuthProvider';
import { Colors } from '../../../constants/theme';

export default function History() {
  const { session } = useAuth();
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('bp_readings')
      .select('*')
      .eq('user_id', session.user.id)
      .order('reading_time', { ascending: false });

    if (data) setReadings(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [session]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BP History</Text>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={readings}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>No BP records yet. Add one from Home!</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View>
                <Text style={styles.bpVal}>
                  {item.systolic}/{item.diastolic} <Text style={styles.unit}>mmHg</Text>
                </Text>
                <Text style={styles.sub}>
                  Pulse: {item.pulse || '--'} BPM • {new Date(item.reading_time).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.category}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
    paddingTop: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: Colors.textMuted,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bpVal: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  unit: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  sub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  badge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
});