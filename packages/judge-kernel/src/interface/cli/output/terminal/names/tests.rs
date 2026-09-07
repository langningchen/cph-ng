use super::super::{records, render_width};
use crate::application::{commands::capabilities, method::Method};
use serde_json::json;

#[test]
fn capability_labels_hide_protocol_names_without_changing_the_payload() {
    let value = capabilities();
    let before = value.clone();
    let output = render_width(&value, "Available features", 140);
    for label in [
        "C++",
        "Python",
        "JavaScript",
        "Standard I/O",
        "Special judge",
        "Companion JSON",
        "Judge solution",
    ] {
        assert!(output.contains(label), "{label}: {output}");
    }
    for method in Method::ALL {
        assert!(!output.contains(method.as_str()), "{output}");
    }
    assert!(!output.contains("resource_limits"));
    assert!(!output.contains("javascript"));
    assert_eq!(value, before);
}

#[test]
fn toolchains_and_history_use_names_while_preserving_executable_names_and_ids() {
    let toolchains = json!([
        {"language":"cpp", "kind":"compiler", "name":"g++", "path":"/bin/g++", "version":"15.2.0"},
        {"language":"javascript", "kind":"compiler", "name":"node", "path":"/bin/node", "version":"24.18.0"}
    ]);
    for width in [40, 80, 140] {
        let output = render_width(&toolchains, "Toolchains", width);
        for label in [
            "C++",
            "JavaScript",
            "Compiler",
            "Syntax check",
            "/bin/g++",
            "/bin/node",
        ] {
            assert!(output.contains(label), "{width}: {output}");
        }
    }
    let history = json!([{"task_id":"stable-task-id", "kind":"judge.run", "state":"succeeded"}]);
    let output = render_width(&history, "History", 140);
    assert!(output.contains("Judge solution"));
    assert!(output.contains("Completed"));
    assert!(output.contains("stable-task-id"));
    assert!(!output.contains("judge.run"));
    let events = json!([{"task_id":"stable-task-id", "kind":"progress", "state":"running", "sequence":1,
        "result":{"phase":"source_saved"}}]);
    let output = render_width(&events, "Events", 140);
    assert!(output.contains("Progress") && output.contains("Source saved"));
    assert!(!output.contains("source_saved"));
}

#[test]
fn generic_details_are_contextual_and_preserve_user_data() {
    let value = json!({"language":"cpp", "reason":"output_limit", "scope":"global",
        "checker_mode":"spj", "name":"cpp", "source_path":"/tmp/source_saved.cpp",
        "message":"source_saved", "languages":{"python":{"interpreter":"python3"}}});
    let output = records::fields(&value, 1);
    for label in [
        "C++",
        "Output limit",
        "Global",
        "Special judge",
        "Python",
        "python3",
        "/tmp/source_saved.cpp",
        "source_saved",
        "cpp",
    ] {
        assert!(output.contains(label), "{label}: {output}");
    }
    assert!(!output.contains("checker_mode"));
    let export = render_width(
        &json!({"format":"companion", "destination":"cpp.json", "written":true, "bytes":12}),
        "Export",
        80,
    );
    assert!(export.contains("Exported Companion JSON"));
    assert!(export.contains("cpp.json"));
}
