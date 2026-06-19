import type { TransferDirection, TransferProtocol, TransferState } from './connection';

export type { TransferDirection, TransferProtocol, TransferState };

export interface TransferTask {
  id: string;
  connection_id: string;
  protocol: TransferProtocol;
  direction: TransferDirection;
  local_path: string;
  remote_path: string;
  file_name: string;
  file_size: number;
  transferred_bytes: number;
  state: TransferState;
  speed_bytes_per_sec: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TransferProgressPayload {
  task_id: string;
  file_name: string;
  total_bytes: number;
  transferred_bytes: number;
  speed_bytes_per_sec: number;
  percent: number;
  direction: TransferDirection;
}

export interface SftpFileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  is_symlink: boolean;
  size: number;
  modified: string;
  permissions: string;
  owner: string | null;
  group: string | null;
}

export interface FtpFileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified: string;
  permissions: string;
}
