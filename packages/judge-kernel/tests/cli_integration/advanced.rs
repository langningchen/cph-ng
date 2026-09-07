use super::{JsonExt, Workspace};

#[tokio::test]
async fn special_interactive_and_stress_commands_reuse_the_judge() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("sum.py", "print(sum(map(int,input().split())))\n")?;
    ws.file(
        "checker.py",
        "import sys\na=open(sys.argv[2]).read().strip()\nsys.exit(0 if a=='3' else 1)\n",
    )?;
    ws.ok(&[
        "run",
        "sum.py",
        "--stdin",
        "1 2",
        "--answer",
        "999",
        "--checker",
        "checker.py",
    ])
    .await?;
    ws.file("interactor.py", "import sys\nprint('1 2',flush=True)\nsys.exit(0 if sys.stdin.readline().strip()=='3' else 1)\n")?;
    ws.ok(&[
        "judge",
        "run",
        "sum.py",
        "--stdin",
        "",
        "--interactor",
        "interactor.py",
    ])
    .await?;
    ws.file("gen.py", "import sys\nprint(sys.argv[1], 2)\n")?;
    ws.file("brute.py", "a,b=map(int,input().split());print(a-b)\n")?;
    let stress = ws
        .json(
            &[
                "stress",
                "start",
                "sum.py",
                "--generator",
                "gen.py",
                "--brute-force",
                "brute.py",
                "--iterations",
                "3",
                "--seed",
                "25",
                "--time-limit-ms",
                "5000",
            ],
            1,
        )
        .await?;
    assert_eq!(stress.required("/result/found_difference")?, true);
    assert_eq!(stress.required("/result/seed")?, 25);
    let problem = ws.ok(&["problem", "load", "sum.py"]).await?;
    assert_eq!(problem.required("/time_limit_ms")?, 1000);
    assert!(problem.required("/generator")?.is_null());
    assert!(problem.required("/checker")?.is_null());
    assert!(problem.required("/interactor")?.is_null());
    assert_eq!(problem.required("/testcases/0/stdin")?, "25 2\n");
    assert_eq!(problem.required("/testcases/0/answer")?, "23\n");
    ws.file("brute.py", "a,b=map(int,input().split());print(a+b)\n")?;
    ws.ok(&[
        "problem",
        "update",
        "sum.py",
        "--generator",
        "gen.py",
        "--brute-force",
        "brute.py",
    ])
    .await?;
    assert_eq!(
        (ws.ok(&["stress", "start", "sum.py", "--iterations", "2"])
            .await?)
            .required("/result/found_difference")?,
        false
    );
    let cleared = ws
        .ok(&["problem", "update", "sum.py", "--clear-stress"])
        .await?;
    assert!(cleared.required("/generator")?.is_null());

    Ok(())
}
