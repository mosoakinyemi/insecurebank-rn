import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL, LAB_EXPOSED_ENV_VALUE, LAB_SUPPORT_KEY } from './config';

type Account = { id: string; label: string; balance: number };
type Transaction = { id: string; description: string; amount: number; date: string };
type Screen = 'home' | 'activity' | 'transfer' | 'profile';
const STORAGE_KEY = 'insecurebank.session';
const SHOW_VULNERABLE_LOG = true; // Exercise E: set false to use the corrected, value-free log line below.

export default function App() {
  const [email, setEmail] = useState('ada@lab.test');
  const [password, setPassword] = useState('lab-ada-2468');
  const [fullName, setFullName] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [accountId, setAccountId] = useState('acct-1001');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [screen, setScreen] = useState<Screen>('home');
  const [amount, setAmount] = useState('25');
  const [busy, setBusy] = useState(false);
  const [labMessage, setLabMessage] = useState('');

  useEffect(() => {
    void restoreSession();
  }, []);

  async function request<T>(path: string, options: { method?: string; body?: unknown; authToken?: string; headers?: Record<string, string> } = {}): Promise<T> {
    const headers: Record<string, string> = { ...options.headers };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    const activeToken = options.authToken ?? token;
    if (activeToken) headers.authorization = `Bearer ${activeToken}`;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET', headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message ?? `Request failed (${response.status})`);
    return result as T;
  }

  async function restoreSession() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setToken(saved);
        await loadBank(saved);
      }
    } catch {
      setToken(''); setAccount(null); setTransactions([]); setName('');
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }

  async function loadBank(activeToken: string) {
    const profile = await request<{ user: { name: string; email: string; phone: string; account_id: string } }>(
      '/api/me', { authToken: activeToken },
    );
    const ownedId = profile.user.account_id;
    const [accountResult, history] = await Promise.all([
      request<{ account: Account }>(`/api/accounts/${ownedId}`, { authToken: activeToken }),
      request<{ transactions: Transaction[] }>(`/api/accounts/${ownedId}/transactions`, { authToken: activeToken }),
    ]);
    setName(profile.user.name);
    setEmail(profile.user.email);
    setPhone(profile.user.phone);
    setAccountId(ownedId);
    setAccount(accountResult.account);
    setTransactions(history.transactions);
  }

  async function login() {
    setBusy(true);
    try {
      const result = await request<{ token: string; user: { name: string } }>('/api/login', {
        method: 'POST', body: { email, password }, authToken: '',
      });
      setToken(result.token);
      setName(result.user.name);
      // EXERCISE E: intentional sensitive token logging. Corrected version logs only the event.
      if (SHOW_VULNERABLE_LOG) console.log('[EXERCISE E] login session token:', result.token);
      else console.info('[InsecureBank LAB] sign-in completed');
      // EXERCISE D: deliberate storage of the session token in ordinary app-private storage.
      await AsyncStorage.setItem(STORAGE_KEY, result.token);
      await loadBank(result.token);
    } catch (error) {
      setToken(''); setAccount(null); setTransactions([]);
      await AsyncStorage.removeItem(STORAGE_KEY);
      Alert.alert('Sign in failed', messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    setBusy(true);
    try {
      const result = await request<{ token: string }>('/api/register', {
        method: 'POST', body: { name: fullName, email, password }, authToken: '',
      });
      setToken(result.token);
      await AsyncStorage.setItem(STORAGE_KEY, result.token);
      await loadBank(result.token);
    } catch (error) {
      Alert.alert('Could not create account', messageOf(error));
    } finally { setBusy(false); }
  }

  function toggleAccountMode() {
    const next = !creatingAccount;
    setCreatingAccount(next);
    setEmail(next ? '' : 'ada@lab.test');
    setPassword(next ? '' : 'lab-ada-2468');
    setFullName('');
  }

  async function logout() {
    try { await request('/api/logout', { method: 'POST' }); } catch { /* Local sign-out remains available offline. */ }
    await AsyncStorage.removeItem(STORAGE_KEY);
    setToken(''); setAccount(null); setTransactions([]); setName(''); setScreen('home');
  }

  async function transfer() {
    setBusy(true);
    const toAccountId = accountId === 'acct-1001' ? 'acct-2002' : 'acct-1001';
    try {
      await request('/api/transfers', { method: 'POST', body: { fromAccountId: accountId, toAccountId, amount: Number(amount) } });
      await loadBank(token);
      Alert.alert('Transfer complete', `Sent $${Number(amount).toFixed(2)} between synthetic lab accounts.`);
      setScreen('home');
    } catch (error) {
      Alert.alert('Transfer failed', messageOf(error));
    } finally { setBusy(false); }
  }

  async function showLabSupport() {
    try {
      const result = await request<{ notice: string }>('/api/lab/support-info', {
        headers: { 'x-lab-console-key': LAB_SUPPORT_KEY },
      });
      setLabMessage(result.notice);
    } catch (error) { setLabMessage(messageOf(error)); }
  }

  async function capturePlaintextSample() {
    try {
      const result = await request<{ demo: string; accountId: string; balance: number }>(`/api/lab/cleartext/${accountId}`);
      setLabMessage(`${result.demo} · ${result.accountId} · $${result.balance.toFixed(2)}`);
    } catch (error) { setLabMessage(messageOf(error)); }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        {!token ? (
          <KeyboardAvoidingView style={styles.loginPage} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Text style={styles.brand}>SECURECIRCLE</Text>
            <Text style={styles.loginTitle}>InsecureBank</Text>
            <Text style={styles.muted}>{creatingAccount ? 'Create a synthetic lab account' : 'A synthetic banking security lab'}</Text>
            {creatingAccount && <TextInput style={styles.input} value={fullName} onChangeText={setFullName} autoCapitalize="words" placeholder="Full name" placeholderTextColor="#87949d" />}
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#87949d" />
            <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#87949d" />
            <Button title={busy ? 'Please wait…' : creatingAccount ? 'Create account' : 'Sign in'} onPress={creatingAccount ? register : login} disabled={busy} />
            <Pressable accessibilityRole="button" onPress={toggleAccountMode} style={styles.modeToggle}>
              <Text style={styles.link}>{creatingAccount ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text>
            </Pressable>
            {busy && <ActivityIndicator color="#167d72" style={styles.spinner} />}
            <Text style={styles.hint}>Demo: ada@lab.test  /  lab-ada-2468</Text>
            <Text style={styles.training}>TRAINING DATA ONLY · NOT A REAL BANK</Text>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.page}>
            <View style={styles.header}>
              <View><Text style={styles.brand}>SECURECIRCLE</Text><Text style={styles.greeting}>Hello, {name.split(' ')[0]}</Text></View>
              <Pressable onPress={logout} accessibilityRole="button"><Text style={styles.link}>Log out</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.content}>
              {screen === 'home' && <>
                <View style={styles.balanceCard}>
                  <Text style={styles.cardCaption}>{account?.label ?? 'Everyday account'}</Text>
                  <Text style={styles.balance}>${(account?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  <Text style={styles.cardCaption}>ACCOUNT  •••• {accountId.slice(-4)}</Text>
                </View>
                <View style={styles.actionsRow}>
                  <Button title="Transfer" onPress={() => setScreen('transfer')} />
                  <Button title="Activity" secondary onPress={() => setScreen('activity')} />
                </View>
                <SectionTitle title="Recent activity" />
                {transactions.slice(0, 3).map((item) => <TransactionRow key={item.id} item={item} />)}
                <Text style={styles.smallNote}>Synthetic demo account · Account data is fictional</Text>
              </>}
              {screen === 'activity' && <>
                <SectionTitle title="Transaction history" />
                {transactions.map((item) => <TransactionRow key={item.id} item={item} />)}
              </>}
              {screen === 'transfer' && <>
                <SectionTitle title="Send a transfer" />
                <Text style={styles.muted}>To the other synthetic account in this lab.</Text>
                <Text style={styles.fieldLabel}>AMOUNT</Text>
                <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="$0.00" placeholderTextColor="#87949d" />
                <Button title={busy ? 'Sending…' : 'Review and send'} onPress={transfer} disabled={busy} />
              </>}
              {screen === 'profile' && <>
                <SectionTitle title="Profile & settings" />
                <View style={styles.profileCard}>
                  <Text style={styles.profileName}>{name}</Text>
                  <Text style={styles.muted}>{email}</Text>
                  <Text style={styles.muted}>{phone}</Text>
                  <Text style={styles.hint}>Training session is stored on this device for Exercise D.</Text>
                </View>
                <SectionTitle title="Security lab checks" />
                <Button title="Open support info (Exercise A)" secondary onPress={showLabSupport} />
                <Text selectable style={styles.labMessage}>Exercise G · Build-time .env value exposed in this app: {LAB_EXPOSED_ENV_VALUE}</Text>
                <Button title="Capture HTTP sample (Exercise C)" secondary onPress={capturePlaintextSample} />
                {labMessage ? <Text selectable style={styles.labMessage}>{labMessage}</Text> : null}
                <Button title="Sign out" secondary onPress={logout} />
              </>}
            </ScrollView>
            <View style={styles.nav}>
              {([['home', 'Home'], ['activity', 'Activity'], ['transfer', 'Transfer'], ['profile', 'Profile']] as const).map(([key, label]) => (
                <Pressable key={key} accessibilityRole="button" onPress={() => { setScreen(key); setLabMessage(''); }} style={styles.navItem}>
                  <Text style={[styles.navText, screen === key && styles.navSelected]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function messageOf(error: unknown) { return error instanceof Error ? error.message : String(error); }
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>
  </Pressable>;
}
function SectionTitle({ title }: { title: string }) { return <Text style={styles.sectionTitle}>{title}</Text>; }
function TransactionRow({ item }: { item: Transaction }) {
  const positive = item.amount > 0;
  return <View style={styles.transaction}>
    <View style={styles.txInfo}><Text style={styles.txTitle}>{item.description}</Text><Text style={styles.hint}>{new Date(item.date).toLocaleDateString()}</Text></View>
    <Text style={[styles.txAmount, positive && styles.positive]}>{positive ? '+' : '−'}${Math.abs(item.amount).toFixed(2)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f6f5' }, loginPage: { flex: 1, justifyContent: 'center', padding: 26 },
  brand: { color: '#167d72', fontWeight: '800', letterSpacing: 1.5, fontSize: 12 }, loginTitle: { fontSize: 34, fontWeight: '800', color: '#142e38', marginTop: 16 },
  muted: { color: '#75858c', fontSize: 14, marginTop: 6 }, input: { backgroundColor: '#fff', borderColor: '#d9e1df', borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 13, marginTop: 14, color: '#172d35', fontSize: 15 },
  spinner: { marginTop: 10 }, modeToggle: { alignItems: 'center', paddingVertical: 8 }, hint: { color: '#8b989d', fontSize: 12, marginTop: 7 }, training: { color: '#167d72', fontWeight: '700', fontSize: 10, letterSpacing: 1, marginTop: 35, textAlign: 'center' },
  page: { flex: 1, paddingHorizontal: 18 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 }, greeting: { color: '#18323a', fontSize: 20, fontWeight: '700', marginTop: 5 }, link: { color: '#167d72', fontWeight: '700', padding: 10 },
  content: { paddingBottom: 22 }, balanceCard: { backgroundColor: '#173e47', borderRadius: 20, padding: 23, marginTop: 10 }, cardCaption: { color: '#c4d7d9', fontSize: 12, letterSpacing: 0.3 }, balance: { color: '#fff', fontSize: 34, fontWeight: '800', marginVertical: 17 },
  actionsRow: { flexDirection: 'row', gap: 12 }, button: { flex: 1, backgroundColor: '#167d72', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', marginTop: 13 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 }, secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9e1df' }, secondaryButtonText: { color: '#167d72' }, disabled: { opacity: 0.55 },
  sectionTitle: { color: '#142e38', fontSize: 21, fontWeight: '800', marginTop: 26, marginBottom: 9 }, transaction: { backgroundColor: '#fff', borderRadius: 13, padding: 15, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, txInfo: { flex: 1, paddingRight: 12 }, txTitle: { color: '#253c44', fontSize: 14, fontWeight: '600' }, txAmount: { color: '#253c44', fontWeight: '700', fontSize: 14 }, positive: { color: '#167d72' },
  smallNote: { color: '#9aa5a9', fontSize: 11, textAlign: 'center', marginTop: 18 }, profileCard: { backgroundColor: '#fff', padding: 17, borderRadius: 14 }, profileName: { color: '#203840', fontWeight: '700', fontSize: 17 }, fieldLabel: { color: '#819096', fontSize: 11, fontWeight: '800', marginTop: 23, letterSpacing: 1 }, labMessage: { color: '#24454d', backgroundColor: '#e4eeeb', borderRadius: 10, padding: 12, marginTop: 12, fontSize: 13 },
  nav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', borderRadius: 15, paddingVertical: 13, marginBottom: 7, borderWidth: 1, borderColor: '#e8edeb' }, navItem: { paddingHorizontal: 5 }, navText: { color: '#7c898e', fontSize: 12, fontWeight: '600' }, navSelected: { color: '#167d72', fontWeight: '800' },
});
