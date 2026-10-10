use serde_json::{Value, json};
use sha2::{Digest, Sha256};

pub(super) fn with_revision(mut dto: Value) -> Value {
    if let Some(revision) = dto.get_mut("revision") {
        *revision = json!("");
    }
    let digest = format!("{:x}", Sha256::digest(dto.to_string().as_bytes()));
    if let Some(revision) = dto.get_mut("revision") {
        *revision = json!(digest);
    }
    dto
}
