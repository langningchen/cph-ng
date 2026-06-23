mod adapters;
mod application;
mod domain;
mod ports;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    crate::adapters::cli::run().await
}
