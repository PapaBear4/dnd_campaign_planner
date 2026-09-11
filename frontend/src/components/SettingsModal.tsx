import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Key, Sparkles, Server, Check, X, ShieldAlert, RefreshCw, AlertCircle, Cpu } from 'lucide-react';
import { getSettings, queryAvailableModels, updateSettings } from '../api';
import { AppSettings, GeminiModelInfo } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSettingsSaved }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Dynamic models state — always pulled from server
  const [availableModels, setAvailableModels] = useState<GeminiModelInfo[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelQuerySource, setModelQuerySource] = useState<'api' | 'fallback' | 'error'>('fallback');
  const [modelQueryError, setModelQueryError] = useState<string | null>(null);

  const debounceTimerRef = useRef<any>(null);

  const loadSettingsAndModels = async () => {
    setIsFetchingModels(true);
    setModelQueryError(null);
    try {
      // 1. Fetch current settings from server (includes saved model)
      const currentSettings = await getSettings();
      setSettings(currentSettings);
      const savedModel = (currentSettings.gemini_model || '').trim();

      // 2. Fetch live available models list from server
      const modelsRes = await queryAvailableModels();
      const serverModels: GeminiModelInfo[] = [...(modelsRes.models || [])];

      // 3. Ensure the saved model is preserved in the dropdown options
      if (savedModel && !serverModels.some((m) => m.id === savedModel)) {
        serverModels.unshift({
          id: savedModel,
          display_name: `${savedModel} (Saved)`,
          description: 'Currently configured model on server',
        });
      }

      setAvailableModels(serverModels);
      const src = (modelsRes.source as 'api' | 'fallback' | 'error') || (modelsRes.error ? 'error' : 'api');
      setModelQuerySource(src);
      if (modelsRes.error) {
        setModelQueryError(modelsRes.error);
      } else {
        setModelQueryError(null);
      }

      // 4. Whatever model the user saved is the one that loads up
      if (savedModel) {
        setModel(savedModel);
      } else if (serverModels.length > 0) {
        setModel(serverModels[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load settings or models from server:', err);
      setModelQueryError(err.message || 'Failed to query models from server');
      setModelQuerySource('error');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const fetchModels = async (keyToUse?: string) => {
    setIsFetchingModels(true);
    setModelQueryError(null);
    try {
      const res = await queryAvailableModels(keyToUse);
      const serverModels: GeminiModelInfo[] = [...(res.models || [])];

      // Keep currently selected model represented in options so user's choice isn't wiped
      if (model && !serverModels.some((m) => m.id === model) && model !== 'custom') {
        serverModels.unshift({
          id: model,
          display_name: `${model} (Selected)`,
          description: 'Currently selected model',
        });
      }

      setAvailableModels(serverModels);
      if (res.error) {
        setModelQueryError(res.error);
        setModelQuerySource('error');
      } else {
        setModelQuerySource((res.source as 'api' | 'fallback' | 'error') || 'api');
        // If no model currently selected, select top model from server
        if (!model && serverModels.length > 0) {
          setModel(serverModels[0].id);
        }
      }
    } catch (err: any) {
      setModelQueryError(err.message || 'Failed to query models from server');
      setModelQuerySource('error');
    } finally {
      setIsFetchingModels(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSettingsAndModels();
    }
  }, [isOpen]);

  // When user types an API key, automatically query server for models (debounced)
  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const cleanKey = val.trim();
    if (cleanKey.length >= 10) {
      debounceTimerRef.current = setTimeout(() => {
        fetchModels(cleanKey);
      }, 600);
    } else if (!cleanKey) {
      setModelQueryError(null);
      // Query models with existing server key if input cleared
      fetchModels();
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const selectedModel = (model === 'custom' ? customModel.trim() : model).trim();
      if (!selectedModel) {
        alert('Please select or specify a model.');
        setIsSaving(false);
        return;
      }
      const payload: any = { gemini_model: selectedModel };
      if (apiKey.trim()) {
        payload.gemini_api_key = apiKey.trim();
      }
      const updated = await updateSettings(payload);
      setSettings(updated);
      setModel(updated.gemini_model);
      setSavedSuccess(true);
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to save settings: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: 'min(90vh, 780px)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
          border: '1px solid var(--border-medium)',
          background: 'var(--bg-card)',
          margin: 'auto',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0f1420',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Campaign Settings &amp; AI Engine</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Configure Gemini Co-DM and Local Network sharing</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          {/* Gemini API Key */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Gemini API Key
              </label>
              <button
                type="button"
                onClick={() => fetchModels(apiKey.trim() || undefined)}
                disabled={isFetchingModels}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '2px 8px', color: 'var(--color-gold)' }}
                title="Query server to fetch available models for this key"
              >
                <RefreshCw size={13} className={isFetchingModels ? 'animate-spin' : ''} />
                {isFetchingModels ? 'Querying...' : 'Query Models'}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder={settings?.gemini_api_key_configured ? "•••••••••••••••• (Configured - enter new to change)" : "Paste AIzaSy... API Key"}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  paddingLeft: '38px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <Key size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
            </div>

            {/* Status / Feedback message below API Key */}
            <div style={{ marginTop: '8px', fontSize: '0.78rem' }}>
              {isFetchingModels && (
                <span style={{ color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={13} className="animate-spin" />
                  Querying server for available models...
                </span>
              )}
              {!isFetchingModels && modelQuerySource === 'api' && (
                <span style={{ color: 'var(--color-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} />
                  Connected! Queried server: {availableModels.length} models available for your key.
                </span>
              )}
              {!isFetchingModels && modelQueryError && (
                <span style={{ color: 'var(--color-crimson)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  {modelQueryError}
                </span>
              )}
              {!isFetchingModels && !modelQueryError && modelQuerySource !== 'api' && (
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {settings?.gemini_api_key_configured ? (
                    <span style={{ color: 'var(--color-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={14} /> Key configured on server.
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldAlert size={14} /> Enter key to unlock live Gemini models and Co-DM features.
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Model Selection */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={15} style={{ color: 'var(--color-arcane-cyan)' }} />
                Gemini AI Model
              </label>
              {modelQuerySource === 'api' && (
                <span style={{ fontSize: '0.72rem', background: 'var(--status-completed-bg)', color: 'var(--status-completed-text)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--status-completed-border)' }}>
                  Server Model List
                </span>
              )}
            </div>

            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isFetchingModels && availableModels.length === 0}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            >
              {availableModels.length === 0 && !model && (
                <option value="">Fetching models from server...</option>
              )}
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name} ({m.id}) {m.description ? `• ${m.description.slice(0, 50)}...` : ''}
                </option>
              ))}
              <option value="custom">Custom Model Identifier...</option>
            </select>

            {model === 'custom' && (
              <input
                type="text"
                placeholder="Enter model identifier (e.g. gemini-flash-latest or custom endpoint)"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            )}
          </div>

          {/* Local LAN Sharing Info */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Server size={16} style={{ color: 'var(--color-arcane-cyan)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Local Network (LAN) Player Access</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              The server listens on all interfaces (<code>0.0.0.0</code>). Players on your Wi-Fi can open:
            </p>
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                padding: '6px 10px',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--text-gold)',
                marginTop: '6px',
              }}
            >
              http://&lt;your-local-ip&gt;:3000/player
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
            {savedSuccess && (
              <span style={{ color: 'var(--color-emerald)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={16} /> Settings saved!
              </span>
            )}
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
