use crate::services::port_forward::{ForwardType, PortForward, PortForwardService};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct PortForwardState(pub Arc<Mutex<PortForwardService>>);

impl PortForwardState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(PortForwardService::new())))
    }
}

#[tauri::command]
pub async fn port_forward_create(
    state: State<'_, PortForwardState>,
    session_id: String,
    name: String,
    forward_type: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
) -> Result<PortForward, String> {
    let ft = match forward_type.as_str() {
        "local" => ForwardType::Local,
        "remote" => ForwardType::Remote,
        "dynamic" => ForwardType::Dynamic,
        _ => return Err("Invalid forward type".to_string()),
    };
    let service = state.0.lock().await;
    service.create(&session_id, &name, ft, local_port, &remote_host, remote_port).await
}

#[tauri::command]
pub async fn port_forward_start(
    state: State<'_, PortForwardState>,
    id: String,
) -> Result<(), String> {
    let service = state.0.lock().await;
    service.start(&id).await
}

#[tauri::command]
pub async fn port_forward_stop(
    state: State<'_, PortForwardState>,
    id: String,
) -> Result<(), String> {
    let service = state.0.lock().await;
    service.stop(&id).await
}

#[tauri::command]
pub async fn port_forward_list(
    state: State<'_, PortForwardState>,
) -> Result<Vec<PortForward>, String> {
    let service = state.0.lock().await;
    Ok(service.list().await)
}

#[tauri::command]
pub async fn port_forward_delete(
    state: State<'_, PortForwardState>,
    id: String,
) -> Result<(), String> {
    let service = state.0.lock().await;
    service.delete(&id).await
}
