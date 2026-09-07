//! Display-cell layout for sanitized text and our own SGR sequences.
use std::cell::Cell;
use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthStr;

thread_local! {
    // Rendering is synchronous; a scope keeps recursive detail views consistent.
    static WIDTH: Cell<Option<usize>> = const { Cell::new(None) };
}

pub(super) fn width() -> Option<usize> {
    WIDTH.get()
}

pub(in crate::interface::cli::output) fn scoped<T>(
    width: Option<usize>,
    render: impl FnOnce() -> T,
) -> T {
    struct Restore(Option<usize>);
    impl Drop for Restore {
        fn drop(&mut self) {
            WIDTH.set(self.0);
        }
    }
    let _restore = Restore(WIDTH.replace(width));
    render()
}

pub(crate) fn terminal_width() -> usize {
    std::env::var("COLUMNS")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .filter(|width| *width > 0)
        .or_else(|| {
            crossterm::terminal::size()
                .ok()
                .map(|size| size.0)
                .filter(|w| *w > 0)
        })
        .map_or(80, usize::from)
}

// Only presentation-owned SGR reaches this layer; external escapes are sanitized first.
fn tokens(value: &str) -> Vec<&str> {
    let mut result = Vec::new();
    let mut rest = value;
    while !rest.is_empty() {
        if rest.starts_with("\x1b[")
            && let Some(end) = rest.find('m')
        {
            let (style, tail) = rest.split_at(end + 1);
            result.push(style);
            rest = tail;
        } else {
            let end = rest
                .find('\x1b')
                .filter(|end| *end > 0)
                .unwrap_or(rest.len());
            let (text, tail) = rest.split_at(end);
            result.extend(text.graphemes(true));
            rest = tail;
        }
    }
    result
}

fn token_width(token: &str) -> usize {
    if token.starts_with('\x1b') {
        0
    } else {
        token.width()
    }
}

pub(super) fn measure(value: &str) -> usize {
    tokens(value).into_iter().map(token_width).sum()
}

pub(super) fn truncate(value: &str, limit: usize) -> String {
    if measure(value) <= limit {
        return value.into();
    }
    if limit == 0 {
        return String::new();
    }
    let mut result = String::new();
    let mut used = 0;
    let mut styled = false;
    for token in tokens(value) {
        if used + token_width(token) > limit - 1 {
            break;
        }
        used += token_width(token);
        if token.starts_with('\x1b') {
            styled = token != "\x1b[0m";
        }
        result.push_str(token);
    }
    result.push('…');
    if styled {
        result.push_str("\x1b[0m");
    }
    result
}

/// Wrap without losing text, splitting graphemes, or carrying styles across lines.
pub(in crate::interface::cli::output) fn wrap(value: &str, limit: usize) -> String {
    let limit = limit.max(1);
    let mut result = String::new();
    let mut used = 0;
    let mut style = String::new();
    let expanded = value.replace('\t', "    ");
    let tokens = tokens(&expanded);
    let mut word_start = true;
    for (index, token) in tokens.iter().copied().enumerate() {
        if token.starts_with('\x1b') {
            if token == "\x1b[0m" {
                style.clear();
            } else {
                style.push_str(token);
            }
            result.push_str(token);
            continue;
        }
        let cells = token_width(token);
        let word_width = if word_start && token != " " && token != "\n" {
            tokens
                .iter()
                .skip(index)
                .take_while(|token| !matches!(**token, " " | "\n"))
                .map(|token| token_width(token))
                .sum()
        } else {
            0
        };
        word_start = matches!(token, " " | "\n");
        if token == "\n"
            || used + cells > limit
            || (word_width <= limit && used > 0 && used + word_width > limit)
        {
            if !style.is_empty() {
                result.push_str("\x1b[0m");
            }
            result.push('\n');
            if !style.is_empty() {
                result.push_str(&style);
            }
            used = 0;
            if token == "\n" {
                continue;
            }
        }
        // A two-cell glyph cannot fit a one-column terminal.
        if cells > limit {
            result.push('�');
            used += 1;
        } else {
            result.push_str(token);
            used += cells;
        }
    }
    result
}

pub(super) fn indent(value: &str, padding: usize) -> String {
    let padding = width().map_or(padding, |width| padding.min(width.saturating_sub(1)));
    let prefix = " ".repeat(padding);
    let content = width().map_or_else(
        || value.to_owned(),
        |width| wrap(value, width.saturating_sub(padding)),
    );
    content
        .lines()
        .map(|line| format!("{prefix}{line}"))
        .collect::<Vec<_>>()
        .join("\n")
}

pub(super) fn field(label: &str, value: &str) -> String {
    let painted = super::paint(label, super::Tone::Muted);
    let label_width = measure(label).max(16);
    if let Some(width) = width().filter(|width| *width < 60) {
        if measure(label) + measure(value) + 4 <= width {
            format!("  {painted}  {value}")
        } else {
            format!("  {painted}\n{}", indent(value, 4))
        }
    } else {
        format!(
            "  {painted}{}  {value}",
            " ".repeat(label_width - measure(label))
        )
    }
}

#[cfg(test)]
mod tests;
