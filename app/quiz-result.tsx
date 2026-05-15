import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function QuizResultScreen() {
  const { score, total, quiz_id } = useLocalSearchParams();
  const router = useRouter();
  
  const percentage = Math.round((Number(score) / Number(total)) * 100);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Quiz Result', headerLeft: () => null }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.scoreCard}>
          <ThemedText style={styles.congratsText}>
            {percentage >= 75 ? 'Great Job!' : percentage >= 50 ? 'Good Effort!' : 'Keep Practicing!'}
          </ThemedText>
          
          <View style={styles.scoreCircle}>
            <ThemedText style={styles.scoreNumber}>{score}</ThemedText>
            <ThemedText style={styles.totalNumber}>out of {total}</ThemedText>
          </View>

          <ThemedText style={styles.percentageText}>{percentage}%</ThemedText>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Ionicons name="home" size={20} color="#fff" />
            <ThemedText style={styles.buttonText}>Back to Home</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Ionicons name="refresh" size={20} color="#0a7ea4" />
            <ThemedText style={styles.secondaryButtonText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText type="subtitle" style={styles.reviewTitle}>Review Answers</ThemedText>
        <ReviewList quiz_id={quiz_id as string} />
      </ScrollView>
    </ThemedView>
  );
}

function ReviewList({ quiz_id }: { quiz_id: string }) {
  const [results, setResults] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReview() {
      const { data: res } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('quiz_id', quiz_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      const { data: qs } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quiz_id);

      setResults(res);
      setQuestions(qs || []);
      setLoading(false);
    }
    fetchReview();
  }, [quiz_id]);

  if (loading) return <ActivityIndicator style={{ marginTop: 20 }} />;

  return (
    <View style={styles.reviewContainer}>
      {questions.map((q, index) => {
        const userAnswer = results?.user_answers?.[index];
        const isCorrect = userAnswer?.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();

        return (
          <View key={q.id} style={[styles.reviewItem, isCorrect ? styles.correctItem : styles.wrongItem]}>
            <ThemedText style={styles.reviewQuestion}>{index + 1}. {q.question}</ThemedText>
            <ThemedText style={styles.reviewAnswerLabel}>Your answer: 
              <ThemedText style={isCorrect ? styles.correctText : styles.wrongText}> {userAnswer || '(Empty)'}</ThemedText>
            </ThemedText>
            {!isCorrect && (
              <ThemedText style={styles.reviewCorrectLabel}>Correct answer: 
                <ThemedText style={styles.correctText}> {q.correct_answer}</ThemedText>
              </ThemedText>
            )}
          </View>
        );
      })}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  scoreCard: {
    backgroundColor: '#1e1e1e',
    width: '100%',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 40,
  },
  congratsText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4caf50',
    marginBottom: 20,
  },
  scoreCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 8,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  totalNumber: {
    fontSize: 16,
    color: '#aaa',
  },
  percentageText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionButtons: {
    width: '100%',
    gap: 15,
  },
  primaryButton: {
    backgroundColor: '#0a7ea4',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0a7ea4',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  secondaryButtonText: {
    color: '#0a7ea4',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reviewTitle: {
    marginTop: 40,
    marginBottom: 20,
    fontSize: 20,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
  },
  reviewContainer: {
    width: '100%',
    gap: 15,
    marginBottom: 40,
  },
  reviewItem: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  correctItem: {
    borderColor: '#4caf50',
    backgroundColor: '#1b5e2022',
  },
  wrongItem: {
    borderColor: '#f44336',
    backgroundColor: '#b71c1c22',
  },
  reviewQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  reviewAnswerLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  reviewCorrectLabel: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  correctText: {
    color: '#4caf50',
    fontWeight: 'bold',
  },
  wrongText: {
    color: '#f44336',
    fontWeight: 'bold',
  },
});

