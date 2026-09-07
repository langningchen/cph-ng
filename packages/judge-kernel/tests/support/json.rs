use anyhow::Context;
use serde_json::Value;

pub(crate) trait JsonExt {
    fn required(&self, pointer: &str) -> anyhow::Result<&Value>;
    fn text(&self, pointer: &str) -> anyhow::Result<&str>;
}

impl JsonExt for Value {
    fn text(&self, pointer: &str) -> anyhow::Result<&str> {
        self.required(pointer)?
            .as_str()
            .with_context(|| format!("response field {pointer} must be a string"))
    }

    fn required(&self, pointer: &str) -> anyhow::Result<&Self> {
        self.pointer(pointer)
            .with_context(|| format!("response is missing {pointer}"))
    }
}
