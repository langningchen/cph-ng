/** @typedef {import('@actions/github').context} ActionsContext */
/** @typedef {import('@octokit/rest').Octokit} Octokit */
/** @typedef {import('@octokit/webhooks-types').PushEvent} PushEvent */
/** @typedef {import('@octokit/rest').RestEndpointMethodTypes['issues']['listComments']['response']['data'][number]} IssueComment */
/** @typedef {typeof import('@actions/core')} Core */
/** @typedef {Octokit & { graphql: (query: string, variables: Record<string, unknown>) => Promise<unknown> }} GitHubWithGraphQL */

/**
 * @param {{ github: GitHubWithGraphQL; context: ActionsContext; core: Core }} deps
 * @returns {Promise<void>}
 */
export default async function run({ github, context, core }) {
    if (context.eventName !== 'push') {
        core.info('Not a push event; skipping comments.');
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    /** @type {PushEvent['commits']} */
    const commits = context.payload.commits || [];

    const issueSet = new Set();

    function collectIssuesFromMessage(msg) {
        if (!msg) {
            return;
        }
        for (const m of msg.matchAll(/#(\d+)/g)) {
            issueSet.add(Number(m[1]));
        }
    }

    for (const c of commits) {
        collectIssuesFromMessage(c.message || '');
    }

    if (issueSet.size === 0) {
        core.info('No linked issues found in commit messages.');
        return;
    }

    const issues = Array.from(issueSet);
    const shaLinks = commits
        .map((c) => `- ${c.id.substring(0, 7)}: ${c.message.split('\n')[0]}`)
        .join('\n');
    const runId = process.env.GITHUB_RUN_ID;
    const runUrl = `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
    const markerPrefix = '<!-- cph-ng-ci-notify:';
    const currentMarker = `cph-ng-ci-notify:${runId}`;

    for (const number of issues) {
        try {
            const { data: issue } = await github.rest.issues.get({
                owner,
                repo,
                issue_number: number,
            });
            if (issue.pull_request) {
                core.info(`#${number} is a pull request; skipping.`);
                continue;
            }

            const mention = issue.user?.login ? `@${issue.user.login}` : '';
            const body =
                `<!-- ${currentMarker} -->\n` +
                `${mention} 👋 The CI build has passed.\n\n` +
                `Related commits:\n${shaLinks}\n\n` +
                `Workflow run details: ${runUrl}\n\n` +
                `Please download the \`vsix\` artifact from the workflow run and install it in your VSCode instance to test the changes.\n\n` +
                `If the problem persists, please reply in this issue.`;

            const { data: comments } = await github.rest.issues.listComments({
                owner,
                repo,
                issue_number: number,
                per_page: 100,
            });

            const previousNotifies = comments.filter(
                (c) =>
                    c.body &&
                    c.body.includes(markerPrefix) &&
                    !c.body.includes(currentMarker),
            );
            for (const pc of previousNotifies) {
                try {
                    await github.graphql(
                        `mutation($subjectId: ID!) {\n` +
                            `  minimizeComment(input: {subjectId: $subjectId, classifier: OUTDATED}) {\n` +
                            `    minimizedComment { isMinimized minimizedReason }\n` +
                            `  }\n` +
                            `}`,
                        { subjectId: pc.node_id },
                    );
                    core.info(
                        `Minimized previous notification comment on #${number} as OUTDATED (comment id: ${pc.id}).`,
                    );
                } catch (minErr) {
                    core.warning(
                        `Failed to minimize previous comment ${pc.id} on #${number}: ${minErr.message}`,
                    );
                }
            }

            const labelName = 'waiting-for-release';
            const hasLabel =
                Array.isArray(issue.labels) &&
                issue.labels.some((l) =>
                    typeof l === 'string'
                        ? l === labelName
                        : l?.name === labelName,
                );
            if (hasLabel) {
                core.info(`Issue #${number} already has label '${labelName}'.`);
            } else {
                await github.rest.issues.addLabels({
                    owner,
                    repo,
                    issue_number: number,
                    labels: [labelName],
                });
                core.info(`Added label '${labelName}' to issue #${number}.`);

                // Close the issue immediately after adding the label
                if (issue.state === 'open') {
                    await github.rest.issues.update({
                        owner,
                        repo,
                        issue_number: number,
                        state: 'closed',
                    });
                    core.info(`Closed issue #${number}.`);
                }
            }

            const exists = comments.some(
                (c) => c.body && c.body.includes(`<!-- ${currentMarker} -->`),
            );
            if (exists) {
                core.info(
                    `Comment for issue #${number} already exists for this run.`,
                );
                continue;
            }

            await github.rest.issues.createComment({
                owner,
                repo,
                issue_number: number,
                body,
            });
            core.info(`Commented on issue #${number}.`);
        } catch (err) {
            core.warning(
                `Failed to comment on issue #${number}: ${err.message}`,
            );
        }
    }
}
