import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ActivityIndicator, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();

  async function signUpWithEmail() {
    setErrorMessage('');
    setSuccessMessage('');
    
    if (!email || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }
    
    setLoading(true);
    try {
      const { 
        data: { session },
        error 
      } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (error) {
        setLoading(false);
        setErrorMessage(error.message);
      } else if (!session) {
        setLoading(false);
        setSuccessMessage('Success! Check your email for the confirmation link.');
      } else {
        setLoading(false);
      }
    } catch (e: any) {
      setLoading(false);
      setErrorMessage(e.message || 'An unexpected error occurred');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>Create Account</ThemedText>
        <ThemedText style={styles.subtitle}>Join Robles-Quiz today</ThemedText>
      </View>

      <View style={styles.form}>
        {errorMessage ? (
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        ) : null}
        
        {successMessage ? (
          <ThemedText style={styles.successText}>{successMessage}</ThemedText>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          autoCapitalize="none"
          onChangeText={(text) => setEmail(text)}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          secureTextEntry={true}
          autoCapitalize="none"
          onChangeText={(text) => setPassword(text)}
        />

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={signUpWithEmail}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Sign Up</ThemedText>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <ThemedText>Already have an account? </ThemedText>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <ThemedText type="link">Sign In</ThemedText>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0a7ea4',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  form: {
    gap: 15,
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#0a7ea4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  successText: {
    color: '#4caf50',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
  },
});
