use crate::{
    application::{method::Method, tasks::TaskFailure},
    infrastructure::kernel::Kernel,
};
use clap::Args;
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(Debug, Args)]
pub(super) struct DiffArgs {
    /// Saved run UUID (also suggested by shell completion).
    pub run_id: Uuid,
    /// Testcase number from the judge table (1-based); defaults to the first failed case.
    #[arg(long = "case", value_parser = clap::value_parser!(u32).range(1..))]
    pub case: Option<u32>,
    /// Context lines around each difference.
    #[arg(short = 'C', long, default_value_t = 3, value_parser = clap::value_parser!(u32).range(0..=100))]
    pub context: u32,
}

pub(super) async fn execute(args: &DiffArgs, kernel: &Kernel) -> Result<Value, TaskFailure> {
    let task = kernel
        .execute(Method::HistoryLoad, json!({"run_id":args.run_id}))
        .await?;
    let outcome = task
        .get("result")
        .ok_or_else(|| TaskFailure::invalid("This run has no testcase results"))?;
    let cases: Vec<_> = if let Some(cases) = outcome.get("testcases").and_then(Value::as_array) {
        cases.iter().collect()
    } else {
        outcome
            .get("result")
            .filter(|value| value.get("verdict").is_some())
            .into_iter()
            .collect()
    };
    let index = args.case.map_or_else(
        || {
            cases
                .iter()
                .position(|case| case.get("verdict").and_then(Value::as_str) != Some("accepted"))
                .unwrap_or(0)
        },
        |case| case as usize - 1,
    );
    let case = cases
        .get(index)
        .ok_or_else(|| TaskFailure::invalid("Testcase number is outside this run's results"))?;
    let answer = kernel.repo.read_owned_text(&kernel.repo.root().join("runs")
        .join(args.run_id.to_string()).join("cases").join((index + 1).to_string()).join("answer.txt"))
        .await.map_err(|_| TaskFailure::invalid("Original answer snapshot is unavailable for this run (older or imported history); run the judge again"))?;
    let output = case
        .get("stdout")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_owned();
    let verdict = case.get("verdict").and_then(Value::as_str).unwrap_or("");
    // A deadline bounds expensive diffs on very large or repetitive outputs.
    let diff = similar::TextDiff::configure()
        .timeout(std::time::Duration::from_secs(1))
        .diff_lines(&answer, &output)
        .unified_diff()
        .context_radius(args.context as usize)
        .header("Answer", "Output")
        .to_string();
    Ok(
        json!({"comparison_diff":diff, "run_id":args.run_id, "case_index":index + 1,
        "verdict":verdict, "answer":answer, "stdout":output, "stderr":case.get("stderr"), "message":case.get("message")}),
    )
}
