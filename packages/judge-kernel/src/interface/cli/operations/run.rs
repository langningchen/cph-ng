use super::super::args::RunArgs;
use super::data::{absolute, details, has_data, reference, test_data};
use crate::{
    application::{error::ErrorCode, method::Method, tasks::TaskFailure},
    infrastructure::kernel::Kernel,
};
use serde_json::{Map, Value, json};

pub(super) async fn run_params(
    args: &RunArgs,
    method: Method,
    kernel: &Kernel,
) -> Result<Map<String, Value>, TaskFailure> {
    if (has_data(&args.data) && (!args.testcase_ids.is_empty() || method == Method::StressStart))
        || (method == Method::StressStart && !args.testcase_ids.is_empty())
    {
        return Err(TaskFailure::invalid(
            "Stress testing and stored testcase selection cannot be combined with temporary input",
        ));
    }
    if method == Method::TestcaseRun && args.testcase_ids.len() != 1 {
        return Err(TaskFailure::invalid(
            "testcase run requires exactly one --testcase-id",
        ));
    }
    if args
        .checker_mode
        .as_deref()
        .is_some_and(|mode| mode != "legacy")
        && (args.strict_stderr || args.regard_pe_as_ac || args.output_ratio_limit.is_some())
    {
        return Err(TaskFailure::invalid(
            "--strict-stderr, --regard-pe-as-ac and --output-ratio-limit require --checker-mode legacy",
        ));
    }
    if args.tolerance.is_some_and(|value| !value.is_finite())
        || args.output_ratio_limit.is_some_and(|v| !v.is_finite())
    {
        return Err(TaskFailure::invalid("Comparison limits must be finite"));
    }
    if method == Method::StressStart && args.jobs.is_some_and(|jobs| jobs != 1) {
        return Err(TaskFailure::invalid("Stress testing requires --jobs 1"));
    }
    let mut params = reference(&args.reference)?;
    if args.compilation.skip_compile {
        params.insert("compilation".into(), json!("skip"));
    }
    if args.compilation.force_compile {
        params.insert("compilation".into(), json!("force"));
    }
    if let Some(jobs) = args.jobs {
        params.insert("jobs".into(), json!(jobs));
    }
    details(&mut params, &args.details)?;
    test_data(&mut params, &args.data, kernel).await?;
    if let Some(mode) = &args.checker_mode {
        params.insert("checker_mode".into(), json!(mode));
    }
    if let Some(tolerance) = args.tolerance {
        params.insert("tolerance".into(), json!(tolerance));
    }
    if let Some(limit) = args.output_limit_bytes {
        params.insert("output_limit_bytes".into(), json!(limit));
    }
    let mut legacy = Map::new();
    if args.strict_stderr {
        legacy.insert("ignore_stderr".into(), json!(false));
    }
    if args.regard_pe_as_ac {
        legacy.insert("regard_pe_as_ac".into(), json!(true));
    }
    if let Some(ratio) = args.output_ratio_limit {
        legacy.insert("output_ratio_limit".into(), json!(ratio));
    }
    if !legacy.is_empty() {
        params.insert("legacy_comparison".into(), legacy.into());
    }
    if let Some(id) = &args.client_request_id {
        params.insert("client_request_id".into(), json!(id));
    }
    if method == Method::TestcaseRun {
        params.insert("testcase_id".into(), json!(args.testcase_ids.first()));
    } else if !args.testcase_ids.is_empty() {
        params.insert("testcase_ids".into(), json!(args.testcase_ids));
    }
    if args.reference.source.is_some() && (has_data(&args.data) || method == Method::StressStart) {
        let lookup = kernel
            .execute(Method::ProblemLoad, reference(&args.reference)?.into())
            .await;
        if let Err(error) = lookup {
            if error.code != ErrorCode::NotIndexed {
                return Err(error);
            }
            let source = args
                .reference
                .source
                .as_ref()
                .ok_or_else(|| TaskFailure::invalid("Source is required"))?;
            kernel.execute(Method::ProblemCreate, json!({"source_path":absolute(source)?, "name": source.file_stem().unwrap_or_default().to_string_lossy()})).await?;
        }
    }
    Ok(params)
}
