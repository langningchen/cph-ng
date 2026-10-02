use super::{CommandService, params};
use crate::{
    application::{method::Method, models::ProblemRef, tasks::TaskFailure},
    ports::toolchain::ToolchainQuery,
};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Debug, Deserialize)]
struct ConfigParams {
    #[serde(flatten)]
    reference: ProblemRef,
    toml: Option<String>,
    patch: Option<Value>,
    expected_raw_toml: Option<String>,
}
pub(super) async fn execute(
    method: Method,
    p: Value,
    context: &CommandService,
) -> Result<Value, TaskFailure> {
    if matches!(method, Method::ToolchainDetect | Method::ToolchainCheck) {
        let query: ToolchainQuery = params(&p)?;
        return if method == Method::ToolchainDetect {
            Ok(json!({"toolchains":context.toolchains.detect(query.language).await?}))
        } else {
            Ok(json!(context.toolchains.check(query).await?))
        };
    }
    let data: ConfigParams = params(&p)?;
    let local = if data.reference.source_path.is_some()
        || data.reference.problem_id.is_some()
        || data.reference.code_id.is_some()
    {
        Some(
            context
                .repo
                .paths_for_id(context.load(&data.reference).await?.id)
                .config_path,
        )
    } else {
        None
    };
    match method {
        Method::ConfigGet => context.config.get(local.as_deref()).await,
        Method::ConfigSet => {
            context
                .config
                .set(
                    local.as_deref(),
                    data.toml.as_deref(),
                    data.patch.as_ref(),
                    data.expected_raw_toml.as_deref(),
                )
                .await
        }
        Method::ConfigInit => context.config.init(local.as_deref()).await,
        _ => Err(TaskFailure::invalid("Unsupported configuration method")),
    }
}
