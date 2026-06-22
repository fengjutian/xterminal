import { useState, useEffect } from 'react';
import {
  VscServer,
  VscKey,
  VscPass,
  VscFolderOpened,
  VscSettingsGear,
  VscInfo,
} from 'react-icons/vsc';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
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
        const updates: Partial<ConnectionConfig> & { password?: string | null; passphrase?: string | null } = {
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
        if (password) {
          updates.password = password;
        }
        if (passphrase) {
          updates.passphrase = passphrase;
        }
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
        title: '选择私钥文件',
        filters: [{ name: 'Private Key', extensions: ['pem', 'key', 'ppk', ''] }],
      });
      if (selected && typeof selected === 'string') {
        setPrivateKeyPath(selected);
      }
    } catch (e) {
      console.error('File dialog error:', e);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑连接' : '新建连接'}</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            <VscInfo size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 py-2">
          {/* Connection Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="name">连接名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="我的服务器"
              autoFocus
            />
          </div>

          {/* Host & Port row */}
          <div className="flex gap-3">
            <div className="flex-1 grid gap-1.5">
              <Label htmlFor="host">主机</Label>
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1 或 example.com"
              />
            </div>
            <div className="w-[100px] grid gap-1.5">
              <Label htmlFor="port">端口</Label>
              <Input
                id="port"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 22)}
              />
            </div>
          </div>

          {/* Username */}
          <div className="grid gap-1.5">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
            />
          </div>

          {/* Authentication Method */}
          <div className="grid gap-1.5">
            <Label>认证方式</Label>
            <div className="flex border border-input rounded-md overflow-hidden">
              {([
                { value: 'password' as AuthMethod, icon: VscPass, label: '密码' },
                { value: 'key_file' as AuthMethod, icon: VscKey, label: '密钥文件' },
                { value: 'key_file_with_passphrase' as AuthMethod, icon: VscKey, label: '密钥 + 口令' },
              ]).map((opt, i) => (
                <label
                  key={opt.value}
                  className={[
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 cursor-pointer text-xs transition-colors',
                    'text-muted-foreground hover:text-foreground',
                    authMethod === opt.value
                      ? 'bg-accent text-accent-foreground font-semibold'
                      : 'bg-transparent',
                    i < 2 ? 'border-r border-input' : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="auth_method"
                    value={opt.value}
                    checked={authMethod === opt.value}
                    onChange={() => setAuthMethod(opt.value)}
                    className="sr-only"
                  />
                  <opt.icon size={14} />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Password field (only for password auth) */}
          {authMethod === 'password' && (
            <div className="grid gap-1.5">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? '（留空不变）' : '密码'}
              />
              {isEdit && (
                <p className="text-[11px] text-muted-foreground leading-tight">
                  留空则保持现有密码不变。
                </p>
              )}
            </div>
          )}

          {/* Private Key fields */}
          {(authMethod === 'key_file' || authMethod === 'key_file_with_passphrase') && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="privateKey">私钥路径</Label>
                <div className="flex gap-2">
                  <Input
                    id="privateKey"
                    value={privateKeyPath}
                    onChange={(e) => setPrivateKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_rsa"
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={handleBrowseKey}>
                    <VscFolderOpened size={14} />
                    <span>浏览</span>
                  </Button>
                </div>
              </div>

              {authMethod === 'key_file_with_passphrase' && (
                <div className="grid gap-1.5">
                  <Label htmlFor="passphrase">口令</Label>
                  <Input
                    id="passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={isEdit ? '（留空不变）' : '密钥口令'}
                  />
                </div>
              )}
            </>
          )}

          {/* Group */}
          <div className="grid gap-1.5">
            <Label htmlFor="group">分组（可选）</Label>
            <div className="flex gap-2">
              <select
                id="group"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  if (e.target.value !== '__new__') setNewGroupName('');
                }}
              >
                <option value="">无分组</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="__new__">+ 新建分组...</option>
              </select>
              {groupId === '__new__' && (
                <Input
                  placeholder="分组名称"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  autoFocus
                  className="flex-1"
                />
              )}
            </div>
          </div>

          {/* Advanced Settings */}
          <div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none p-0 font-inherit"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <VscSettingsGear size={14} />
              <span>高级设置</span>
              <span className={`text-[10px] transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>
                ▶
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-3 grid gap-4 pl-4 border-l-2 border-border">
                <div className="grid gap-1.5">
                  <Label htmlFor="encoding">编码</Label>
                  <select
                    id="encoding"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
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

                <div className="flex gap-3">
                  <div className="flex-1 grid gap-1.5">
                    <Label htmlFor="timeout">连接超时（秒）</Label>
                    <Input
                      id="timeout"
                      type="number"
                      min={5}
                      max={120}
                      value={connectionTimeout}
                      onChange={(e) =>
                        setConnectionTimeout(parseInt(e.target.value, 10) || 30)
                      }
                    />
                  </div>
                  <div className="flex-1 grid gap-1.5">
                    <Label htmlFor="keepalive">心跳间隔（秒）</Label>
                    <Input
                      id="keepalive"
                      type="number"
                      min={0}
                      max={600}
                      value={keepAliveInterval}
                      onChange={(e) =>
                        setKeepAliveInterval(parseInt(e.target.value, 10) || 0)
                      }
                    />
                    <p className="text-[11px] text-muted-foreground leading-tight">0 = 禁用</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <VscServer size={14} />
            {saving ? '保存中...' : isEdit ? '更新' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
