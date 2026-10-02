import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../providers/AuthProvider';

interface BPRecord {
  id: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  category: string;
  notes: string | null;
  created_at: string;
}

export default function ReportsScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [readings, setReadings] = useState<BPRecord[]>([]);
  const [userName, setUserName] = useState('Patient');

  useEffect(() => {
    fetchReportData();
  }, [session]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const name = session?.user?.user_metadata?.full_name;
      if (name) {
        setUserName(name);
      } else if (session?.user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle();
        if (prof?.full_name) setUserName(prof.full_name);
      }

      // Fetch last 30 days of BP records
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('bp_readings')
        .select('*')
        .eq('user_id', session?.user?.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (!error && data) {
        setReadings(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Calculations for 30-Day Summary
  const totalReadings = readings.length;
  const avgSys =
    totalReadings > 0
      ? Math.round(readings.reduce((acc, curr) => acc + curr.systolic, 0) / totalReadings)
      : 0;
  const avgDia =
    totalReadings > 0
      ? Math.round(readings.reduce((acc, curr) => acc + curr.diastolic, 0) / totalReadings)
      : 0;
  const avgPulse =
    totalReadings > 0
      ? Math.round(
          readings.reduce((acc, curr) => acc + (curr.pulse || 0), 0) /
            (readings.filter((r) => r.pulse).length || 1)
        )
      : 0;

  const maxSys = totalReadings > 0 ? Math.max(...readings.map((r) => r.systolic)) : 0;
  const minSys = totalReadings > 0 ? Math.min(...readings.map((r) => r.systolic)) : 0;

  // Generate Professional Clinical HTML for PDF
  const createHTMLReport = () => {
    const tableRows = readings
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">
            ${new Date(item.created_at).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: bold; color: #0F172A;">
            ${item.systolic} / ${item.diastolic} mmHg
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">
            ${item.pulse ? `${item.pulse} BPM` : '--'}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">
            <span style="background-color: #E0F2FE; color: #0284C7; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600;">
              ${item.category}
            </span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B;">
            ${item.notes || 'Routine check'}
          </td>
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>BPTrack AI Health Report</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 30px; color: #1E293B; }
          .header { border-bottom: 2px solid #0284C7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 24px; font-weight: 800; color: #0284C7; margin: 0; }
          .subtitle { font-size: 13px; color: #64748B; margin-top: 4px; }
          .patient-box { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
          .stats-grid { display: flex; gap: 12px; margin-bottom: 28px; }
          .stat-card { flex: 1; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; text-align: center; }
          .stat-val { font-size: 20px; font-weight: 800; color: #0F172A; }
          .stat-label { font-size: 12px; color: #64748B; margin-top: 4px; font-weight: 600; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { text-align: left; padding: 10px; background-color: #F1F5F9; color: #475569; font-size: 12px; text-transform: uppercase; font-weight: 700; border-radius: 4px; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">BPTrack AI — 30-Day Health Report</h1>
            <div class="subtitle">Cardiovascular & Blood Pressure Summary</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748B;">
            Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        </div>

        <div class="patient-box">
          <div style="font-size: 15px; font-weight: 700; color: #0F172A;">Patient Name: ${userName}</div>
          <div style="font-size: 13px; color: #64748B; margin-top: 4px;">Reporting Period: Past 30 Days (${totalReadings} Total Logs)</div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-val" style="color: #0284C7;">${avgSys}/${avgDia}</div>
            <div class="stat-label">Average BP (mmHg)</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${avgPulse || '--'}</div>
            <div class="stat-label">Avg Pulse (BPM)</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #DC2626;">${maxSys}</div>
            <div class="stat-label">Highest SYS</div>
          </div>
          <div class="stat-card">
            <div class="stat-val" style="color: #16A34A;">${minSys}</div>
            <div class="stat-label">Lowest SYS</div>
          </div>
        </div>

        <h3 style="font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 12px;">Detailed Log History</h3>
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Reading</th>
              <th>Pulse</th>
              <th>Status</th>
              <th>Doctor Notes</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.length > 0 ? tableRows : '<tr><td colspan="5" style="text-align:center; padding: 20px;">No readings found for the last 30 days.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Generated automatically by BPTrack AI Health Monitor. This report is for tracking assistance and should be shared with a certified medical practitioner.
        </div>
      </body>
      </html>
    `;
  };

  // 1. Download / Print PDF
  const handleDownloadPDF = async () => {
    if (readings.length === 0) {
      Alert.alert('No Data', 'Add some BP readings first before generating a report.');
      return;
    }

    try {
      setGenerating(true);
      const html = createHTMLReport();
      await Print.printAsync({ html });
      setGenerating(false);
    } catch (err: any) {
      setGenerating(false);
      Alert.alert('Error', err.message || 'Failed to generate PDF.');
    }
  };

  // 2. Direct Share via WhatsApp / Messaging
  const handleShareWhatsApp = async () => {
    if (readings.length === 0) {
      Alert.alert('No Data', 'No BP records available to share.');
      return;
    }

    try {
      setGenerating(true);
      const html = createHTMLReport();
      const { uri } = await Print.printToFileAsync({ html });
      setGenerating(false);

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share BP Health Report via WhatsApp',
        });
      } else {
        const textSummary = `🩺 *BPTrack AI - 30-Day Health Report*\n👤 Patient: ${userName}\n📊 Average BP: ${avgSys}/${avgDia} mmHg (Pulse: ${avgPulse} BPM)\n🔴 Highest BP: ${maxSys} mmHg\n🟢 Lowest BP: ${minSys} mmHg\n\nTotal logs in last 30 days: ${totalReadings}`;
        await Share.share({ message: textSummary });
      }
    } catch (err: any) {
      setGenerating(false);
      const textSummary = `🩺 *BPTrack AI - 30-Day Health Report*\n👤 Patient: ${userName}\n📊 Average BP: ${avgSys}/${avgDia} mmHg (Pulse: ${avgPulse} BPM)\n🔴 Highest BP: ${maxSys} mmHg\n🟢 Lowest BP: ${minSys} mmHg\n\nTotal logs in last 30 days: ${totalReadings}`;
      await Share.share({ message: textSummary });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0284C7" />
        <Text style={styles.loadingText}>Compiling 30-day health analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Monthly Health Report</Text>
      <Text style={styles.subtitle}>Last 30 days cardiovascular summary & trends</Text>

      {/* Analytics Summary Cards */}
      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {avgSys}/{avgDia}
          </Text>
          <Text style={styles.statLabel}>30-Day Avg BP</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{avgPulse || '--'}</Text>
          <Text style={styles.statLabel}>Avg Pulse</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: '#0284C7' }]}>{totalReadings}</Text>
          <Text style={styles.statLabel}>Total Checks</Text>
        </View>
      </View>

      {/* Min / Max Row */}
      <View style={styles.minMaxRow}>
        <View style={[styles.badgeCard, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
          <Text style={styles.badgeTitle}>Max Systolic</Text>
          <Text style={[styles.badgeValue, { color: '#DC2626' }]}>{maxSys} mmHg</Text>
        </View>
        <View style={[styles.badgeCard, { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }]}>
          <Text style={styles.badgeTitle}>Min Systolic</Text>
          <Text style={[styles.badgeValue, { color: '#16A34A' }]}>{minSys} mmHg</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.btn, styles.downloadBtn, generating && { opacity: 0.7 }]}
          onPress={handleDownloadPDF}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.btnIcon}>📄</Text>
              <Text style={styles.btnText}>Download PDF Report</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.whatsappBtn, generating && { opacity: 0.7 }]}
          onPress={handleShareWhatsApp}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.btnIcon}>💬</Text>
              <Text style={styles.btnText}>Share via WhatsApp</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Recent Records Preview */}
      <Text style={styles.sectionHeader}>Included Logs ({readings.length})</Text>
      {readings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No readings logged in the past 30 days.</Text>
        </View>
      ) : (
        readings.slice(0, 10).map((item) => (
          <View key={item.id} style={styles.logCard}>
            <View>
              <Text style={styles.logBP}>
                {item.systolic}/{item.diastolic}{' '}
                <Text style={styles.unit}>mmHg</Text>
              </Text>
              <Text style={styles.logDate}>
                {new Date(item.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.catBadge}>
              <Text style={styles.catText}>{item.category}</Text>
            </View>
          </View>
        ))
      )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 20,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 14,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 35,
    backgroundColor: '#E2E8F0',
  },
  minMaxRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  badgeCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  badgeValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  actionContainer: {
    gap: 12,
    marginBottom: 28,
  },
  btn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  downloadBtn: {
    backgroundColor: '#0284C7',
  },
  whatsappBtn: {
    backgroundColor: '#16A34A',
  },
  btnIcon: {
    fontSize: 18,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  logBP: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  unit: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '400',
  },
  logDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  catBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  catText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '600',
  },
});