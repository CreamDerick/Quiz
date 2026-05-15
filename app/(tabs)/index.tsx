import React, { useState, useCallback } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, RefreshControl, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Note = {
  id: string;
  subject: string;
  note_content: string;
  created_at: string;
};

export default function HomeScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  async function fetchNotes() {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error: any) {
      console.error('Error fetching notes:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotes();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotes();
  };

  const renderNoteItem = ({ item }: { item: Note }) => (
    <TouchableOpacity 
      style={styles.noteCard}
      onPress={() => router.push(`/note/${item.id}`)}
    >
      <ThemedText type="subtitle" style={styles.noteSubject}>{item.subject}</ThemedText>
      <ThemedText numberOfLines={2} style={styles.notePreview}>
        {item.note_content}
      </ThemedText>
      <ThemedText style={styles.noteDate}>
        {new Date(item.created_at).toLocaleDateString()}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">My Notes</ThemedText>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Ionicons name="log-out-outline" size={24} color="#0a7ea4" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#0a7ea4" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNoteItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color="#ccc" />
              <ThemedText style={styles.emptyText}>No notes yet. Create your first one!</ThemedText>
            </View>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => router.push('/create-note')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  noteCard: {
    backgroundColor: '#1e1e1e',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  noteSubject: {
    fontSize: 18,
    marginBottom: 5,
    color: '#fff',
    fontWeight: 'bold',
  },
  notePreview: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 10,
  },
  noteDate: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#0a7ea4',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    opacity: 0.5,
  },
});
