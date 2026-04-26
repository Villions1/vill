import { useState, useEffect } from 'react';
import { Plus, Play, Edit, Trash2, FileCode, Save, X, Variable } from 'lucide-react';
import { api } from '../../lib/api';
import { useTerminalStore } from '../../store';
import type { Script, ScriptVariable } from '../../types';

export function ScriptLibraryView() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [editing, setEditing] = useState<Script | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [variablePrompt, setVariablePrompt] = useState<{
    script: Script;
    variables: Record<string, string>;
    connId: string;
  } | null>(null);

  const tabs = useTerminalStore((s) => s.tabs);

  const loadScripts = async () => {
    const result = await api.scripts.getAll();
    const parsed = (result as Record<string, unknown>[]).map((s) => ({
      ...s,
      tags: typeof s.tags === 'string' ? JSON.parse(s.tags as string) : s.tags || [],
      hostIds: typeof s.hostIds === 'string' ? JSON.parse(s.hostIds as string) : s.hostIds || [],
      groupIds: typeof s.groupIds === 'string' ? JSON.parse(s.groupIds as string) : s.groupIds || [],
      variables: typeof s.variables === 'string' ? JSON.parse(s.variables as string) : s.variables || [],
    })) as Script[];
    setScripts(parsed);
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const handleRun = (script: Script) => {
    const connectedTabs = tabs.filter((t) => t.isConnected && t.connectionId);
    if (connectedTabs.length === 0) {
      alert('No connected terminal sessions');
      return;
    }
    const connId = connectedTabs[0].connectionId!;

    // Check for variables
    const varMatches = script.content.match(/\{\{(\w+)\}\}/g);
    if (varMatches && varMatches.length > 0) {
      const vars: Record<string, string> = {};
      for (const match of varMatches) {
        const name = match.replace(/\{\{|\}\}/g, '');
        const def = script.variables.find((v) => v.name === name);
        vars[name] = def?.defaultValue || '';
      }
      setVariablePrompt({ script, variables: vars, connId });
      return;
    }

    api.scripts.run(connId, script.content);
  };

  const executeWithVars = () => {
    if (!variablePrompt) return;
    let content = variablePrompt.script.content;
    for (const [key, value] of Object.entries(variablePrompt.variables)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    api.scripts.run(variablePrompt.connId, content);
    setVariablePrompt(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this script?')) return;
    await api.scripts.delete(id);
    await loadScripts();
  };

  if (editing || isCreating) {
    return (
      <ScriptEditorPanel
        script={editing}
        onSave={async (data) => {
          if (editing) await api.scripts.update(editing.id, data);
          else await api.scripts.create(data);
          await loadScripts();
          setEditing(null);
          setIsCreating(false);
        }}
        onClose={() => {
          setEditing(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Script Library</h2>
          <p className="text-sm text-text-secondary">Saved shell snippets and automation</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="btn-primary flex items-center gap-1">
          <Plus size={14} /> New Script
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {scripts.map((script) => (
          <div key={script.id} className="card flex items-start gap-4 group">
            <FileCode size={20} className="text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-text-primary">{script.name}</div>
              {script.description && (
                <div className="text-xs text-text-muted mt-0.5">{script.description}</div>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                {(script.tags || []).map((tag) => (
                  <span key={tag} className="badge-blue">{tag}</span>
                ))}
                {(script.variables || []).length > 0 && (
                  <span className="badge-yellow flex items-center gap-1">
                    <Variable size={10} />
                    {script.variables.length} vars
                  </span>
                )}
              </div>
              <pre className="mt-2 p-2 bg-surface rounded text-2xs font-mono text-text-secondary max-h-20 overflow-hidden">
                {script.content.slice(0, 200)}
                {script.content.length > 200 ? '...' : ''}
              </pre>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleRun(script)}
                className="p-1.5 hover:bg-success/20 rounded"
                title="Run"
              >
                <Play size={14} className="text-success" />
              </button>
              <button
                onClick={() => setEditing(script)}
                className="p-1.5 hover:bg-surface-overlay rounded"
              >
                <Edit size={14} className="text-text-secondary" />
              </button>
              <button
                onClick={() => handleDelete(script.id)}
                className="p-1.5 hover:bg-danger/20 rounded"
              >
                <Trash2 size={14} className="text-danger" />
              </button>
            </div>
          </div>
        ))}
        {scripts.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <FileCode size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No scripts saved yet</p>
          </div>
        )}
      </div>

      {/* Variable prompt */}
      {variablePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-96 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Script Variables</h3>
            {Object.entries(variablePrompt.variables).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm text-text-secondary mb-1">{`{{${key}}}`}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) =>
                    setVariablePrompt({
                      ...variablePrompt,
                      variables: { ...variablePrompt.variables, [key]: e.target.value },
                    })
                  }
                  className="input-field"
                />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button onClick={() => setVariablePrompt(null)} className="btn-ghost">Cancel</button>
              <button onClick={executeWithVars} className="btn-primary">Run</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScriptEditorPanel({
  script,
  onSave,
  onClose,
}: {
  script: Script | null;
  onSave: (data: Partial<Script>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: script?.name || '',
    description: script?.description || '',
    content: script?.content || '',
    tags: (script?.tags || []).join(', '),
    variables: (script?.variables || []) as ScriptVariable[],
  });

  const handleSave = () => {
    if (!form.name.trim() || !form.content.trim()) return;
    onSave({
      name: form.name,
      description: form.description,
      content: form.content,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      variables: form.variables,
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-text-primary">
          {script ? 'Edit Script' : 'New Script'}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="btn-primary flex items-center gap-1">
            <Save size={14} /> Save
          </button>
          <button onClick={onClose} className="btn-ghost">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="deploy, monitoring, setup"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">
            Script Content
            <span className="text-text-muted ml-2">
              Use {'{{VARIABLE}}'} syntax for runtime variables
            </span>
          </label>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            rows={15}
            className="input-field font-mono text-sm resize-none"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
