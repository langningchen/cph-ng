use cph_ng_judge::infrastructure::repo::database;

#[tokio::test]
async fn opening_an_existing_store_waits_for_a_concurrent_writer() -> anyhow::Result<()> {
    let root = tempfile::tempdir()?;
    let writer = database::open(root.path()).await?;
    for iteration in 0..8 {
        let mut tx = writer.begin_with("BEGIN IMMEDIATE").await?;
        sqlx::query("INSERT OR REPLACE INTO problems(id, data) VALUES ('writer', ?)")
            .bind(iteration.to_string())
            .execute(&mut *tx)
            .await?;
        let path = root.path().to_owned();
        let reader = tokio::spawn(async move { database::open(&path).await });
        tokio::time::sleep(std::time::Duration::from_millis(30)).await;
        tx.commit().await?;
        let observer = reader.await??;
        let value: String = sqlx::query_scalar("SELECT data FROM problems WHERE id='writer'")
            .fetch_one(&observer)
            .await?;
        assert_eq!(value, iteration.to_string());
        observer.close().await;
    }
    writer.close().await;
    Ok(())
}
