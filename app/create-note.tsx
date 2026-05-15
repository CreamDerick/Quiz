import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyCGHDxXKVb2_MMCVCpRkgCmfmrVNI_MC3E');

export default function CreateNoteScreen() {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    return () => {
      if (audioRecorder.isRecording) {
        audioRecorder.stop();
      }
    };
  }, []);

  async function startRecording() {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission denied', 'We need your permission to access the microphone.');
        return;
      }
      await audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  }

  async function stopRecording() {
    setIsRecording(false);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }

  async function transcribeAudio(uri: string) {
    setTranscribing(true);
    try {
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const extension = uri.split('.').pop()?.toLowerCase();
      const mimeType = extension === 'm4a' ? 'audio/mp4' :
                       extension === 'wav' ? 'audio/wav' :
                       extension === 'mp3' ? 'audio/mpeg' : 'audio/m4a';

      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const prompt = 'Please transcribe this audio lecture accurately. Only provide the transcription text, nothing else.';
      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType, data: base64Audio } }
      ]);

      const response = await result.response;
      const text = response.text();
      setContent(prev => prev + (prev ? '\n\n' : '') + text);
    } catch (err: any) {
      console.error('Gemini transcription failed', err);
      Alert.alert('Transcription Error', 'Failed to transcribe audio. Please check your Gemini API key.');
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
