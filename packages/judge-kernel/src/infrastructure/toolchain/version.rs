//! Extract the upstream version, excluding vendor/package annotations in parentheses.
pub(super) fn parse(description: &str) -> String {
    let mut depth = 0_usize;
    let unannotated: String = description
        .chars()
        .map(|ch| match ch {
            '(' => {
                depth += 1;
                ' '
            }
            ')' => {
                depth = depth.saturating_sub(1);
                ' '
            }
            _ if depth > 0 => ' ',
            _ => ch,
        })
        .collect();
    unannotated
        .split_whitespace()
        .map(|part| part.trim_matches(['"', '\'']).trim_start_matches('v'))
        .find(|part| part.starts_with(|ch: char| ch.is_ascii_digit()))
        .unwrap_or_default()
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::parse;

    #[test]
    fn versions_exclude_vendor_annotations_but_keep_release_suffixes() {
        for (description, expected) in [
            ("gcc (Ubuntu 15.2.0-16ubuntu1) 15.2.0", "15.2.0"),
            ("g++ (GCC) 14.2.1 20240910", "14.2.1"),
            (
                "arm-none-eabi-gcc (Arm GNU Toolchain (12.2.Rel1)) 12.2.1",
                "12.2.1",
            ),
            ("Apple clang version 17.0.0 (clang-1700.0.13.3)", "17.0.0"),
            ("Ubuntu clang version 18.0.0-1ubuntu1", "18.0.0-1ubuntu1"),
            ("rustc 1.99.0-nightly (abcdef 2026-08-30)", "1.99.0-nightly"),
            ("Python 3.15.0rc1", "3.15.0rc1"),
            ("v24.18.0", "24.18.0"),
            ("openjdk version \"1.8.0_462\"", "1.8.0_462"),
            ("javac 25-ea", "25-ea"),
            ("compiler (vendor 123)", ""),
        ] {
            assert_eq!(parse(description), expected, "{description}");
        }
    }
}
