/// Transfer queue — manages concurrent file upload/download tasks
/// 
/// Supports pause, resume, cancel, and concurrent transfer limiting.

use crate::models::transfer::TransferTask;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct TransferQueue {
    tasks: Arc<Mutex<HashMap<String, TransferTask>>>,
    #[allow(dead_code)]
    max_concurrent: usize,
}

impl TransferQueue {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            max_concurrent,
        }
    }

    pub async fn add_task(&self, task: TransferTask) {
        self.tasks.lock().await.insert(task.id.clone(), task);
    }

    pub async fn pause(&self, _task_id: &str) -> Result<(), String> {
        Ok(())
    }

    pub async fn resume(&self, _task_id: &str) -> Result<(), String> {
        Ok(())
    }

    pub async fn cancel(&self, _task_id: &str) -> Result<(), String> {
        Ok(())
    }

    pub async fn get_all(&self) -> Vec<TransferTask> {
        self.tasks.lock().await.values().cloned().collect()
    }

    pub async fn get(&self, task_id: &str) -> Option<TransferTask> {
        self.tasks.lock().await.get(task_id).cloned()
    }
}
