use super::{CheckerMode, compare};

/// Describe the first mismatch using the same token/float policy as the checker.
#[must_use]
pub fn summary(actual: &str, expected: &str, mode: &CheckerMode, tolerance: f64) -> String {
    if matches!(mode, CheckerMode::Tokens | CheckerMode::Float) {
        let mut actual = actual.split_whitespace();
        let mut expected = expected.split_whitespace();
        for index in 1.. {
            let (a, b) = (actual.next(), expected.next());
            match (a, b) {
                (None, None) => return "Output matches the answer under the checker rules".into(),
                (Some(a), Some(b)) if compare(a, b, mode, tolerance) => {}
                _ => {
                    return format!(
                        "Token {index}: output {}, answer {}",
                        excerpt(a),
                        excerpt(b)
                    );
                }
            }
        }
    }
    character_summary(actual, expected)
}

fn character_summary(actual: &str, expected: &str) -> String {
    let mut a = actual.char_indices();
    let mut b = expected.char_indices();
    let (mut line, mut column) = (1, 1);
    loop {
        let (left, right) = (a.next(), b.next());
        match (left, right) {
            (None, None) => return "Output and answer are identical".into(),
            (Some((_, a)), Some((_, b))) if a == b => {
                if a == '\n' {
                    line += 1;
                    column = 1;
                } else {
                    column += 1;
                }
            }
            _ => {
                return format!(
                    "Line {line}, col {column}: output {}, answer {}",
                    excerpt(left.and_then(|(index, _)| actual.get(index..))),
                    excerpt(right.and_then(|(index, _)| expected.get(index..)))
                );
            }
        }
    }
}

fn excerpt(value: Option<&str>) -> String {
    value.map_or_else(
        || "<EOF>".into(),
        |value| {
            let mut chars = value.chars();
            let excerpt: String = chars.by_ref().take(16).collect();
            let suffix = if chars.next().is_some() { "..." } else { "" };
            format!("{excerpt:?}{suffix}")
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mismatch_respects_float_tolerance_and_token_whitespace() {
        assert_eq!(
            summary("1.0001 bad", "1 good", &CheckerMode::Float, 0.001),
            "Token 2: output \"bad\", answer \"good\""
        );
        assert_eq!(
            summary("one\n two", "one two three", &CheckerMode::Tokens, 0.0),
            "Token 3: output <EOF>, answer \"three\""
        );
    }

    #[test]
    fn exact_diff_reports_unicode_positions_whitespace_and_endings() {
        assert!(summary("中\nx", "中\ny", &CheckerMode::Exact, 0.0).starts_with("Line 2, col 1:"));
        assert_eq!(
            summary("a ", "a\n", &CheckerMode::Legacy, 0.0),
            "Line 1, col 2: output \" \", answer \"\\n\""
        );
        assert!(summary("", "x", &CheckerMode::Exact, 0.0).contains("output <EOF>"));
    }
}
