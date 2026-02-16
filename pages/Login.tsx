import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { createUserWithEmail, signOut } from '../services/firebase';
import { userService } from '../services/userService';
import { roleService } from '../services/roleService';
import type { FirestoreRole } from '../types';

type Mode = 'loading' | 'login' | 'setup';

export const Login: React.FC = () => {
  const login = useAppStore((s) => s.login);
  const loading = useAppStore((s) => s.loading);
  const authError = useAppStore((s) => s.authError);

  const [mode, setMode] = useState<Mode>('loading');

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Setup form
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupDone, setSetupDone] = useState(false);

  // Check if any users exist on mount.
  // Note: Firestore rules may deny unauthenticated reads, so we treat
  // permission errors as "users probably exist → show login".
  // An empty result means no users → show setup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const users = await userService.getAll();
        if (cancelled) return;
        setMode(users.length === 0 ? 'setup' : 'login');
      } catch (err: any) {
        if (!cancelled) {
          // Permission denied → users collection likely has docs (rules require auth to read)
          // Missing index or other Firestore errors → default to login
          setMode('login');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await login(email, password);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    if (!setupName || !setupEmail || !setupPassword) {
      setSetupError('جميع الحقول مطلوبة');
      return;
    }
    if (setupPassword.length < 6) {
      setSetupError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setSetupError('كلمة المرور غير متطابقة');
      return;
    }

    setSetupLoading(true);
    try {
      // 1. Seed default roles
      const roles = await roleService.seedIfEmpty();
      const adminRole = roles.find((r: FirestoreRole) => r.name === 'مدير النظام') ?? roles[0];

      if (!adminRole) {
        setSetupError('فشل إنشاء الأدوار. تحقق من إعدادات Firebase.');
        setSetupLoading(false);
        return;
      }

      // 2. Create Firebase Auth account
      const cred = await createUserWithEmail(setupEmail, setupPassword);
      const uid = cred.user.uid;

      // 3. Create user document in Firestore (admin role)
      await userService.set(uid, {
        email: setupEmail,
        displayName: setupName,
        roleId: adminRole.id!,
        isActive: true,
        createdBy: 'system-setup',
      });

      // 4. Sign out (so user can log in normally)
      await signOut();

      setSetupDone(true);
      setSetupLoading(false);
    } catch (error: any) {
      let msg = 'فشل إنشاء الحساب';
      if (error?.code === 'auth/email-already-in-use') {
        msg = 'البريد الإلكتروني مسجل مسبقاً في Firebase Auth. استخدم بريد آخر أو سجل دخول.';
      } else if (error?.code === 'auth/weak-password') {
        msg = 'كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.';
      } else if (error?.code === 'auth/invalid-email') {
        msg = 'البريد الإلكتروني غير صالح.';
      }
      setSetupError(msg);
      setSetupLoading(false);
    }
  };

  // ── Loading State ──
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/30 mx-auto mb-4 animate-pulse">
            <span className="material-icons-round text-4xl">factory</span>
          </div>
          <p className="text-sm text-slate-400 font-bold">جاري التحقق...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/30 mx-auto mb-4">
            <span className="material-icons-round text-4xl">factory</span>
          </div>
          <h1 className="text-3xl font-black text-primary tracking-tight">HAKIMO</h1>
          <p className="text-sm text-slate-400 font-bold mt-1">نظام إدارة الإنتاج</p>
        </div>

        {/* ═══════════════ SETUP MODE ═══════════════ */}
        {mode === 'setup' && !setupDone && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="material-icons-round text-emerald-600 dark:text-emerald-400 text-2xl">rocket_launch</span>
              </div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white">الإعداد الأولي</h2>
              <p className="text-sm text-slate-400 mt-1">أنشئ حساب المدير الأول للبدء في استخدام النظام</p>
            </div>

            {setupError && (
              <div className="mb-5 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3">
                <span className="material-icons-round text-rose-500 text-lg">error</span>
                <span className="text-sm font-bold text-rose-700 dark:text-rose-400">{setupError}</span>
              </div>
            )}

            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">الاسم الكامل</label>
                <div className="relative">
                  <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">person</span>
                  <input
                    type="text"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="مثال: محمد أحمد"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">البريد الإلكتروني</label>
                <div className="relative">
                  <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">email</span>
                  <input
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="admin@example.com"
                    required
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">كلمة المرور</label>
                <div className="relative">
                  <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">lock</span>
                  <input
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="6 أحرف على الأقل"
                    minLength={6}
                    required
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">تأكيد كلمة المرور</label>
                <div className="relative">
                  <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">lock</span>
                  <input
                    type="password"
                    value={setupConfirm}
                    onChange={(e) => setSetupConfirm(e.target.value)}
                    className={`w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${
                      setupConfirm && setupConfirm !== setupPassword
                        ? 'border-rose-300 dark:border-rose-700'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                    placeholder="أعد كتابة كلمة المرور"
                    required
                    dir="ltr"
                  />
                </div>
                {setupConfirm && setupConfirm !== setupPassword && (
                  <p className="text-xs text-rose-500 font-bold mt-1">كلمة المرور غير متطابقة</p>
                )}
              </div>

              {/* Info box */}
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="material-icons-round text-blue-500 text-lg mt-0.5">info</span>
                <div className="text-xs text-blue-700 dark:text-blue-400">
                  <p className="font-bold mb-1">سيتم إنشاء:</p>
                  <ul className="space-y-0.5 text-blue-600 dark:text-blue-500">
                    <li>• الأدوار الافتراضية (مدير النظام، مدير المصنع، مشرف صالة، مشرف)</li>
                    <li>• حساب المدير الأول بصلاحيات كاملة</li>
                  </ul>
                </div>
              </div>

              <button
                type="submit"
                disabled={setupLoading || !setupName || !setupEmail || !setupPassword || !setupConfirm || setupPassword !== setupConfirm}
                className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {setupLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>جاري الإعداد...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-round text-xl">rocket_launch</span>
                    <span>إنشاء الحساب وبدء النظام</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ═══════════════ SETUP DONE ═══════════════ */}
        {mode === 'setup' && setupDone && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-icons-round text-emerald-500 text-3xl">check_circle</span>
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">تم الإعداد بنجاح!</h2>
            <p className="text-sm text-slate-400 mb-2">تم إنشاء حساب المدير بنجاح.</p>
            <p className="text-sm text-slate-500 mb-6">
              البريد: <span className="font-mono font-bold text-primary" dir="ltr">{setupEmail}</span>
            </p>
            <button
              onClick={() => { setMode('login'); setEmail(setupEmail); }}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-icons-round text-xl">login</span>
              <span>تسجيل الدخول الآن</span>
            </button>
          </div>
        )}

        {/* ═══════════════ LOGIN MODE ═══════════════ */}
        {mode === 'login' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-slate-800 dark:text-white">تسجيل الدخول</h2>
              <p className="text-sm text-slate-400 mt-1">أدخل بيانات حسابك للمتابعة</p>
            </div>

            {authError && (
              <div className="mb-6 px-4 py-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3">
                <span className="material-icons-round text-rose-500 text-xl">error</span>
                <span className="text-sm font-bold text-rose-700 dark:text-rose-400">{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-right"
                    placeholder="admin@example.com"
                    autoComplete="email"
                    required
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">
                  كلمة المرور
                </label>
                <div className="relative">
                  <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pr-11 pl-11 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-right"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <span className="material-icons-round text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>جاري تسجيل الدخول...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons-round text-xl">login</span>
                    <span>تسجيل الدخول</span>
                  </>
                )}
              </button>
            </form>

            {/* Link to setup (first time) */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                onClick={() => setMode('setup')}
                className="text-xs text-slate-400 hover:text-primary font-bold transition-colors"
              >
                أول مرة تستخدم النظام؟ <span className="text-primary">إعداد أولي</span>
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6 font-medium">
          © {new Date().getFullYear()} HAKIM PRODUCTION SYSTEM
        </p>
      </div>
    </div>
  );
};
