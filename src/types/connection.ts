// X-Terminal Type Definitions — mirror of Rust models

export type AuthMethod = 'password' | 'key_file' | 'key_file_with_passphrase';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type TransferDirection = 'upload' | 'download';
export type TransferProtocol = 'sftp' | 'ftp';
export type TransferState = 'queued' | 'transferring' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ConnectionConfig {
  id: string;
  name: string;
  group_id: string | null;
  host: string;
  port: number;
  username: string;
  auth_method: AuthMethod;
  private_key_path: string | null;
  keyring_id: string | null;
  encoding: string;
  keep_alive_interval: number;
  connection_timeout: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateConnectionPayload {
  name: string;
  group_id?: string | null;
  host: string;
  port?: number;
  username: string;
  auth_method: AuthMethod;
  private_key_path?: string | null;
  passphrase?: string | null;
  password?: string | null;
  encoding?: string;
  keep_alive_interval?: number;
  connection_timeout?: number;
}

export interface UpdateConnectionPayload {
  id: string;
  name?: string;
  group_id?: string | null;
  host?: string;
  port?: number;
  username?: string;
  auth_method?: AuthMethod;
  private_key_path?: string | null;
  passphrase?: string | null;
  password?: string | null;
  encoding?: string;
  keep_alive_interval?: number;
  connection_timeout?: number;
}

export interface SshSession {
  id: string;
  connection_id: string;
  name: string;
  host: string;
  state: ConnectionState;
  connected_at: string | null;
}

export interface HostKeyVerificationPayload {
  session_id: string;
  host: string;
  port: number;
  key_type: string;
  fingerprint: string;
}

export interface HostKeyChangedPayload {
  session_id: string;
  host: string;
  port: number;
  key_type: string;
  expected_fingerprint: string;
  received_fingerprint: string;
}
