#[tokio::main]
async fn main() {
    let code = cph_ng_judge::interface::cli::run().await;
    // Tokio's blocking stdin reader cannot be interrupted by a signal. Owned
    // tasks and SQLite connections are drained before either entry point returns.
    std::process::exit(i32::from(code));
}
