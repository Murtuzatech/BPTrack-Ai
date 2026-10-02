import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../providers/AuthProvider';
import { Colors } from '../../../constants/theme';

const { width } = Dimensions.get('window');

interface TrendReading {
  day: string;
  sys: number;
  dia: number;
}

export default function Dashboard() {
  const { session } = useAuth();
  const router = useRouter();
  const [latestBP, setLatestBP] = useState<any>(null);
  const [weeklyTrends, setWeeklyTrends] = useState<TrendReading[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      // 1. Fetch latest reading
      const { data: latestData } = await supabase
        .from('bp_readings')
        .select('*')
        .eq('user_id', session.user.id)
        .order('reading_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestData) {
        setLatestBP(latestData);
      }

      // 2. Fetch past 7 readings for the trend graph
      const { data: trendData } = await supabase
        .from('bp_readings')
        .select('systolic, diastolic, reading_time')
        .eq('user_id', session.user.id)
        .order('reading_time', { ascending: false })
        .limit(7);

      if (trendData && trendData.length > 0) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const formatted = trendData
          .reverse()
          .map((item: any) => {
            const date = new Date(item.reading_time);
            return {
              day: days[date.getDay()],
              sys: Number(item.systolic),
              dia: Number(item.diastolic),
            };
          });
        setWeeklyTrends(formatted);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [session]);

  const getStatusColor = (category?: string) => {
    switch (category) {
      case 'Normal':
        return { bg: '#DCFCE7', text: '#15803D' };
      case 'Elevated':
        return { bg: '#FEF9C3', text: '#A16207' };
      case 'High BP (Stage 1)':
        return { bg: '#FFEDD5', text: '#C2410C' };
      case 'High BP (Stage 2)':
        return { bg: '#FEE2E2', text: '#B91C1C' };
      case 'Crisis':
        return { bg: '#FFE4E6', text: '#BE123C' };
      default:
        return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  const statusStyle = getStatusColor(latestBP?.category);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchDashboardData} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Morning,</Text>
          <Text style={styles.userName}>
            {session?.user?.user_metadata?.full_name || 'Murtaza'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notificationBtn}
          onPress={() => router.push('/(main)/(tabs)/profile' as any)}
        >
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* BP Card */}
      <View style={styles.bpCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTag}>Today's BP</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {latestBP ? latestBP.category : 'No Data'}
            </Text>
          </View>
        </View>

        <View style={styles.readingRow}>
          <Text style={styles.metricLarge}>
            {latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : '--/--'}
          </Text>
          <Text style={styles.unit}>mmHg</Text>
        </View>

        <Text style={styles.pulseText}>
          Pulse:{' '}
          <Text style={{ fontWeight: '700', color: Colors.text }}>
            {latestBP?.pulse || '--'} BPM
          </Text>
        </Text>
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
          onPress={() => router.push('/(main)/(tabs)/manual-entry' as any)}
        >
          <Text style={styles.actionIcon}>✍️</Text>
          <Text style={styles.actionText}>Manual Entry</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#0284C7' }]}
          onPress={() => router.push('/(main)/(tabs)/scan' as any)}
        >
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionText}>Scan BP Monitor</Text>
        </TouchableOpacity>
      </View>

      {/* AI Health Assistant Banner */}
      <TouchableOpacity
        style={styles.aiBanner}
        onPress={() => router.push('/(main)/(tabs)/ai-assistant' as any)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.aiTitle}>✨ AI Health Advisor</Text>
          <Text style={styles.aiSubtitle}>
            Ask about your BP, get diet tips & guided videos
          </Text>
        </View>
        <Text style={{ fontSize: 24 }}>💬</Text>
      </TouchableOpacity>

      {/* 30-Day Monitoring */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.sectionTitle}>30-Day Monitoring</Text>
          <Text style={styles.progressCounter}>12 / 30 days</Text>
        </View>
        <Text style={styles.progressSubtext}>
          Consistency keeps your heart healthy
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '40%' }]} />
        </View>
      </View>

      {/* 7-Day BP Trend Chart */}
      <View style={styles.trendCard}>
        <View style={styles.trendHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>7-Day BP Trend</Text>
            <Text style={styles.trendSub}>Systolic & Diastolic readings</Text>
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
              <Text style={styles.legendLabel}>SYS</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
              <Text style={styles.legendLabel}>DIA</Text>
            </View>
          </View>
        </View>

        {weeklyTrends.length === 0 ? (
          <View style={styles.emptyChartBox}>
            <Text style={{ color: Colors.textMuted, fontSize: 13 }}>
              Log readings to view your weekly trend
            </Text>
          </View>
        ) : (
          <View style={styles.barsContainer}>
            {weeklyTrends.map((item, idx) => {
              // Scale graph bars proportionally (max reference 200 mmHg)
              const sysHeight = Math.min(Math.max((item.sys / 200) * 90, 16), 90);
              const diaHeight = Math.min(Math.max((item.dia / 200) * 90, 12), 90);

              return (
                <View key={idx} style={styles.barGroup}>
                  <View style={styles.barsWrapper}>
                    {/* Systolic Bar */}
                    <View
                      style={[
                        styles.bar,
                        { height: sysHeight, backgroundColor: '#0284C7' },
                      ]}
                    />
                    {/* Diastolic Bar */}
                    <View
                      style={[
                        styles.bar,
                        { height: diaHeight, backgroundColor: '#38BDF8' },
                      ]}
                    />
                  </View>
                  <Text style={styles.barDayText}>{item.day}</Text>
                  <Text style={styles.barValText}>{item.sys}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bpCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTag: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 12,
  },
  metricLarge: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
  },
  unit: {
    fontSize: 16,
    color: Colors.textMuted,
    marginLeft: 8,
    fontWeight: '500',
  },
  pulseText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    height: 60,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  aiBanner: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0369A1',
  },
  aiSubtitle: {
    fontSize: 12,
    color: '#0284C7',
    marginTop: 4,
  },
  progressCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  progressCounter: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  progressSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  trendCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 40,
  },
  trendHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  trendSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  emptyChartBox: {
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 16,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  barGroup: {
    alignItems: 'center',
    width: (width - 80) / 7,
  },
  barsWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 90,
  },
  bar: {
    width: 8,
    borderRadius: 4,
  },
  barDayText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    fontWeight: '600',
  },
  barValText: {
    fontSize: 9,
    color: '#0284C7',
    fontWeight: '700',
    marginTop: 2,
  },
});