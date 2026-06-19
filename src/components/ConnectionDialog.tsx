import { useState, useEffect } from 'react';
import {
  VscClose,
  VscServer,
  VscKey,
  VscPass,
  VscFolderOpened,
  VscSettingsGear,
  VscInfo,
} from 'react-icons/vsc';
import { useConnectionStore } from '../stores/connectionStore';
import type { ConnectionConfig, AuthMethod, CreateConnectionPayload } from '../types';

interface Props {
  editConfig?: ConnectionConfig | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ConnectionDialog({ editConfig, onClose, onSaved }: Props) {
  const isEdit = !!editConfig;
  const connections = useConnectionStore((s) => s.connections);
  const createConnection = useConnectionStore((s) => s.createConnection);
  const updateConnection = useConnectionStore((s) => s.updateConnection);

  // Get unique groups from existing connections
  const groups = [...new Set(connections.map((c) => c.group_id).filter(Boolean) as string[])];

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [password, setPassword] = useState('');
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [groupId, setGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [encoding, setEncoding] = useState('UTF-8');
  const [keepAliveInterval, setKeepAliveInterval] = useState(60);
  const [connectionTimeout, setConnectionTimeout] = useState(30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill form when editing
  useEffect(() => {
    if (editConfig) {
      setName(editConfig.name);
      setHost(editConfig.host);
      setPort(editConfig.port);
      setUsername(editConfig.username);
      setAuthMethod(editConfig.auth_method);
      setPrivateKeyPath(editConfig.private_key_path || '');
      setGroupId(editConfig.group_id || '');
      setEncoding(editConfig.encoding || 'UTF-8');
      setKeepAliveInterval(editConfig.keep_alive_interval);
      setConnectionTimeout(editConfig.connection_timeout);
    }
  }, [editConfig]);

  const handleSave = async () => {
    setError(null);

    // Validate
    if (!name.trim()) {
      setError('Connection name is required.');
      return;
    }
    if (!host.trim()) {
      setError('Host address is required.');
      return;
    }
    if (port < 1 || port > 65535) {
      setError('Port must be between 1 and 65535.');
      return;
    }
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if ((authMethod === 'key_file' || authMethod === 'key_file_with_passphrase') && !privateKeyPath.trim()) {
      setError('Private key path is required for key-based authentication.');
      return;
    }

    setSaving(true);
    try {
      const finalGroupId = newGroupName.trim() || groupId || null;

      if (isEdit) {
        const updates: Partial<ConnectionConfig> = {
          name: name.trim(),
          host: host.trim(),
          port,
          username: username.trim(),
          auth_method: authMethod,
          private_key_path: privateKeyPath.trim() || null,
          group_id: finalGroupId,
          encoding,
          keep_alive_interval: keepAliveInterval,
          connection_timeout: connectionTimeout,
        };
        await updateConnection(editConfig!.id, updates);
      } else {
        const payload: CreateConnectionPayload = {
          name: name.trim(),
          host: host.trim(),
          port,
          username: username.trim(),
          auth_method: authMethod,
          private_key_path: privateKeyPath.trim() || null,
          group_id: finalGroupId,
          encoding,
          keep_alive_interval: keepAliveInterval,
          connection_timeout: connectionTimeout,
        };
        if (authMethod === 'password') {
          payload.password = password || null;
        }
        if (authMethod === 'key_file_with_passphrase') {
          payload.passphrase = passphrase || null;
        }
        await createConnection(payload);
      }
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleBrowseKey = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: 'Select Private Key File',
        filters: [{ name: 'Private Key', extensions: ['pem', 'key', 'ppk', ''] }],
      });
      if (selected && typeof selected === 'string') {
        setPrivateKeyPath(selected);
      }
    } catch (e) {
      console.error('File dialog error:', e);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('dialog-backdrop')) {
      onClose();
    }
  };

  return (
    <div className="dialog-backdrop" onClick={handleBackdropClick}>
      <div className="dialog">
        <div className="dialog-header">
          <h2>{isEdit ? 'Edit Connection' : 'New Connection'}</h2>
          <button className="toolbar-btn" onClick={onClose}>
            <VscClose size={18} />
          </button>
        </div>

        <div className="dialog-body">
          {error && (
            <div className="dialog-error">
              <VscInfo size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Connection Name */}
          <div className="dialog-field">
            <label className="dialog-label">Connection Name</label>
            <input
              type="text"
              className="dialog-input"
              placeholder="My Server"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Host & Port row */}
          <div className="dialog-row">
            <div className="dialog-field" style={{ flex: 1 }}>
              <label className="dialog-label">Host</label>
              <input
                type="text"
                className="dialog-input"
                placeholder="192.168.1.1 or example.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            <div className="dialog-field" style={{ width: 100 }}>
              <label className="dialog-label">Port</label>
              <input
                type="number"
                className="dialog-input"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 22)}
              />
            </div>
          </div>

