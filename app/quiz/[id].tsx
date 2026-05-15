import React, { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Question = {
  id: string;
  question: string;
  question_type: 'multiple_choice' | 'identification';
  choices: string[];
  correct_answer: string;
};

export default function QuizScreen() {
  const { id } = useLocalSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchQuestions();
  }, [id]);

  async function fetchQuestions() {
    try {
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', id);

      if (error) throw error;
      setQuestions(data || []);
      setUserAnswers(new Array(data?.length || 0).fill(''));
    } catch (error: any) {
      Alert.alert('Error', error.message);
      router.back();
    } finally {
      setLoading(false);
    }
  }

  const handleNext = () => {
    if (!currentAnswer.trim() && questions[currentIdx].question_type === 'identification') {
      Alert.alert('Empty Answer', 'Please provide an answer before continuing.');
      return;
    }

    const updatedAnswers = [...userAnswers];
    updatedAnswers[currentIdx] = currentAnswer;
    setUserAnswers(updatedAnswers);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setCurrentAnswer(userAnswers[currentIdx + 1] || '');
    } else {
      submitQuiz(updatedAnswers);
    }
  };

  async function submitQuiz(finalAnswers: string[]) {
    let score = 0;
    questions.forEach((q, index) => {
      if (finalAnswers[index].toLowerCase().trim() === q.correct_answer.toLowerCase().trim()) {
        score++;
      }
    });

    try {
      const { error } = await supabase
        .from('quiz_results')
        .insert([{
          quiz_id: id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          score: score,
          user_answers: finalAnswers,
          correct_answers: questions.map(q => q.correct_answer)
        }]);

      if (error) throw error;

      router.replace({
        pathname: '/quiz-result',
        params: { score, total: questions.length, quiz_id: id as string }
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ThemedView>
    );
  }

  const currentQuestion = questions[currentIdx];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: `Question ${currentIdx + 1} of ${questions.length}` }} />

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((currentIdx + 1) / questions.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.questionText}>{currentQuestion.question}</ThemedText>

        {currentQuestion.question_type === 'multiple_choice' ? (
          <View style={styles.choicesContainer}>
            {currentQuestion.choices.map((choice, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.choiceButton,
                  currentAnswer === choice && styles.choiceSelected
                ]}
                onPress={() => setCurrentAnswer(choice)}
              >
                <ThemedText style={[
                  styles.choiceText,
                  currentAnswer === choice && styles.choiceTextSelected
                ]}>
                  {choice}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Type your answer here..."
            value={currentAnswer}
            onChangeText={setCurrentAnswer}
            autoFocus
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <ThemedText style={styles.nextButtonText}>
            {currentIdx === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
          </ThemedText>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#eee',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0a7ea4',
  },
  content: {
    padding: 20,
    flexGrow: 1,
  },
  questionText: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 30,
    marginTop: 20,
  },
  choicesContainer: {
    gap: 12,
  },
  choiceButton: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1e1e1e',
  },
  choiceSelected: {
    borderColor: '#0a7ea4',
    backgroundColor: '#0a7ea422',
  },
  choiceText: {
    fontSize: 16,
    color: '#fff',
  },
  choiceTextSelected: {
    color: '#0a7ea4',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#333',
    padding: 15,
    borderRadius: 10,
    fontSize: 18,
    backgroundColor: '#1e1e1e',
    color: '#fff',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  nextButton: {
    backgroundColor: '#0a7ea4',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
