/// Cryptographic utility functions
///
/// Provides helpers for:
/// - SHA-256 fingerprint computation for SSH host key verification
/// - Memory-safe string handling (zeroize)
/// - Password hashing for local verification (not used for auth)

use sha2::{Digest, Sha256};
use zeroize::Zeroize;

/// A string wrapper that zeroizes memory on drop
#[derive(Clone)]
pub struct SecretString(String);

impl SecretString {
    pub fn new(s: String) -> Self {
        Self(s)
    }

    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl Drop for SecretString {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl From<String> for SecretString {
    fn from(s: String) -> Self {
        Self::new(s)
    }
}

/// Compute the standard SSH SHA-256 fingerprint of a public key's raw bytes.
///
/// Returns the fingerprint in the standard format used by OpenSSH:
/// `SHA256:<base64-encoded-hash>`
///
/// The input should be the raw encoded public key bytes (in SSH wire format),
/// as provided by the server during key exchange.
pub fn sha256_fingerprint(public_key_bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(public_key_bytes);
    let digest = hasher.finalize();
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, digest);
    format!("SHA256:{}", b64)
}
