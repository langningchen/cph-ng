use super::super::args::{HistoryAction, IndexAction, ProblemAction, ProblemRef, TestcaseAction};
use super::data::{absolute, details, reference, test_data};
use crate::{
    application::{method::Method, tasks::TaskFailure},
    infrastructure::kernel::Kernel,
};
use serde_json::{Map, Value, json};

pub(super) fn problem(action: &ProblemAction) -> Result<(Method, Value), TaskFailure> {
    Ok(match action {
        ProblemAction::Sources(value) => (Method::ProblemSources, reference(value)?.into()),
        ProblemAction::Link {
            reference: value,
            destination,
        } => {
            let mut params = reference(value)?;
            params.insert("destination".into(), json!(absolute(destination)?));
            (Method::ProblemLink, params.into())
        }
        ProblemAction::Export(args) => export(args)?,
        ProblemAction::List => (Method::ProblemList, json!({})),
        ProblemAction::Load(value) => (Method::ProblemLoad, reference(value)?.into()),
        ProblemAction::Delete(value) => (Method::ProblemDelete, reference(value)?.into()),
        ProblemAction::Create {
            source,
            name,
            source_code,
            url,
            details: options,
        } => {
            let mut params = Map::from_iter([
                ("source_path".into(), json!(absolute(source)?)),
                (
                    "name".into(),
                    json!(name.clone().unwrap_or_else(|| {
                        source
                            .file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .into_owned()
                    })),
                ),
            ]);
            if let Some(value) = source_code {
                params.insert("source_code".into(), json!(value));
            }
            if let Some(value) = url {
                params.insert("url".into(), json!(value));
            }
            details(&mut params, options)?;
            (Method::ProblemCreate, params.into())
        }
        ProblemAction::Update {
            reference: value,
            name,
            url,
            clear_url,
            details: options,
        } => {
            let mut params = reference(value)?;
            if let Some(value) = name {
                params.insert("name".into(), json!(value));
            }
            if *clear_url {
                params.insert("url".into(), Value::Null);
            } else if let Some(value) = url {
                params.insert("url".into(), json!(value));
            }
            details(&mut params, options)?;
            (Method::ProblemUpdate, params.into())
        }
        ProblemAction::Import(_) | ProblemAction::Move { .. } => {
            return Err(TaskFailure::invalid("Unsupported command"));
        }
    })
}

pub(super) async fn testcase(
    action: &TestcaseAction,
    kernel: &Kernel,
) -> Result<(Method, Value), TaskFailure> {
    Ok(match action {
        TestcaseAction::List(value) => (Method::TestcaseList, reference(value)?.into()),
        TestcaseAction::Add(args) | TestcaseAction::Update(args) => {
            let mut params = reference(&args.reference)?;
            if let Some(id) = args.testcase_id {
                params.insert("testcase_id".into(), json!(id));
            }
            test_data(&mut params, &args.data, kernel).await?;
            (
                if matches!(action, TestcaseAction::Add(_)) {
                    Method::TestcaseAdd
                } else {
                    Method::TestcaseUpdate
                },
                params.into(),
            )
        }
        TestcaseAction::Delete {
            reference: value,
            testcase_id,
        } => {
            let mut params = reference(value)?;
            params.insert("testcase_id".into(), json!(testcase_id));
            (Method::TestcaseDelete, params.into())
        }
        TestcaseAction::Reorder {
            reference: value,
            testcase_ids,
        } => {
            let mut params = reference(value)?;
            params.insert("testcase_ids".into(), json!(testcase_ids));
            (Method::TestcaseReorder, params.into())
        }
        TestcaseAction::Run(_) | TestcaseAction::RunAll(_) => {
            return Err(TaskFailure::invalid("Unsupported command"));
        }
    })
}

pub(super) fn index(action: &IndexAction) -> Result<(Method, Value), TaskFailure> {
    Ok(match action {
        IndexAction::Resolve { source } => (
            Method::IndexResolve,
            json!({"source_path":absolute(source)?}),
        ),
        IndexAction::Reindex { source, problem_id }
        | IndexAction::Rebuild {
            source: Some(source),
            problem_id: Some(problem_id),
        } => (
            Method::IndexReindexFile,
            json!({"source_path":absolute(source)?, "problem_id":problem_id}),
        ),
        IndexAction::Rebuild {
            source: None,
            problem_id: None,
        } => (Method::IndexRebuild, json!({})),
        IndexAction::Rebuild { .. } => {
            return Err(TaskFailure::invalid(
                "A source and --problem-id must be provided together",
            ));
        }
    })
}

pub(super) fn history(action: &HistoryAction) -> Result<(Method, Value), TaskFailure> {
    Ok(match action {
        HistoryAction::List {
            source,
            problem_id,
            code_id,
            limit,
            offset,
        } => {
            let mut params = reference(&ProblemRef {
                source: source.clone(),
                problem_id: *problem_id,
                code_id: *code_id,
            })?;
            params.insert("limit".into(), json!(limit));
            params.insert("offset".into(), json!(offset));
            (Method::HistoryList, params.into())
        }
        HistoryAction::Load { run_id } => (Method::HistoryLoad, json!({"run_id":run_id})),
    })
}

pub(super) fn export(
    args: &super::super::args::ExportArgs,
) -> Result<(Method, Value), TaskFailure> {
    let mut p = reference(&args.reference)?;
    p.insert("destination".into(), json!(absolute(&args.destination)?));
    p.insert("format".into(), json!(args.export_format));
    p.insert("force".into(), json!(args.force));
    p.insert("dry_run".into(), json!(args.dry_run));
    Ok((Method::ProblemExport, p.into()))
}
