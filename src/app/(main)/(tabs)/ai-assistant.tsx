import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../providers/AuthProvider';
import { Colors } from '../../../constants/theme';

const Speech = require('expo-speech');
const ImagePicker = require('expo-image-picker');

const RAW_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_API_KEY = RAW_KEY.replace(/['"]/g, '').trim();

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  imageUri?: string;
  isVoice?: boolean;
  videos?: { id: string; title: string; url: string }[];
}

export default function AIAssistant() {
  const router = useRouter();
  const { session } = useAuth();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('Friend');
  const [greeting, setGreeting] = useState('Hello');
  const [subWish, setSubWish] = useState('How can I help with your health today?');

  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const fetchUserDataAndGreeting = async () => {
      let name = session?.user?.user_metadata?.full_name;
      if (!name && session?.user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle();
        if (data?.full_name) {
          name = data.full_name;
        }
      }

      if (name) {
        setDisplayName(name.trim().split(' ')[0]);
      } else {
        setDisplayName('there');
      }

      const currentHour = new Date().getHours();
      const morningWishes = [
        'Have a wonderful and energetic day ahead!',
        'Wishing you a healthy and calm morning.',
        'Take care of your heart health today!',
      ];
      const afternoonWishes = [
        'Hope your day is going smoothly!',
        'Stay hydrated and remember to take deep breaths.',
        'Take short walking breaks to stay active.',
      ];
      const eveningWishes = [
        'Have a peaceful and relaxing evening!',
        'Unwind and let go of today’s stress.',
        'Hope you had a healthy and productive day!',
      ];
      const nightWishes = [
        'Rest well and have a peaceful night!',
        'Quality sleep is essential for healthy blood pressure.',
        'Wishing you deep and restful sleep tonight.',
      ];

      const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

      if (currentHour >= 4 && currentHour < 12) {
        setGreeting('Good Morning');
        setSubWish(getRandom(morningWishes));
      } else if (currentHour >= 12 && currentHour < 17) {
        setGreeting('Good Afternoon');
        setSubWish(getRandom(afternoonWishes));
      } else if (currentHour >= 17 && currentHour < 21) {
        setGreeting('Good Evening');
        setSubWish(getRandom(eveningWishes));
      } else {
        setGreeting('Good Night');
        setSubWish(getRandom(nightWishes));
      }
    };

    fetchUserDataAndGreeting();
  }, [session]);

  const handleSpeak = (text: string, id: string) => {
    try {
      if (speakingId === id) {
        Speech.stop();
        setSpeakingId(null);
        return;
      }

      Speech.stop();
      setSpeakingId(id);

      const isHindi = /[\u0900-\u097F]/.test(text);

      Speech.speak(text, {
        language: isHindi ? 'hi-IN' : 'en-US',
        pitch: 1.0,
        rate: 0.95,
        onDone: () => setSpeakingId(null),
        onStopped: () => setSpeakingId(null),
        onError: () => setSpeakingId(null),
      });
    } catch (e) {
      setSpeakingId(null);
    }
  };

  const callGeminiAI = async (userPrompt: string, base64Image?: string): Promise<string> => {
    if (!GEMINI_API_KEY) {
      return 'API Key not found. Please verify EXPO_PUBLIC_GEMINI_API_KEY in your .env file.';
    }

    try {
      // Key is sent in the header, NOT in the URL
      const endpoint =
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

      const contentsParts: any[] = [];
      const systemPrompt = `You are BPTrack AI, a helpful, intelligent, empathetic, and natural health companion specializing in cardiovascular and blood pressure care.
Strict Instructions:
1. Always mirror the user's language:
   - If user writes in Hinglish (e.g., "hi", "kaise ho", "mera bp kaisa h"), reply warmly in natural Hinglish.
   - If user writes in English, reply in English.
   - If user writes in Hindi script, reply in Hindi script.
2. For greetings ("hi", "hello"), greet warmly and ask how their health or blood pressure feels today.
3. Keep health answers clear, empathetic, and concise.`;

      if (base64Image) {
        contentsParts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Image,
          },
        });
      }

      contentsParts.push({
        text: `${systemPrompt}\n\nUser: ${userPrompt}`,
      });

      // Retry automatically when Google is temporarily overloaded (503) or rate limited (429)
      let json: any = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ parts: contentsParts }],
          }),
        });

        json = await response.json();
        console.log(`Gemini API Result (attempt ${attempt}):`, json);

        const code = json?.error?.code;
        if (code === 503 || code === 429) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          continue;
        }
        break;
      }

      if (json?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return json.candidates[0].content.parts[0].text.trim();
      } else if (json?.error?.message) {
        return `API Error: ${json.error.message}`;
      } else {
        return "I'm having trouble analyzing this right now. Please try again.";
      }
    } catch (error: any) {
      console.error('Gemini Fetch Error:', error);
      return 'Network error. Please check your connection and try again.';
    }
  };

  const generateAIResponse = async (
    userPrompt: string,
    isFromVoice: boolean = false,
    base64Image?: string
  ) => {
    setLoading(true);

    const aiAnswer = await callGeminiAI(userPrompt, base64Image);

    let recommendedVideos: { id: string; title: string; url: string }[] | undefined = undefined;
    const lower = userPrompt.toLowerCase();

    if (
      lower.includes('high') ||
      lower.includes('bp') ||
      lower.includes('dizzy') ||
      lower.includes('stress') ||
      lower.includes('चक्कर') ||
      lower.includes('बीपी')
    ) {
      recommendedVideos = [
        {
          id: 'v1',
          title: '5-Minute Guided Breathing Exercise to Lower BP',
          url: 'https://www.youtube.com/watch?v=inpok4MKVLM',
        },
        {
          id: 'v2',
          title: 'Immediate Natural Ways to Calm High Blood Pressure',
          url: 'https://www.youtube.com/results?search_query=how+to+lower+blood+pressure+naturally',
        },
      ];
    } else if (
      lower.includes('diet') ||
      lower.includes('food') ||
      lower.includes('eat') ||
      lower.includes('khana') ||
      lower.includes('खाना')
    ) {
      recommendedVideos = [
        {
          id: 'v3',
          title: 'DASH Diet Meal Plan for Blood Pressure Management',
          url: 'https://www.youtube.com/results?search_query=dash+diet+for+hypertension',
        },
      ];
    }

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: aiAnswer,
      videos: recommendedVideos,
    };

    setMessages((prev) => [...prev, aiMsg]);
    setLoading(false);

    if (isFromVoice) {
      handleSpeak(aiAnswer, aiMsg.id);
    }
  };

  const handleSendText = (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      isVoice: false,
    };
    setMessages((prev) => [...prev, userMsg]);
    generateAIResponse(text, false);
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Gallery access is needed to upload your medical report.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const userMsg: Message = {
          id: Date.now().toString(),
          sender: 'user',
          text: 'Uploaded Medical Report Image:',
          imageUri: asset.uri,
          isVoice: false,
        };
        setMessages((prev) => [...prev, userMsg]);
        generateAIResponse(
          'Please analyze this medical report image, explain the readings, and provide precautions.',
          false,
          asset.base64 || undefined
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Unable to pick image. Please try again.');
    }
  };

  const handleVoiceButtonClick = () => {
    Alert.alert('Voice Query (बोलकर पूछें)', 'Choose a health question:', [
      {
        text: '🩺 BP feels high / बीपी बढ़ गया है',
        onPress: () => {
          const prompt =
            'Mera blood pressure badh gaya hai aur ghabrahat ho rahi hai. Mujhe turant kya karna chahiye?';
          const userMsg: Message = {
            id: Date.now().toString(),
            sender: 'user',
            text: '🎙 ' + prompt,
            isVoice: true,
          };
          setMessages((prev) => [...prev, userMsg]);
          generateAIResponse(prompt, true);
        },
      },
      {
        text: '🥗 Best diet for BP / खाने में क्या लें?',
        onPress: () => {
          const prompt =
            'Blood pressure control rakhne ke liye diet me kya khana chahiye aur kya avoid karein?';
          const userMsg: Message = {
            id: Date.now().toString(),
            sender: 'user',
            text: '🎙 ' + prompt,
            isVoice: true,
          };
          setMessages((prev) => [...prev, userMsg]);
          generateAIResponse(prompt, true);
        },
      },
      {
        text: '🧘 Quick breathing exercise',
        onPress: () => {
          const prompt =
            'Guide me through a simple breathing exercise to relax and lower blood pressure.';
          const userMsg: Message = {
            id: Date.now().toString(),
            sender: 'user',
            text: '🎙 ' + prompt,
            isVoice: true,
          };
          setMessages((prev) => [...prev, userMsg]);
          generateAIResponse(prompt, true);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            try {
              Speech.stop();
            } catch (e) { }
            router.back();
          }}
          style={styles.backBtn}
        >
          <Text style={{ fontSize: 18, color: '#0F172A' }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Health Advisor</Text>
        <View style={{ width: 40 }} />
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyWelcomeContainer}>
          <Text style={styles.geminiSparkle}>✨</Text>
          <Text style={styles.greetingTitle}>
            {greeting},{'\n'}
            <Text style={styles.highlightName}>{displayName}</Text>
          </Text>
          <Text style={styles.greetingSubtitle}>{subWish}</Text>

          <View style={styles.chipsContainer}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => handleSendText('How to lower BP instantly?')}
            >
              <Text style={styles.chipText}>⚡ Lower BP instantly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => handleSendText('Best diet for blood pressure')}
            >
              <Text style={styles.chipText}>🥗 Best diet for BP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => handleSendText('Breathing exercises for relaxation')}
            >
              <Text style={styles.chipText}>🧘 Breathing exercises</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatList}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.sender === 'user' ? styles.userBubble : styles.aiBubble,
              ]}
            >
              {item.imageUri && (
                <Image source={{ uri: item.imageUri }} style={styles.previewImage} />
              )}

              <View style={styles.messageContentRow}>
                <Text
                  style={[
                    styles.messageText,
                    item.sender === 'user' ? styles.userText : styles.aiText,
                  ]}
                >
                  {item.text}
                </Text>

                {item.sender === 'ai' && (
                  <TouchableOpacity
                    style={styles.speakerBtn}
                    onPress={() => handleSpeak(item.text, item.id)}
                  >
                    <Text style={{ fontSize: 18 }}>
                      {speakingId === item.id ? '🔊' : '🔈'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {item.videos && (
                <View style={styles.videoContainer}>
                  <Text style={styles.videoSectionTitle}>Recommended Wellness Videos:</Text>
                  {item.videos.map((vid) => (
                    <TouchableOpacity
                      key={vid.id}
                      style={styles.videoCard}
                      onPress={() => Linking.openURL(vid.url)}
                    >
                      <Text style={styles.videoIcon}>▶</Text>
                      <Text style={styles.videoTitle} numberOfLines={2}>
                        {vid.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      )}

      {loading && (
        <View style={styles.aiLoadingBar}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.aiLoadingText}>Gemini AI is thinking...</Text>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputContainerWrapper}>
        <View style={styles.capsuleBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={handlePickImage}>
            <Text style={styles.plusIcon}>+</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Ask about your health..."
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSendText()}
            returnKeyType="send"
          />

          <TouchableOpacity style={styles.iconBtn} onPress={handleVoiceButtonClick}>
            <Text style={{ fontSize: 20 }}>🎙</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendBtnCircle, { opacity: input.trim().length > 0 ? 1 : 0.6 }]}
            onPress={() => handleSendText()}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyWelcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  geminiSparkle: {
    fontSize: 36,
    marginBottom: 10,
  },
  greetingTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  highlightName: {
    color: '#0284C7',
  },
  greetingSubtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 22,
  },
  chipsContainer: {
    marginTop: 24,
    gap: 10,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  chatList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 18,
    marginVertical: 4,
  },
  messageContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0284C7',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
    minWidth: 120,
  },
  previewImage: {
    width: 220,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
  },
  speakerBtn: {
    padding: 2,
    marginLeft: 8,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  aiText: {
    color: '#0F172A',
    fontWeight: '400',
  },
  videoContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    gap: 8,
  },
  videoSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  videoIcon: {
    fontSize: 18,
  },
  videoTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  aiLoadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  aiLoadingText: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  inputContainerWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  capsuleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    fontSize: 26,
    color: '#64748B',
    fontWeight: '400',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  sendBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  sendIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});