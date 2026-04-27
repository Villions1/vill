import { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock } from 'lucide-react';
import { api } from '../../lib/api';
import { useI18n } from '../../i18n/useI18n';

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsVerifying(true);
    setError('');

    try {
      const ok = await api.crypto.verifyMasterPassword(password);
      if (ok) {
        onUnlock();
      } else {
        setError(t('lock.wrong'));
        setPassword('');
      }
    } catch {
      setError(t('lock.error'));
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    const input = document.getElementById('lock-password');
    if (input) input.focus();
  }, []);

  return (
    <div className="h-screen flex items-center justify-center bg-[#1a1d23]">
      <div className="w-80 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-accent" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">valkyrieTUN</h1>
          <p className="text-sm text-text-muted mt-1">{t('lock.title')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              id="lock-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('lock.placeholder')}
              className="input-field w-full pl-10 pr-10"
              disabled={isVerifying}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isVerifying || !password.trim()}
            className="btn-primary w-full"
          >
            {isVerifying ? t('lock.verifying') : t('lock.submit')}
          </button>
        </form>

        <p className="text-xs text-text-muted mt-6">
          {t('lock.encrypted')}
        </p>
      </div>
    </div>
  );
}
