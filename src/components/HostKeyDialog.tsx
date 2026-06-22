import { VscWarning, VscKey, VscInfo, VscCheck } from 'react-icons/vsc';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import type { HostKeyVerificationPayload, HostKeyChangedPayload } from '@/types';

interface HostKeyDialogProps {
  /** When set, the dialog shows a "confirm new host key" prompt */
  verifyPayload: HostKeyVerificationPayload | null;
  /** When set, the dialog shows a "host key changed" warning */
  changedPayload: HostKeyChangedPayload | null;
  onAccept: (payload: HostKeyVerificationPayload) => void;
  onReject: (sessionId: string) => void;
  onClose: () => void;
}

export default function HostKeyDialog({
  verifyPayload,
  changedPayload,
  onAccept,
  onReject,
  onClose,
}: HostKeyDialogProps) {
  const isChanged = !!changedPayload;
  const payload = changedPayload ?? verifyPayload;

  if (!payload) return null;

  const displayFingerprint = isChanged
    ? (changedPayload as HostKeyChangedPayload).received_fingerprint
    : (verifyPayload as HostKeyVerificationPayload).fingerprint;

  const open = true;
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      if (verifyPayload) {
        onReject(verifyPayload.session_id);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isChanged ? 'Host Key Mismatch!' : 'Unknown Host Key'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {isChanged ? (
            <div className="flex items-start gap-3 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-3 text-sm">
              <VscWarning size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
              <div className="grid gap-1">
                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>
                  WARNING: Host key has changed!
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  The server&apos;s host key does not match the stored key. This may indicate
                  a man-in-the-middle attack.
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-md bg-accent/10 border border-accent/30 px-3 py-3 text-sm">
              <VscInfo size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>
                The authenticity of host{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {payload.host}:{payload.port}
                </strong>{' '}
                can&apos;t be established. You are seeing this for the first time.
              </span>
            </div>
          )}

          <div className="grid gap-2 rounded-md border border-border bg-[var(--bg-secondary)] p-3 text-sm">
            <div className="flex items-center gap-2">
              <VscKey size={14} />
              <span style={{ fontWeight: 600 }}>Key fingerprint</span>
            </div>
            <div className="grid gap-1 pl-6 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex gap-2">
                <span style={{ width: 80 }}>Host:</span>
                <code style={{ color: 'var(--text-primary)' }}>
                  {payload.host}:{payload.port}
                </code>
              </div>
              <div className="flex gap-2">
                <span style={{ width: 80 }}>Algorithm:</span>
                <code style={{ color: 'var(--text-primary)' }}>{payload.key_type}</code>
              </div>
              <div className="flex gap-2">
                <span style={{ width: 80 }}>SHA256:</span>
                <code
                  style={{
                    color: isChanged ? 'var(--danger)' : 'var(--text-primary)',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                  }}
                >
                  {displayFingerprint}
                </code>
              </div>
              {isChanged && (
                <div className="flex gap-2">
                  <span style={{ width: 80 }}>Expected:</span>
                  <code
                    style={{
                      color: 'var(--warning)',
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                    }}
                  >
                    {changedPayload!.expected_fingerprint}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onReject(payload.session_id);
              onClose();
            }}
          >
            <VscWarning size={14} />
            <span>{isChanged ? "Don't Connect" : 'Cancel'}</span>
          </Button>

          {verifyPayload && (
            <Button
              onClick={() => {
                onAccept(verifyPayload);
                onClose();
              }}
            >
              <VscCheck size={14} />
              <span>Accept Key</span>
            </Button>
          )}

          {isChanged && (
            <Button
              variant="destructive"
              onClick={() => {
                // For changed key, treat accept as "update stored key and connect anyway"
                if (changedPayload) {
                  onAccept({
                    session_id: changedPayload.session_id,
                    host: changedPayload.host,
                    port: changedPayload.port,
                    key_type: changedPayload.key_type,
                    fingerprint: changedPayload.received_fingerprint,
                  });
                }
                onClose();
              }}
            >
              <VscWarning size={14} />
              <span>Accept Anyway</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
