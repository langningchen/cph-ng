use super::{HashSet, Package, TaskFailure};
pub(in crate::application::exchange) fn validate(package: &Package) -> Result<(), TaskFailure> {
    if package.format != "cph-ng" || package.version != 1 {
        return Err(TaskFailure::invalid("Unsupported native package version"));
    }
    if package.sources.is_empty() || package.sources.len() > 256 || package.auxiliary.len() > 4 {
        return Err(TaskFailure::invalid("Invalid number of packaged sources"));
    }
    crate::application::config::validate(&package.effective_config)?;
    let _: toml::Value =
        toml::from_str(&package.config_toml).map_err(|e| TaskFailure::invalid(e.to_string()))?;
    if !(1..=300_000).contains(&package.problem.time_limit) || package.problem.memory_limit == 0 {
        return Err(TaskFailure::invalid("Invalid packaged resource limits"));
    }
    let codes: HashSet<_> = package
        .sources
        .iter()
        .map(|source| source.code_id.to_string())
        .collect();
    let paths: HashSet<_> = package
        .sources
        .iter()
        .map(|source| &source.file.path)
        .collect();
    if codes.len() != package.sources.len()
        || paths.len() != package.sources.len()
        || !paths.contains(&package.problem.src.0)
    {
        return Err(TaskFailure::invalid(
            "Duplicate or missing packaged source identity",
        ));
    }
    validate_files(package)?;
    validate_testcases(package)?;
    validate_history(package, &codes)
}
fn validate_testcases(package: &Package) -> Result<(), TaskFailure> {
    let tests: HashSet<_> = package.testcases.iter().map(|case| case.id).collect();
    let ordered: Vec<_> = package
        .problem
        .testcases
        .iter()
        .map(|case| case.id.0)
        .collect();
    if tests.len() != package.testcases.len()
        || ordered
            != package
                .testcases
                .iter()
                .map(|case| case.id)
                .collect::<Vec<_>>()
    {
        return Err(TaskFailure::invalid(
            "Packaged testcase order or identities do not match",
        ));
    }
    if package
        .testcases
        .iter()
        .map(|c| c.stdin.len() + c.answer.len())
        .sum::<usize>()
        > 16 * 1024 * 1024
    {
        return Err(TaskFailure::invalid("Testcases exceed 16 MiB"));
    }
    Ok(())
}
fn validate_history(package: &Package, codes: &HashSet<String>) -> Result<(), TaskFailure> {
    let mut runs = HashSet::new();
    for run in &package.history {
        if !run.state.is_final()
            || run.problem_id.as_deref() != Some(&package.problem.id.0.to_string())
            || !run.code_id.as_ref().is_some_and(|id| codes.contains(id))
            || !runs.insert(&run.task_id)
        {
            return Err(TaskFailure::invalid(
                "Invalid packaged run identity or state",
            ));
        }
    }
    Ok(())
}

fn validate_files(package: &Package) -> Result<(), TaskFailure> {
    let files: std::collections::HashMap<_, _> = package
        .sources
        .iter()
        .map(|s| (&s.file.path, &s.file.content))
        .chain(package.auxiliary.iter().map(|f| (&f.path, &f.content)))
        .collect();
    for source in package
        .problem
        .checker
        .iter()
        .chain(package.problem.interactor.iter())
        .chain(
            package
                .problem
                .stress_test
                .iter()
                .flat_map(|s| [&s.generator, &s.brute_force]),
        )
    {
        if !files.contains_key(&source.0) {
            return Err(TaskFailure::invalid("Missing auxiliary program content"));
        }
    }
    let mut seen = std::collections::HashMap::new();
    for file in package
        .sources
        .iter()
        .map(|s| &s.file)
        .chain(package.auxiliary.iter())
    {
        if let Some(previous) = seen.insert(&file.path, &file.content)
            && previous != &file.content
        {
            return Err(TaskFailure::invalid(
                "Packaged files disagree about the same path",
            ));
        }
        if file.content.len() > 16 * 1024 * 1024 || file.path.file_name().is_none() {
            return Err(TaskFailure::invalid("Invalid packaged file"));
        }
    }
    Ok(())
}
