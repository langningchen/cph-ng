use cph_ng_judge::domain::JudgeVerdict;
#[test]
fn checker_modes_reject_wrong_tokens_and_non_finite_numbers() {
    use cph_ng_judge::domain::checker::{CheckerMode, compare};
    assert!(compare(" 1\t2\n", "1 2", &CheckerMode::Tokens, 0.0));
    assert!(!compare("1\n", "1", &CheckerMode::Exact, 0.0));
    assert!(compare("1000000.1", "1000000", &CheckerMode::Float, 1e-6));
    assert!(!compare("1.1", "1", &CheckerMode::Float, 1e-6));
    assert!(!compare("NaN", "1", &CheckerMode::Float, 1e-6));
    assert!(!compare("1 2", "1", &CheckerMode::Float, 1e-6));
}

#[test]
fn legacy_comparison_preserves_extension_settings() {
    use cph_ng_judge::domain::checker::{LegacyComparison, legacy_verdict};
    let defaults = LegacyComparison::default();
    for (actual, expected, stderr, verdict) in [
        ("hello", "hello", "", JudgeVerdict::Accepted),
        ("hello  \n", "hello\n", "", JudgeVerdict::Accepted),
        ("hello", "world", "", JudgeVerdict::WrongAnswer),
        (
            "hello world",
            "helloworld",
            "",
            JudgeVerdict::PresentationError,
        ),
        ("hello", "hello", "diagnostic", JudgeVerdict::Accepted),
        (
            "line1  \nline2  ",
            "line1\nline2",
            "",
            JudgeVerdict::Accepted,
        ),
        ("", "", "", JudgeVerdict::Accepted),
    ] {
        assert_eq!(legacy_verdict(actual, expected, stderr, &defaults), verdict);
    }
    let strict = LegacyComparison {
        ignore_stderr: false,
        ..defaults.clone()
    };
    assert_eq!(
        legacy_verdict("hello", "hello", "diagnostic", &strict),
        JudgeVerdict::RuntimeError
    );
    assert_eq!(
        legacy_verdict("hello", "hello", " \n ", &strict),
        JudgeVerdict::Accepted
    );
    assert_eq!(
        legacy_verdict(
            "hello world",
            "helloworld",
            "",
            &LegacyComparison {
                regard_pe_as_ac: true,
                ..defaults.clone()
            }
        ),
        JudgeVerdict::Accepted
    );
    assert_eq!(
        legacy_verdict(
            &"a".repeat(100),
            "ab",
            "",
            &LegacyComparison {
                output_ratio_limit: Some(8.0),
                ..defaults
            }
        ),
        JudgeVerdict::OutputLimitExceeded
    );
}

#[tokio::test]
async fn portable_memory_accounting_reads_the_current_process() {
    let (memory_kb, processes) =
        cph_ng_judge::infrastructure::executor::process_tree_usage(std::process::id()).await;
    assert!(memory_kb > 0);
    assert!(processes >= 1);
}
