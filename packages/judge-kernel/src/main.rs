mod adapters;
mod application;
mod domain;
mod ports;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let result = crate::adapters::cli::run().await;
    if let Err(e) = result {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
    Ok(())
}
