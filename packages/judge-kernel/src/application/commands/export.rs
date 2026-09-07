use super::{CommandService, params};
use crate::application::{
    error::{CommandError, ErrorCode},
    exchange::{self, ExportParams, MAX_PACKAGE_BYTES},
};
use serde_json::{Value, json};

pub(super) async fn execute(p: &Value, context: &CommandService) -> Result<Value, CommandError> {
    let data: ExportParams = params(p)?;
    let format = exchange::encode::format(&data.format)?;
    let package = exchange::snapshot(&data.reference, context).await?;
    let losses = exchange::encode::losses(&package, format);
    if data.dry_run {
        return Ok(
            json!({"format":format,"destination":data.destination,"losses":losses,"requires_force":!losses.is_empty(),"written":false}),
        );
    }
    if !losses.is_empty() && !data.force {
        return Err(CommandError {
            code: ErrorCode::Conflict,
            message: "Export would lose data; review the losses and repeat with --force".into(),
            data: Some(json!({"losses":losses,"format":format})),
        });
    }
    let bytes = exchange::encode::encode(&package, format)?;
    if bytes.len() > MAX_PACKAGE_BYTES {
        return Err(CommandError::invalid("Export exceeds 128 MiB"));
    }
    let path = context.paths.write_new(&data.destination, &bytes).await?;
    Ok(
        json!({"format":format,"destination":path,"bytes":bytes.len(),"losses":losses,"written":true}),
    )
}
