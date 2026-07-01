import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, FontFamily, FontSize, Spacing, Radius, ThemeColors, sectionLabel } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeContext';
import { capture, identify } from '../../lib/analytics';
import GridBackground from '../../components/GridBackground';
import AccentRule from '../../components/AccentRule';

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onGoToSignUp: () => void;
}

export default function SignInScreen({ onGoToSignUp }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { t } = useTranslation();
  const { signIn } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [emailFocused, setEmailFocused]       = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // ── Email/password sign in ──
  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError(t('auth.errorEmailPassword'));
      return;
    }
    setLoading(true);
    setError(null);
    const emailLower = email.trim().toLowerCase();
    const { error } = await signIn(emailLower, password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      capture('user_signed_in', { method: 'email' });
    }
  }

  // ── Google OAuth ──
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
          const url = result.url;
          const params = new URL(url);
          const accessToken  = params.searchParams.get('access_token');
          const refreshToken = params.searchParams.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            capture('user_signed_in', { method: 'google' });
          }
        }
      }
    } catch (e: any) {
      setError(t('auth.googleFailed'));
    } finally {
      setOauthLoading(null);
    }
  }

  // ── Apple Sign In ──
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
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;
        capture('user_signed_in', { method: 'apple' });
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError(t('auth.appleFailed'));
      }
    } finally {
      setOauthLoading(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <GridBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Terminal header */}
          <View style={styles.header}>
            <Text style={styles.headerLabel}>TRUCKERNET // SIGN IN</Text>
          </View>

          {/* Brand */}
          <View style={styles.brand}>
            <Image source={require('../../../assets/truck-logo-transparent.png')} style={styles.logoMark} resizeMode="contain" />
            <View>
              <Text style={styles.appName}>TruckerNet</Text>
              <Text style={styles.tagline}>{t('auth.tagline')}</Text>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.heading}>{t('auth.welcomeBack')}</Text>
          <AccentRule style={{ marginTop: 10, marginBottom: 14 }} />
          <Text style={styles.subheading}>{t('auth.signInSubtitle')}</Text>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* OAuth buttons */}
          <View style={styles.oauthRow}>
            {/* Apple Sign In */}
            <TouchableOpacity
              style={[styles.oauthBtn, styles.oauthBtnApple]}
              onPress={handleApple}
              activeOpacity={0.85}
              disabled={!!oauthLoading}
            >
              {oauthLoading === 'apple'
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="logo-apple" size={20} color="#fff" />
                    <Text style={[styles.oauthBtnText, { color: '#fff' }]}>Apple</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.oauthBtn, styles.oauthBtnGoogle]}
              onPress={handleGoogle}
              activeOpacity={0.85}
              disabled={!!oauthLoading}
            >
              {oauthLoading === 'google'
                ? <ActivityIndicator color={Colors.textPrimary} size="small" />
                : <>
                    <GoogleIcon />
                    <Text style={styles.oauthBtnText}>Google</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email + password */}
          <View style={styles.fields}>
            <View>
              <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
              <TextInput
                style={[styles.input, emailFocused && styles.inputFocused]}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, passwordFocused && styles.inputFocused]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry={!showPass}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Sign in button */}
          <TouchableOpacity style={[styles.button, loading && styles.buttonLoading]} onPress={handleSignIn} activeOpacity={0.85} disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.onPrimary} size="small" />
              : <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
            }
          </TouchableOpacity>

          {/* Switch to sign up */}
          <TouchableOpacity style={styles.switchRow} onPress={onGoToSignUp}>
            <Text style={styles.switchText}>{t('auth.noAccount')} </Text>
            <Text style={styles.switchLink}>{t('auth.createOne')}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Google "G" logo — brand colours per Google's identity guidelines.
function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      {/* Blue */}
      <Path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      {/* Green */}
      <Path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      {/* Yellow */}
      <Path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      {/* Red */}
      <Path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </Svg>
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

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.dangerDim, borderWidth: 1, borderColor: Colors.danger + '40',
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20,
  },
  errorText: { fontFamily: FontFamily.regular, fontSize: FontSize.label, color: Colors.danger, flex: 1 },

  // OAuth
  oauthRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  oauthBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Radius.sm, paddingVertical: 14, borderWidth: 1,
  },
  oauthBtnApple:  { backgroundColor: '#000', borderColor: '#000' },
  oauthBtnGoogle: { backgroundColor: Colors.surface, borderColor: Colors.border },
  oauthBtnText:   { fontFamily: FontFamily.semiBold, fontSize: FontSize.body, color: Colors.textPrimary },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.secondary + '4D' },
  dividerText: { fontFamily: FontFamily.monoRegular, fontSize: FontSize.caption, color: Colors.secondary, letterSpacing: 1, textTransform: 'uppercase' },

  // Fields
  fields:     { gap: 20, marginBottom: 24 },
  fieldLabel: { fontFamily: FontFamily.monoSemiBold, fontSize: 10, color: Colors.labelColor, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },

  input: {
    backgroundColor: Colors.surfaceHigh, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 16, paddingVertical: 16,
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary,
  },
  inputFocused:  { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
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
});