          {/* Username */}
          <div className="dialog-field">
            <label className="dialog-label">Username</label>
            <input
              type="text"
              className="dialog-input"
              placeholder="root"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Authentication Method */}
          <div className="dialog-field">
            <label className="dialog-label">Authentication</label>
            <div className="dialog-radio-group">
              <label className="dialog-radio">
                <input
                  type="radio"
                  name="auth_method"
                  value="password"
                  checked={authMethod === 'password'}
                  onChange={() => setAuthMethod('password')}
                />
                <VscPass size={14} />
                <span>Password</span>
              </label>
              <label className="dialog-radio">
                <input
                  type="radio"
                  name="auth_method"
                  value="key_file"
                  checked={authMethod === 'key_file'}
                  onChange={() => setAuthMethod('key_file')}
                />
                <VscKey size={14} />
                <span>Key File</span>
              </label>
              <label className="dialog-radio">
                <input
                  type="radio"
                  name="auth_method"
                  value="key_file_with_passphrase"
                  checked={authMethod === 'key_file_with_passphrase'}
                  onChange={() => setAuthMethod('key_file_with_passphrase')}
                />
                <VscKey size={14} />
                <span>Key + Passphrase</span>
              </label>
            </div>
          </div>

          {/* Password field (only for password auth) */}
          {authMethod === 'password' && (
            <div className="dialog-field">
              <label className="dialog-label">Password</label>
              <input
                type="password"
                className="dialog-input"
                placeholder={isEdit ? '(unchanged if blank)' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {isEdit && (
                <p className="dialog-hint">Leave blank to keep existing password.</p>
              )}
            </div>
          )}

          {/* Private Key fields */}
          {(authMethod === 'key_file' || authMethod === 'key_file_with_passphrase') && (
            <>
              <div className="dialog-field">
                <label className="dialog-label">Private Key Path</label>
                <div className="dialog-input-row">
                  <input
                    type="text"
                    className="dialog-input"
                    placeholder="~/.ssh/id_rsa"
                    value={privateKeyPath}
                    onChange={(e) => setPrivateKeyPath(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn" onClick={handleBrowseKey}>
                    <VscFolderOpened size={14} />
                    <span>Browse</span>
                  </button>
                </div>
              </div>

              {authMethod === 'key_file_with_passphrase' && (
                <div className="dialog-field">
                  <label className="dialog-label">Passphrase</label>
                  <input
                    type="password"
                    className="dialog-input"
                    placeholder={isEdit ? '(unchanged if blank)' : 'Key passphrase'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {/* Group */}
          <div className="dialog-field">
            <label className="dialog-label">Group (optional)</label>
            <div className="dialog-input-row">
              <select
                className="dialog-select"
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  if (e.target.value !== '__new__') setNewGroupName('');
                }}
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="__new__">+ New group...</option>
              </select>
              {groupId === '__new__' && (
                <input
                  type="text"
                  className="dialog-input"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                  style={{ flex: 1 }}
                />
              )}
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="dialog-advanced">
            <button
              className="dialog-advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <VscSettingsGear size={14} />
              <span>Advanced Settings</span>
              <span className={`chevron ${showAdvanced ? 'open' : ''}`}>&#9654;</span>
            </button>

            {showAdvanced && (
              <div className="dialog-advanced-body">
                <div className="dialog-field">
                  <label className="dialog-label">Encoding</label>
                  <select
                    className="dialog-select"
                    value={encoding}
                    onChange={(e) => setEncoding(e.target.value)}
                  >
                    <option value="UTF-8">UTF-8</option>
                    <option value="GBK">GBK</option>
                    <option value="GB2312">GB2312</option>
                    <option value="ISO-8859-1">ISO-8859-1</option>
                    <option value="Shift_JIS">Shift_JIS</option>
                    <option value="EUC-KR">EUC-KR</option>
                  </select>
                </div>

                <div className="dialog-row">
                  <div className="dialog-field" style={{ flex: 1 }}>
                    <label className="dialog-label">Connection Timeout (seconds)</label>
                    <input
                      type="number"
                      className="dialog-input"
                      min={5}
                      max={120}
                      value={connectionTimeout}
                      onChange={(e) =>
                        setConnectionTimeout(parseInt(e.target.value, 10) || 30)
                      }
                    />
                  </div>
                  <div className="dialog-field" style={{ flex: 1 }}>
                    <label className="dialog-label">Keep-Alive Interval (seconds)</label>
                    <input
                      type="number"
                      className="dialog-input"
                      min={0}
                      max={600}
                      value={keepAliveInterval}
                      onChange={(e) =>
                        setKeepAliveInterval(parseInt(e.target.value, 10) || 0)
                      }
                    />
                    <p className="dialog-hint">0 = disabled</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave} disabled={saving}>
            <VscServer size={14} />
            <span>{saving ? 'Saving...' : isEdit ? 'Update' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
