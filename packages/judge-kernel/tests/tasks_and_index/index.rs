use anyhow::Context;

use cph_ng_judge::{
    domain::ProblemId,
    infrastructure::repo::index::{IndexError, ProblemIndex},
};
use tempfile::TempDir;
use uuid::Uuid;

#[tokio::test]
async fn index_tracks_renames_and_hash_fallback_and_rejects_ambiguity() -> anyhow::Result<()> {
    let root = TempDir::new().context("required test fixture or kernel response")?;
    let index = ProblemIndex::open(root.path())
        .await
        .context("required test fixture or kernel response")?;
    let original = root.path().join("a.cpp");
    let moved = root.path().join("moved.cpp");
    tokio::fs::write(&original, "original")
        .await
        .context("required test fixture or kernel response")?;
    let id = ProblemId(Uuid::new_v4());
    index
        .upsert(&original, id)
        .await
        .context("required test fixture or kernel response")?;
    tokio::fs::rename(&original, &moved)
        .await
        .context("required test fixture or kernel response")?;
    tokio::fs::write(&moved, "changed")
        .await
        .context("required test fixture or kernel response")?;
    assert_eq!(
        index
            .resolve(&moved)
            .await
            .context("required test fixture or kernel response")?,
        id
    );
    #[cfg(unix)]
    {
        let marker = if cfg!(target_os = "macos") {
            "org.cph-ng.problem-id"
        } else {
            "user.cph-ng.problem-id"
        };
        let _ = rustix::fs::removexattr(&moved, marker);
        assert_eq!(
            index
                .resolve(&moved)
                .await
                .context("required test fixture or kernel response")?,
            id
        );
    }
    index
        .upsert(&moved, id)
        .await
        .context("required test fixture or kernel response")?;
    let copied = root.path().join("copy.cpp");
    tokio::fs::copy(&moved, &copied)
        .await
        .context("required test fixture or kernel response")?;
    assert!(matches!(
        index.resolve(&copied).await,
        Err(IndexError::Conflict(_))
    ));
    let second = ProblemId(Uuid::new_v4());
    index
        .upsert(&copied, second)
        .await
        .context("required test fixture or kernel response")?;
    let third = root.path().join("third.cpp");
    tokio::fs::write(&third, "changed")
        .await
        .context("required test fixture or kernel response")?;
    assert!(matches!(index.resolve(&third).await, Err(IndexError::Conflict(ids)) if ids.len()==2));
    tokio::fs::write(&third, "not indexed")
        .await
        .context("required test fixture or kernel response")?;
    assert!(matches!(
        index.resolve(&third).await,
        Err(IndexError::NotFound(_))
    ));
    let stored: String =
        sqlx::query_scalar("SELECT current_path FROM source_index WHERE problem_id=?")
            .bind(id.0.to_string())
            .fetch_one(index.pool())
            .await
            .context("required test fixture or kernel response")?;
    assert!(!stored.is_empty());

    Ok(())
}

#[tokio::test]
async fn existing_index_schema_is_migrated_without_losing_mappings() -> anyhow::Result<()> {
    let root = TempDir::new().context("required test fixture or kernel response")?;
    let pool = sqlx::SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::new()
            .filename(root.path().join("index.sqlite3"))
            .create_if_missing(true),
    )
    .await
    .context("required test fixture or kernel response")?;
    sqlx::query("CREATE TABLE problem_index(problem_id TEXT PRIMARY KEY, marker TEXT, device INTEGER, inode INTEGER, content_hash TEXT NOT NULL)").execute(&pool).await.context("required test fixture or kernel response")?;
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO problem_index(problem_id, content_hash) VALUES (?, 'old')")
        .bind(&id)
        .execute(&pool)
        .await
        .context("required test fixture or kernel response")?;
    pool.close().await;
    let index = ProblemIndex::open(root.path())
        .await
        .context("required test fixture or kernel response")?;
    let found: String = sqlx::query_scalar("SELECT problem_id FROM problem_index")
        .fetch_one(index.pool())
        .await
        .context("required test fixture or kernel response")?;
    assert_eq!(found, id);

    Ok(())
}
