use cph_ng_judge::application::tasks::{TaskEvent, TaskEventKind, TaskEventPayload, TaskProgress};
use serde_json::{Value, json};

#[test]
fn progress_payloads_are_closed_and_preserve_existing_wire_shapes() -> anyhow::Result<()> {
    let id = "00000000-0000-0000-0000-000000000001";
    for payload in [
        json!({"phase":"source_saved"}),
        json!({"phase":"preparing","testcases":[{"case_index":1,"testcase_id":id}]}),
        json!({"phase":"scheduled","jobs":1,"total":1}),
        json!({"phase":"compiling"}),
        json!({"phase":"compiled","compilation":{"hits":1,"builds":0}}),
        json!({"phase":"running","testcase_id":id,"case_index":1,"completed":0}),
        json!({"phase":"testcase_finished","case_index":1,"testcase":{
            "testcase_id":id,"verdict":"accepted","message":"","time_ms":1,"memory_mb":null,
            "stdout":"","stderr":"","exit_code":0,"comparison":null}}),
        json!({"phase":"stress_iteration","iteration":1,"seed":42,"verdict":"wrong_answer"}),
        json!({"rebuilt":2}),
    ] {
        let event = json!({"sequence":1,"task_id":id,"state":"running","kind":"progress",
            "result":payload,"error":null});
        let parsed: TaskEvent = serde_json::from_value(event.clone())?;
        assert!(matches!(parsed.payload, TaskEventPayload::Progress { .. }));
        assert_eq!(parsed.kind(), TaskEventKind::Progress);
        assert_eq!(serde_json::to_value(parsed)?, event);
    }
    for payload in [
        json!({"phase":"typo"}),
        json!({"phase":"compiling_typo","rebuilt":2}),
        json!({"phase":"running","case_index":1}),
        json!({"phase":"preparing","testcases":"anything"}),
        json!({"phase":"stress_iteration","iteration":1,"seed":42,"verdict":"anything"}),
        json!({"rebuilt":2,"anything":"else"}),
        Value::Null,
    ] {
        assert!(
            serde_json::from_value::<TaskProgress>(payload.clone()).is_err(),
            "{payload}"
        );
        assert!(
            serde_json::from_value::<TaskEvent>(json!({"sequence":1,"task_id":id,
            "state":"running","kind":"progress","result":payload,"error":null}))
            .is_err()
        );
    }
    assert!(serde_json::from_value::<TaskEventKind>(json!("arbitrary_state")).is_err());
    Ok(())
}
