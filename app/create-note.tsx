import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GoogleGenerativeAI } from '@google/generative-ai';
// genAI will be initialized inside the function to ensure the API key is picked up correctly

export default function CreateNoteScreen() {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  async function startRecording() {
    try {
      console.log('Requesting permissions...');
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission denied', 'We need your permission to access the microphone.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  }

  async function stopRecording() {
    if (!recording) return;

    console.log('Stopping recording...');
    setIsRecording(false);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);
      setRecording(null);
      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }

  async function transcribeAudio(uri: string) {
    console.log('DEBUG: Starting transcription for URI:', uri);
    setTranscribing(true);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error('Gemini API key is missing. Please check your .env file.');
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      
      let base64Audio = '';
      try {
        base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
      } catch (fsError) {
        console.log('FileSystem read failed, trying fetch approach...');
        const response = await fetch(uri);
        const blob = await response.blob();
        base64Audio = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      console.log('DEBUG: Base64 length:', base64Audio.length);
      if (base64Audio.length < 100) {
        throw new Error('The recorded audio seems empty. Please try speaking for a longer time.');
      }

      const extension = uri.split('.').pop()?.toLowerCase();
      let mimeType = 'audio/mp4'; // Default to a widely supported type
      
      if (uri.startsWith('blob:')) {
        // On web, Chrome records in webm format. Gemini 1.5 Flash supports audio/webm.
        mimeType = 'audio/webm'; 
      } else {
        mimeType = extension === 'm4a' ? 'audio/x-m4a' :
                   extension === 'wav' ? 'audio/wav' :
                   extension === 'mp3' ? 'audio/mpeg' : 'audio/webm';
      }

      console.log('DEBUG: Using MIME type:', mimeType);

      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      
      // Using a more forceful prompt to prevent hallucinations
      const prompt = 'Transcribe the following audio recording exactly. Do not add any extra text, greetings, or suggestions. If you cannot hear anything, just return "..."';
      
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio
          }
        },
        { text: prompt }
      ]);

      const response = await result.response;
      const text = response.text();
      console.log('DEBUG: Transcription result:', text);
      setContent(prev => prev + (prev ? '\n\n' : '') + text);
    } catch (err: any) {
      console.error('Gemini transcription failed', err);
      Alert.alert('Transcription Error', `Failed to transcribe: ${err.message}`);
    } finally {
      setTranscribing(false);
    }
  }

  async function saveNote() {
    if (!subject.trim() || !content.trim()) {
      Alert.alert('Error', 'Please fill in both subject and note content');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('notes').insert([
        { user_id: user?.id, subject, note_content: content },
      ]);
      if (error) throw error;
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{
        title: 'Create Note',
        headerRight: () => (
          <TouchableOpacity onPress={saveNote} disabled={loading || transcribing}>
            {loading ? (
              <ActivityIndicator color="#0a7ea4" />
            ) : (
              <ThemedText style={styles.saveText}>Save</ThemedText>
            )}
          </TouchableOpacity>
        )
      }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inputGroup}>
          <View style={styles.subjectContainer}>
            <TextInput
              style={[styles.subjectInput, isRecording && styles.disabledInput]}
              placeholder="Subject / Title"
              placeholderTextColor="#999"
              value={subject}
              onChangeText={setSubject}
              editable={!isRecording && !transcribing}
            />
            <TouchableOpacity
              style={[styles.recordButton, isRecording && styles.recordingActive]}
              onPress={toggleRecording}
              disabled={transcribing}
            >
              <Ionicons name={isRecording ? 'stop' : 'mic'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          style={styles.contentInput}
          placeholder="Start typing your notes here..."
          placeholderTextColor="#999"
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
          editable={!transcribing}
        />

        {transcribing && (
          <View style={styles.transcribingOverlay}>
            <ActivityIndicator size="small" color="#0a7ea4" />
            <ThemedText style={styles.transcribingText}>Gemini AI is transcribing your audio...</ThemedText>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, flexGrow: 1 },
  saveText: { color: '#0a7ea4', fontSize: 16, fontWeight: 'bold', marginRight: 10 },
  inputGroup: { marginBottom: 20 },
  subjectContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subjectInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    color: '#fff',
  },
  disabledInput: { opacity: 0.5, backgroundColor: '#f5f5f5' },
  contentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
    color: '#fff',
    marginTop: 10,
  },
  recordButton: {
    backgroundColor: '#0a7ea4', width: 44, height: 44,
    borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 2,
  },
  recordingActive: { backgroundColor: '#ff4444' },
  transcribingOverlay: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 20, backgroundColor: '#f0f9ff', padding: 10, borderRadius: 10,
  },
  transcribingText: { fontSize: 14, color: '#0a7ea4', fontStyle: 'italic' },
});
