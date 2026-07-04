import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeContext';
import { capture } from '../../lib/analytics';
import GridBackground from '../../components/GridBackground';
import AccentRule from '../../components/AccentRule';

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onGoToSignIn: () => void;
}

export default function SignUpScreen({ onGoToSignIn }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const { signUp } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  async function handleSignUp() {
    if (!email.trim()) { setError(t('auth.errorEmailRequired')); return; }
    if (password.length < 8) { setError(t('auth.errorPasswordLength')); return; }
    setLoading(true);
    setError(null);
    const { error } = await signUp(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      capture('user_signed_up', { method: 'email' });
      setSuccess(true);
    }
  }

  async function handleGoogle() {
    setOauthLoading('google');
    setError(null);
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        if (result.type === 'success') {
          const params = new URL(result.url);
          const accessToken  = params.searchParams.get('access_token');
          const refreshToken = params.searchParams.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            capture('user_signed_up', { method: 'google' });
          }
        }
      }
    } catch {
      setError(t('auth.googleFailed'));
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleApple() {
    setOauthLoading('apple');
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
        if (error) throw error;
        capture('user_signed_up', { method: 'apple' });
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') setError(t('auth.appleFailed'));
    } finally {
      setOauthLoading(null);
    }
  }

  // ── Success state ──
  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <GridBackground />
        <View style={styles.successContent}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.successTitle}>{t('auth.checkEmail')}</Text>
          <Text style={styles.successBody}>
            {t('auth.confirmationSent')}{'\n'}
            <Text style={styles.successEmail}>{email}</Text>
          </Text>
          <Text style={styles.successNote}>{t('auth.clickToActivate')}</Text>
          <TouchableOpacity style={styles.button} onPress={onGoToSignIn} activeOpacity={0.85}>
            <Text style={styles.buttonText}>{t('auth.backToSignIn')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <GridBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>

          {/* Terminal header */}
          <View style={styles.header}>
            <Text style={styles.headerLabel}>TRUCKERNET // SIGN UP</Text>
          </View>

          {/* Brand */}
          <View style={styles.brand}>
            <Image source={require('../../../assets/truck-logo-transparent.png')} style={styles.logoMark} resizeMode="contain" />
            <View>
              <Text style={styles.appName}>TruckerNet</Text>
              <Text style={styles.tagline}>{t('auth.tagline')}</Text>
            </View>
          </View>

          <Text style={styles.heading}>{t('auth.createAccount')}</Text>
          <AccentRule style={{ marginTop: 10, marginBottom: 14 }} />
          <Text style={styles.subheading}>{t('auth.signUpSubtitle')}</Text>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* OAuth */}
          <View style={styles.oauthRow}>
            <TouchableOpacity style={[styles.oauthBtn, styles.oauthBtnApple]} onPress={handleApple} activeOpacity={0.85} disabled={!!oauthLoading}>
              {oauthLoading === 'apple'
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Ionicons name="logo-apple" size={20} color="#fff" /><Text style={[styles.oauthBtnText, { color: '#fff' }]}>Apple</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity style={[styles.oauthBtn, styles.oauthBtnGoogle]} onPress={handleGoogle} activeOpacity={0.85} disabled={!!oauthLoading}>
              {oauthLoading === 'google'
                ? <ActivityIndicator color={Colors.textPrimary} size="small" />
                : <><Text style={styles.googleG}>G</Text><Text style={styles.oauthBtnText}>Google</Text></>
              }
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Fields */}
          <View style={styles.fields}>
            <View>
              <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordMinLength')}
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity style={[styles.button, loading && styles.buttonLoading]} onPress={handleSignUp} activeOpacity={0.85} disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.onPrimary} size="small" />
              : <Text style={styles.buttonText}>{t('auth.signUp')}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchRow} onPress={onGoToSignIn}>
            <Text style={styles.switchText}>{t('auth.haveAccount')} </Text>
            <Text style={styles.switchLink}>{t('auth.signIn')}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.background },
  flex:   { flex: 1 },
  scroll: { paddingHorizontal: Spacing.screenH, paddingTop: 24, paddingBottom: 48 },

  header: { borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle, paddingBottom: 16, marginBottom: 32 },
  headerLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: 11, color: Colors.labelColor, letterSpacing: 1.8 },

  brand:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 36 },
  logoMark: { width: 48, height: 24 },
  appName:  { fontFamily: FontFamily.monoSemiBold, fontSize: 16, color: Colors.textPrimary, letterSpacing: -0.3 },
  tagline:  { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary, marginTop: 1 },

  heading:    { fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary, lineHeight: 36, marginBottom: 0, letterSpacing: -0.6 },
  subheading: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 28 },

  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.dangerDim, borderWidth: 1, borderColor: Colors.danger + '40', borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20 },
  errorText: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.danger, flex: 1 },

  oauthRow:      { flexDirection: 'row', gap: 12, marginBottom: 24 },
  oauthBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.sm, paddingVertical: 14, borderWidth: 1 },
  oauthBtnApple: { backgroundColor: '#000', borderColor: '#000' },
  oauthBtnGoogle:{ backgroundColor: Colors.surface, borderColor: Colors.border },
  oauthBtnText:  { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },
  googleG:       { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.secondary + '4D' },
  dividerText: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.secondary, letterSpacing: 1, textTransform: 'uppercase' },

  fields:     { gap: 20, marginBottom: 24 },
  fieldLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: 10, color: Colors.labelColor, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  input:      { backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 16, paddingVertical: 16, fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary },
  passwordWrap:  { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  eyeBtn:        { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },

  button:        {
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 17, alignItems: 'center', marginBottom: 20,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  buttonLoading: { opacity: 0.7 },
  buttonText:    { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.onPrimary },

  switchRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  switchText: { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary },
  switchLink: { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.primary },

  skipRow: { alignItems: 'center', paddingTop: 8 },
  skipText: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.label, color: Colors.textSecondary, letterSpacing: 0.5 },

  // Success
  successContent:    { flex: 1, paddingHorizontal: Spacing.screenH, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primaryMid, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle:      { fontFamily: FontFamily.monoBold, fontSize: FontSize.title, color: Colors.textPrimary, marginBottom: 12, letterSpacing: -0.6 },
  successBody:       { fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: 8, lineHeight: 22 },
  successEmail:      { fontFamily: FontFamily.monoSemiBold, color: Colors.textPrimary },
  successNote:       { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
});
