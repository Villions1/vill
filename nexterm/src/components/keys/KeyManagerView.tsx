import { useState, useEffect } from 'react';
import {
  KeyRound, Plus, Download, Trash2, RefreshCw, Copy, Eye, EyeOff, Shield,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { SSHKey } from '../../types';

interface LocalKeyInfo {
  path: string;
  name: string;
  type: string;
  imported: boolean;
}

export function KeyManagerView() {
  const [keys, setKeys] = useState<SSHKey[]>([]);
  const [localKeys, setLocalKeys] = useState<LocalKeyInfo[]>([]);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState<string | null>(null);

  // Generator form
  const [genForm, setGenForm] = useState({
    name: '',
    type: 'ed25519' as 'rsa' | 'ed25519' | 'ecdsa',
    bits: 4096,
    passphrase: '',
    comment: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const loadKeys = async () => {
    const result = await api.keys.getAll();
    setKeys(result as SSHKey[]);
  };

  const detectKeys = async () => {
    const result = await api.keys.detectLocal();
    setLocalKeys(result as LocalKeyInfo[]);
  };

  useEffect(() => {
    loadKeys();
    detectKeys();
  }, []);

  const handleGenerate = async () => {
    if (!genForm.name.trim()) return;
    setIsGenerating(true);
    try {
      await api.keys.generate(genForm);
      setShowGenerator(false);
      setGenForm({ name: '', type: 'ed25519', bits: 4096, passphrase: '', comment: '' });
      await loadKeys();
      await detectKeys();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImport = async (keyPath: string) => {
    try {
      await api.keys.import(keyPath);
      await loadKeys();
      await detectKeys();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this key from NexTerm? (The key file on disk will not be removed.)')) return;
    await api.keys.delete(id);
    await loadKeys();
    await detectKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">SSH Keys</h2>
          <p className="text-sm text-text-secondary">Manage your SSH keys and credentials</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={detectKeys} className="btn-ghost flex items-center gap-1">
            <RefreshCw size={14} /> Detect
          </button>
          <button onClick={() => setShowGenerator(true)} className="btn-primary flex items-center gap-1">
            <Plus size={14} /> Generate Key
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Key Generator */}
        {showGenerator && (
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <KeyRound size={16} className="text-accent" />
              Generate New Key
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Key Name</label>
                <input
                  type="text"
                  value={genForm.name}
                  onChange={(e) => setGenForm({ ...genForm, name: e.target.value })}
                  placeholder="my-server-key"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Type</label>
                <select
                  value={genForm.type}
                  onChange={(e) => setGenForm({ ...genForm, type: e.target.value as 'rsa' | 'ed25519' | 'ecdsa' })}
                  className="select-field"
                >
                  <option value="ed25519">ED25519 (recommended)</option>
                  <option value="rsa">RSA</option>
                  <option value="ecdsa">ECDSA</option>
                </select>
              </div>
            </div>
            {(genForm.type === 'rsa' || genForm.type === 'ecdsa') && (
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Key Size (bits)
                </label>
                <select
                  value={genForm.bits}
                  onChange={(e) => setGenForm({ ...genForm, bits: parseInt(e.target.value) })}
                  className="select-field"
                >
                  {genForm.type === 'rsa'
                    ? [2048, 3072, 4096].map((b) => <option key={b} value={b}>{b}</option>)
                    : [256, 384, 521].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Passphrase (optional)</label>
                <input
                  type="password"
                  value={genForm.passphrase}
                  onChange={(e) => setGenForm({ ...genForm, passphrase: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Comment</label>
                <input
                  type="text"
                  value={genForm.comment}
                  onChange={(e) => setGenForm({ ...genForm, comment: e.target.value })}
                  placeholder="user@host"
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleGenerate} className="btn-primary" disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
              <button onClick={() => setShowGenerator(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        {/* Managed Keys */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Managed Keys ({keys.length})</h3>
          <div className="space-y-2">
            {keys.map((key) => (
              <div key={key.id} className="card flex items-center gap-4">
                <Shield size={20} className="text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-text-primary">{key.name}</div>
                  <div className="text-xs text-text-muted flex items-center gap-2">
                    <span className="badge-blue">{key.type.toUpperCase()}</span>
                    <span className="truncate">{key.privateKeyPath}</span>
                    {key.hasPassphrase && <span className="badge-yellow">Passphrase</span>}
                  </div>
                  {key.fingerprint && (
                    <div className="text-2xs text-text-muted font-mono mt-1 truncate">
                      {key.fingerprint}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {key.publicKey && (
                    <>
                      <button
                        onClick={() => setShowPublicKey(showPublicKey === key.id ? null : key.id)}
                        className="p-1.5 hover:bg-surface-overlay rounded"
                        title="Show public key"
                      >
                        {showPublicKey === key.id ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(key.publicKey!)}
                        className="p-1.5 hover:bg-surface-overlay rounded"
                        title="Copy public key"
                      >
                        <Copy size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="p-1.5 hover:bg-danger/20 rounded"
                  >
                    <Trash2 size={14} className="text-danger" />
                  </button>
                </div>
                {showPublicKey === key.id && key.publicKey && (
                  <div className="w-full mt-2 p-2 bg-surface rounded text-2xs font-mono text-text-secondary break-all">
                    {key.publicKey}
                  </div>
                )}
              </div>
            ))}
            {keys.length === 0 && (
              <div className="text-center py-8 text-text-muted text-sm">
                No keys managed yet. Generate or import one.
              </div>
            )}
          </div>
        </div>

        {/* Detected Local Keys */}
        {localKeys.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Detected in ~/.ssh ({localKeys.filter((k) => !k.imported).length} available)
            </h3>
            <div className="space-y-2">
              {localKeys.map((key) => (
                <div key={key.path} className="card flex items-center gap-4">
                  <KeyRound size={20} className={key.imported ? 'text-success' : 'text-text-muted'} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-text-primary">{key.name}</div>
                    <div className="text-xs text-text-muted flex items-center gap-2">
                      <span className="badge-blue">{key.type.toUpperCase()}</span>
                      <span className="truncate">{key.path}</span>
                    </div>
                  </div>
                  {key.imported ? (
                    <span className="badge-green">Imported</span>
                  ) : (
                    <button
                      onClick={() => handleImport(key.path)}
                      className="btn-ghost flex items-center gap-1 text-sm"
                    >
                      <Download size={14} /> Import
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
