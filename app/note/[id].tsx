import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

type Note = {
  id: string;
  subject: string;
  note_content: string;
  user_id: string;
  created_at: string;
};

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function fetchNote() {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setNote(data);
      setEditSubject(data.subject);
      setEditContent(data.note_content);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      router.back();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNote();
  }, [id]);

  async function saveEdit() {
    if (!editSubject.trim() || !editContent.trim()) {
      Alert.alert('Error', 'Subject and content cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ subject: editSubject, note_content: editContent })
        .eq('id', id);

      if (error) throw error;
      setNote(prev => prev ? { ...prev, subject: editSubject, note_content: editContent } : prev);
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote() {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this note?')
      : await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Delete Note',
          'Are you sure you want to delete this note?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });

    if (!confirmed) return;

    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  const generateQuiz = async () => {
    if (!note) return;
    setQuizError('');
    setGeneratingQuiz(true);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
      console.log('DEBUG: Using Gemini API key:', apiKey.substring(0, 10) + '...' + apiKey.slice(-5));
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

      const prompt = `Based on the following lecture notes, generate a quiz with 5 questions.
Include a mix of multiple choice and identification questions.
Return ONLY a raw JSON object (no markdown, no code blocks) with a "questions" array.
Each question must have: "question" (string), "type" ("multiple_choice" or "identification"), "choices" (array of 4 strings for multiple choice, empty array for identification), "correct_answer" (string).

Notes: ${note.note_content}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      // Strip markdown code fences if present
      text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

      let quizData;
      try {
        quizData = JSON.parse(text);
      } catch (parseErr) {
        console.error('Raw Gemini response:', text);
        setQuizError(`Gemini returned invalid JSON. Raw: ${text.substring(0, 200)}`);
        setGeneratingQuiz(false);
        return;
      }

      if (!quizData.questions || !Array.isArray(quizData.questions)) {
        setQuizError('Gemini response did not contain a valid "questions" array.');
        setGeneratingQuiz(false);
        return;
      }

      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert([{ note_id: id, user_id: note.user_id }])
        .select()
        .single();

      if (quizError) {
        setQuizError(`Database error: ${quizError.message}`);
        setGeneratingQuiz(false);
        return;
      }

      const questionsToInsert = quizData.questions.map((q: any) => ({
        quiz_id: quiz.id,
        question: q.question,
        question_type: q.type,
        choices: q.choices || [],
        correct_answer: q.correct_answer,
      }));

      const { error: questionsError } = await supabase
        .from('quiz_questions')
        .insert(questionsToInsert);

      if (questionsError) {
        setQuizError(`Failed to save questions: ${questionsError.message}`);
        setGeneratingQuiz(false);
        return;
      }

      router.push(`/quiz/${quiz.id}`);
    } catch (error: any) {
      console.error('Quiz generation failed:', error);
      setQuizError(error.message || 'An unexpected error occurred. Check the browser console.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ThemedView>
    );
  }

  if (!note) return null;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{
        title: isEditing ? 'Edit Note' : 'Note Detail',
        headerRight: () => (
          <View style={styles.headerIcons}>
            {isEditing ? (
              <>
                <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.headerIcon}>
                  <Ionicons name="close-outline" size={26} color="#aaa" />
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEdit} style={styles.headerIcon} disabled={saving}>
                  {saving
                    ? <ActivityIndicator size="small" color="#4caf50" />
                    : <Ionicons name="checkmark-outline" size={26} color="#4caf50" />
                  }
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.headerIcon}>
                  <Ionicons name="create-outline" size={24} color="#0a7ea4" />
                </TouchableOpacity>
                <TouchableOpacity onPress={deleteNote} style={styles.headerIcon}>
                  <Ionicons name="trash-outline" size={24} color="#ff4444" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )
      }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isEditing ? (
          <>
            <TextInput
              style={styles.editSubjectInput}
              value={editSubject}
              onChangeText={setEditSubject}
              placeholder="Subject"
              placeholderTextColor="#666"
            />
            <View style={styles.divider} />
            <TextInput
              style={styles.editContentInput}
              value={editContent}
              onChangeText={setEditContent}
              placeholder="Note content..."
              placeholderTextColor="#666"
              multiline
              textAlignVertical="top"
            />
          </>
        ) : (
          <>
            <ThemedText type="title" style={styles.subject}>{note.subject}</ThemedText>
            <ThemedText style={styles.date}>
              Created on {new Date(note.created_at).toLocaleDateString()}
            </ThemedText>
            <View style={styles.divider} />
            <ThemedText style={styles.content}>{note.note_content}</ThemedText>
          </>
        )}
      </ScrollView>

      {!isEditing && (
        <View style={styles.footer}>
          {quizError ? (
            <ThemedText style={styles.errorText}>{quizError}</ThemedText>
          ) : null}
          <TouchableOpacity
            style={[styles.quizButton, generatingQuiz && styles.buttonDisabled]}
            onPress={generateQuiz}
            disabled={generatingQuiz}
          >
            {generatingQuiz ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="school-outline" size={24} color="#fff" />
                <ThemedText style={styles.quizButtonText}>Generate Quiz with Gemini</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  headerIcon: { marginLeft: 15 },
  subject: { fontSize: 28, marginBottom: 10 },
  date: { fontSize: 14, opacity: 0.5, marginBottom: 20 },
  divider: { height: 1, backgroundColor: '#333', marginBottom: 20 },
  content: { fontSize: 18, lineHeight: 28 },
  editSubjectInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    paddingVertical: 8,
    marginBottom: 16,
  },
  editContentInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#fff',
    minHeight: 300,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  quizButton: {
    backgroundColor: '#0a7ea4',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  quizButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
});
