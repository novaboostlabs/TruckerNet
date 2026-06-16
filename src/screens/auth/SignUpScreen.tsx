import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '../../theme/theme';

export default function SignUpScreen({ navigation }: any) {
  const { signUp } = useAuth();
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [showPass, setShowPass]               = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [success, setSuccess]                 = useState(false);
  const [emailFocused, setEmailFocused]       = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function handleSignUp() {
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError(null);
    const { error } = await signUp(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) setError(error);
    else setSuccess(true);
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContent}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successBody}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.successEmail}>{email}</Text>
          </Text>
          <Text style={styles.successNote}>
            Click the link to activate your account, then sign in.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('SignIn')} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoChar}>T</Text>
            </View>
            <View>
              <Text style={styles.appName}>TruckerNet</Text>
              <Text style={styles.tagline}>Know your real number.</Text>
            </View>
          </View>

          {/* Heading */}
          <View style={styles.headingBlock}>
            <Text style={styles.heading}>Create account.</Text>
            <Text style={styles.subheading}>Start tracking your real net pay today.</Text>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Fields */}
          <View style={styles.fields}>
            <View>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                style={[styles.input, emailFocused && styles.inputFocused]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, passwordFocused && styles.inputFocused]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry={!showPass}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPass(!showPass)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity style={[styles.button, loading && styles.buttonLoading]} onPress={handleSignUp} activeOpacity={0.85} disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.background} size="small" />
              : <Text style={styles.buttonText}>Create Account</Text>
            }
          </TouchableOpacity>

          {/* Switch */}
          <TouchableOpacity style={styles.switchRow} onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <Text style={styles.switchLink}>Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  flex:   { flex: 1 },
  scroll: { paddingHorizontal: Spacing.screenH, paddingTop: 32, paddingBottom: 48 },

  brand:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 52 },
  logoMark: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoChar: { fontFamily: FontFamily.bold, fontSize: 22, color: Colors.background, lineHeight: 26 },
  appName:  { fontFamily: FontFamily.semiBold, fontSize: 16, color: Colors.textPrimary, letterSpacing: 0.3 },
  tagline:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 1 },

  headingBlock: { marginBottom: 32 },
  heading:      { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary, lineHeight: 36, marginBottom: 6 },
  subheading:   { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.dangerDim, borderWidth: 1, borderColor: Colors.danger + '40',
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20,
  },
  errorText: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.danger, flex: 1, lineHeight: 20 },

  fields:     { gap: 20, marginBottom: 28 },
  fieldLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.micro, color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: 8 },

  input: {
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 16,
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary,
  },
  inputFocused:  { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  passwordWrap:  { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  eyeButton:     { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },

  button:        { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17, alignItems: 'center', marginBottom: 24 },
  buttonLoading: { opacity: 0.7 },
  buttonText:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.background, letterSpacing: 0.2 },

  switchRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  switchText: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },
  switchLink: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.primary },

  // Success state
  successContent: { flex: 1, paddingHorizontal: Spacing.screenH, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  successIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  successTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.title, color: Colors.textPrimary, marginBottom: 12 },
  successBody:  { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: 8, lineHeight: 22 },
  successEmail: { fontFamily: FontFamily.semiBold, color: Colors.textPrimary },
  successNote:  { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
});
