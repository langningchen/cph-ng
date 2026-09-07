use super::WorkspaceProblemRepository;
use crate::{
    domain::{Problem, TestcaseId},
    ports::RepoError,
};
use std::collections::{HashMap, HashSet};

impl WorkspaceProblemRepository {
    pub(super) async fn save_with_testcases(
        &self,
        problem: &Problem,
        payloads: &HashMap<TestcaseId, (String, String)>,
    ) -> Result<(), RepoError> {
        let testcase_ids: HashSet<_> = problem
            .testcases
            .iter()
            .map(|testcase| testcase.id)
            .collect();
        if testcase_ids.len() != problem.testcases.len()
            || payloads.keys().any(|id| !testcase_ids.contains(id))
        {
            return Err(RepoError::InvalidData(
                "testcase IDs must be unique and belong to the problem".into(),
            ));
        }
        self.index.upsert(&problem.src.0, problem.id).await?;
        let result = self.save_registered(problem, payloads).await;
        if result.is_err() {
            // A rejected first save must not reserve the source indefinitely. Keep
            // all bindings when an existing problem survived the rolled-back update.
            sqlx::query("DELETE FROM source_index WHERE problem_id = ? AND NOT EXISTS (SELECT 1 FROM problems WHERE id = ?)")
                .bind(problem.id.0.to_string()).bind(problem.id.0.to_string())
                .execute(self.index.pool()).await?;
        }
        result
    }
    async fn save_registered(
        &self,
        problem: &Problem,
        payloads: &HashMap<TestcaseId, (String, String)>,
    ) -> Result<(), RepoError> {
        let paths = self.paths_for_id(problem.id);
        self.init_dirs(&paths).await?;
        let mut stored = problem.clone();
        if let Ok(primary) = self.load_by_id(problem.id).await {
            stored.src = primary.src;
        }
        let data = serde_json::to_string(&stored)?;
        let mut tx = self.index.pool().begin().await?;
        sqlx::query("INSERT INTO problems(id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
            .bind(problem.id.0.to_string()).bind(&data).execute(&mut *tx).await?;
        let ids: Vec<String> =
            sqlx::query_scalar("SELECT id FROM testcase_data WHERE problem_id = ?")
                .bind(problem.id.0.to_string())
                .fetch_all(&mut *tx)
                .await?;
        for id in ids {
            if !problem
                .testcases
                .iter()
                .any(|testcase| testcase.id.0.to_string() == id)
            {
                sqlx::query("DELETE FROM testcase_data WHERE id = ? AND problem_id = ?")
                    .bind(id)
                    .bind(problem.id.0.to_string())
                    .execute(&mut *tx)
                    .await?;
            }
        }
        for (testcase_id, (input, answer)) in payloads {
            sqlx::query("INSERT INTO testcase_data(id, problem_id, stdin, answer) VALUES (?, ?, ?, ?) ON CONFLICT(problem_id, id) DO UPDATE SET stdin=excluded.stdin, answer=excluded.answer")
                .bind(testcase_id.0.to_string()).bind(problem.id.0.to_string()).bind(input).bind(answer).execute(&mut *tx).await?;
        }
        let bytes: i64 = sqlx::query_scalar("SELECT COALESCE(SUM(length(CAST(stdin AS BLOB)) + length(CAST(answer AS BLOB))), 0) FROM testcase_data WHERE problem_id = ?")
            .bind(problem.id.0.to_string()).fetch_one(&mut *tx).await?;
        if bytes > 16 * 1024 * 1024 {
            return Err(RepoError::InvalidData(
                "total testcase content exceeds 16 MiB".into(),
            ));
        }
        for (testcase_id, (input, answer)) in payloads {
            let (in_path, out_path) = paths.get_testcase_paths(testcase_id);
            self.write_owned(&in_path, input.as_bytes()).await?;
            self.write_owned(&out_path, answer.as_bytes()).await?;
        }
        tx.commit().await?;
        Ok(())
    }
}
