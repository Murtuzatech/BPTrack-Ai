import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const RAW_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_API_KEY = RAW_KEY.replace(/['"]/g, '').trim();

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Reading Monitor Display...');
  const cameraRef = useRef<any>(null);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0284C7" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permText}>Camera permission is required to scan BP Monitor.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const parseBPImage = async (base64Image: string) => {
    if (!GEMINI_API_KEY) {
      Alert.alert('Configuration Error', 'Gemini API Key missing in .env');
      return null;
    }

    const endpoint =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

    const prompt = `Look at this digital Blood Pressure Monitor screen.
Read the 3 visible numbers:
1. SYS (Systolic - top number)
2. DIA (Diastolic - middle number)
3. PULSE (Pulse / Heart rate - bottom number)

Return ONLY valid JSON format without markdown or backticks:
{"sys": 128, "dia": 70, "pulse": 80}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) {
          setStatusMessage(`Retrying AI connection (${attempt}/3)...`);
          await new Promise((res) => setTimeout(res, 1200));
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
                  { text: prompt },
                ],
              },
            ],
          }),
        });

        if (response.status === 503 || response.status === 429) {
          continue;
        }

        const json = await response.json();
        const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);

        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.sys && parsed.dia) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn('API error:', err);
      }
    }
    return null;
  };

  const handleCapture = async () => {
    if (!cameraRef.current || scanning) return;

    try {
      setScanning(true);
      setStatusMessage('Capturing Image...');

      // Quality 0.4 keeps payload light to prevent 503 server timeout
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: true,
      });

      if (!photo?.base64) {
        Alert.alert('Error', 'Could not capture photo. Try again.');
        setScanning(false);
        return;
      }

      setStatusMessage('Extracting Numbers (SYS, DIA, PULSE)...');
      const readings = await parseBPImage(photo.base64);

      setScanning(false);

      if (readings && readings.sys && readings.dia) {
        // Redirect directly to manual entry screen with autofilled readings
        router.push({
          pathname: '/(main)/(tabs)/manual-entry',
          params: {
            sys: String(readings.sys),
            dia: String(readings.dia),
            pulse: readings.pulse ? String(readings.pulse) : '',
          },
        });
      } else {
        Alert.alert(
          'Could Not Read Numbers',
          'Ensure the BP monitor screen is well-lit and clearly visible within the frame.',
          [
            { text: 'Try Again', style: 'default' },
            {
              text: 'Enter Manually',
              onPress: () => router.push('/(main)/(tabs)/manual-entry'),
            },
          ]
        );
      }
    } catch (e: any) {
      setScanning(false);
      Alert.alert('Scan Failed', e.message || 'Something went wrong.');
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan BP Monitor</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.subtitle}>Hold steady — Align screen inside box</Text>

        <View style={styles.frame}>
          <View style={styles.hintTag}>
            <Text style={styles.hintText}>SYS (Top)</Text>
          </View>
          <View style={styles.hintTag}>
            <Text style={styles.hintText}>DIA (Middle)</Text>
          </View>
          <View style={styles.hintTag}>
            <Text style={styles.hintText}>PULSE (Bottom)</Text>
          </View>
        </View>

        <View style={styles.bottomBar}>
          {scanning ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.scanningText}>{statusMessage}</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.shutterBtn} onPress={handleCapture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manualLink}
                onPress={() => router.push('/(main)/(tabs)/manual-entry')}
              >
                <Text style={styles.manualLinkText}>✍ Enter Manually</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 24,
  },
  permText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  permBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    color: '#FFF',
    fontSize: 20,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  frame: {
    width: width * 0.78,
    height: width * 0.78,
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  hintTag: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  hintText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  manualLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  manualLinkText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 12,
  },
  scanningText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
});