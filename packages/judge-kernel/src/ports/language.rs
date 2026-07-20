pub trait Compiler: Send + Sync {
    fn name(&self) -> &str;

    fn auto_detect(&self) -> Vec<ExecutablePath>;

    fn compile(&self, ctx: &CompileContext) -> anyhow::Result<ExecutablePath>;
}

pub trait Runner: Send + Sync {
    fn name(&self) -> &str;

    fn auto_detect(&self) -> Vec<ExecutablePath>;

    fn run(&self, ctx: &RunContext) -> anyhow::Result<std::process::Child>;
}
