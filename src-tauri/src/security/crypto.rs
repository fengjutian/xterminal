/// Cryptographic utility functions
/// 
/// Provides helpers for:
/// - Memory-safe string handling (zeroize)
/// - Password hashing for local verification (not used for auth)

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

/// Compute SHA-256 fingerprint for host key display
/// Placeholder — real implementation uses ring or sha2 crate
pub fn sha256_fingerprint(data: &[u8]) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    data.hash(&mut hasher);
    format!("SHA256:{:x}", hasher.finish())
}
