export interface AppSettings {
  theme: string;
  font_family: string;
  font_size: number;
  cursor_style: string;
  default_download_path: string;
  default_upload_path: string;
  log_level: string;
  max_concurrent_transfers: number;
  auto_copy_selection: boolean;
  scrollback_lines: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  font_family: "Consolas, 'Courier New', monospace",
  font_size: 14,
  cursor_style: 'bar',
  default_download_path: '',
  default_upload_path: '',
  log_level: 'info',
  max_concurrent_transfers: 3,
  auto_copy_selection: false,
  scrollback_lines: 5000,
};
