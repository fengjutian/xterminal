/// System keyring integration for secure credential storage
/// 
/// Uses the `keyring` crate which wraps:
/// - Windows Credential Manager
/// - macOS Keychain
/// - Linux Secret Service (org.freedesktop.secrets)

use keyring::Entry;

const SERVICE_NAME: &str = "x-terminal";

/// Store a password/passphrase in the system keyring
/// Returns a keyring reference ID for later retrieval
pub fn store_credential(label: &str, secret: &str) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, label)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry
        .set_secret(secret)
        .map_err(|e| format!("Failed to store secret: {}", e))?;

    Ok(label.to_string())
}

/// Retrieve a password/passphrase from the system keyring
pub fn get_credential(label: &str) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, label)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;

    entry
        .get_secret()
        .map_err(|e| format!("Failed to retrieve secret: {}", e))
}

/// Delete a credential from the system keyring
pub fn delete_credential(label: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, label)
        .map_err(|e| format!("Failed to access keyring: {}", e))?;

    entry
        .delete_credential()
        .map_err(|e| format!("Failed to delete secret: {}", e))
}
