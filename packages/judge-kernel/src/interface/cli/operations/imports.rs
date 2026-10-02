use super::super::args::ImportArgs;
use super::data::{absolute, read_text_limit};
use crate::{application::tasks::TaskFailure, infrastructure::kernel::Kernel};
use serde_json::{Value, json};
use std::path::Path;
pub(super) async fn import_params(
    args: &ImportArgs,
    kernel: &Kernel,
) -> Result<Value, TaskFailure> {
    let input = args
        .file
        .as_ref()
        .or(args.input.as_ref())
        .ok_or_else(|| TaskFailure::invalid("Import file is required"))?;
    let mut data = json!({"format":args.import_format});
    if let Some(object) = data.as_object_mut() {
        if let Some(source) = &args.source {
            object.insert("source_path".into(), json!(absolute(source)?));
        }
        if let Some(dest) = &args.destination {
            object.insert("destination".into(), json!(absolute(dest)?));
        }
        if input == Path::new("-") {
            let document: Value = serde_json::from_str(
                &read_text_limit(
                    input,
                    kernel,
                    crate::application::exchange::MAX_PACKAGE_BYTES,
                )
                .await?,
            )
            .map_err(|e| TaskFailure::invalid(format!("Invalid import JSON: {e}")))?;
            object.insert("document".into(), document);
        } else {
            object.insert("input".into(), json!(absolute(input)?));
        }
    }
    Ok(data)
}
