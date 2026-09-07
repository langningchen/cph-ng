use super::*;
use crate::interface::cli::output::terminal::{Tone, clean, paint, render_width};
use serde_json::json;

#[test]
fn unavailable_memory_is_distinct_from_zero_time_and_measured_memory() {
    let value = json!({"verdict":"accepted", "testcases":[
        {"verdict":"accepted", "time_ms":0, "memory_mb":null},
        {"verdict":"accepted", "time_ms":2, "memory_mb":0},
        {"verdict":"accepted", "time_ms":200, "memory_mb":32}
    ]});
    let output = render_width(&value, "Result", 80);
    assert!(!output.contains("0 MiB"));
    assert!(output.contains("0 ms"));
    assert!(output.contains("32 MiB"));
    assert!(output.contains("N/A"));
}

#[test]
fn display_width_and_truncation_preserve_graphemes_and_styles() {
    for (text, width) in [("中文", 4), ("e\u{301}", 1), ("👩‍💻", 2), ("🇨🇳", 2)] {
        assert_eq!(measure(text), width);
        assert_eq!(measure(&paint(text, Tone::Success)), width);
        let input = format!("{text}abcdef");
        assert_eq!(truncate(&input, width + 1), format!("{text}…"));
        assert_eq!(truncate(&input, 0), "");
    }
    assert_eq!(truncate("👩‍💻abc", 2), "…");
    assert_eq!(truncate("e\u{301}abc", 2), "e\u{301}…");
    let truncated = truncate(&paint("中文abcdef", Tone::Failure), 5);
    assert!(truncated.ends_with("…\x1b[0m"));
}

#[test]
fn wrapped_lines_fit_and_close_styles_before_newlines() {
    let input = paint(
        "中文 e\u{301} 👩‍💻 long-path-without-spaces\nnext line",
        Tone::Success,
    );
    for width in 1..=80 {
        let output = wrap(&input, width);
        assert!(
            output.lines().all(|line| measure(line) <= width),
            "{width}: {output:?}"
        );
        for line in output.lines() {
            assert!(line.ends_with("\x1b[0m"), "{line:?}");
        }
    }
    assert_eq!(wrap("word one two", 8), "word one\n two");
}

#[test]
fn terminal_content_cannot_inject_escapes_or_bidi_overrides() {
    let cleaned = clean("name\x1b[31m\r\u{202e}txt\u{2066}end");
    assert!(!cleaned.contains('\x1b'));
    assert!(!cleaned.contains('\r'));
    assert!(!cleaned.contains('\u{202e}'));
    assert!(!cleaned.contains('\u{2066}'));
}

#[test]
fn responsive_results_and_lists_fit_including_tiny_terminals() {
    let values = [
        json!([{"id":"12345678-1234-1234-1234-123456789abc", "name":"中文 e\u{301} 👩‍💻 long problem title", "source_path":"/some/very/long/path/to/source/main.cpp"}]),
        json!({"verdict":"wrong_answer", "testcases":[{"verdict":"wrong_answer", "time_ms":1234, "memory_mb":65535, "comparison":"中文 e\u{301} 👩‍💻 a long diagnostic with additional information"}]}),
    ];
    for width in [1, 12, 24, 40, 80, 140] {
        for value in &values {
            let rendered = render_width(value, "Problems", width);
            assert!(
                rendered.lines().all(|line| measure(line) <= width),
                "{width}: {rendered}"
            );
        }
    }
}

#[test]
fn nested_render_scopes_restore_the_previous_width() {
    scoped(Some(40), || {
        assert_eq!(width(), Some(40));
        scoped(None, || assert_eq!(width(), None));
        assert_eq!(width(), Some(40));
    });
    assert_eq!(width(), None);
}
