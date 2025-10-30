/** @typedef {import('@actions/github').context} ActionsContext */
/** @typedef {import('@octokit/rest').Octokit} Octokit */
/** @typedef {import('@octokit/rest').RestEndpointMethodTypes['pulls']['get']['response']['data']} PullRequest */
/** @typedef {typeof import('@actions/core')} Core */
/** @typedef {Octokit & { graphql: (query: string, variables: Record<string, unknown>) => Promise<unknown> }} GitHubWithGraphQL */

/**
 * @param {{ github: GitHubWithGraphQL; context: ActionsContext; core: Core }} deps
 * @returns {Promise<void>}
 */
export default async function run({ github, context, core }) {
    if (context.eventName !== 'pull_request') {
        core.info('Not a pull_request event; skipping.');
        return;
    }

    const action = context.payload.action;
    if (action !== 'closed') {
        core.info(`PR action is '${action}', not 'closed'; skipping.`);
        return;
    }

    const pr = context.payload.pull_request;
    if (!pr || !pr.merged) {
        core.info('PR not merged; skipping.');
        return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = pr.number;
    const prBody = pr.body || '';
    const prTitle = pr.title || '';

    const issueSet = new Set();

    function collectIssuesFromText(text) {
        if (!text) {
            return;
        }
        // Match #123, fixes #123, closes #123, resolves #123, etc.
        const patterns = [
            /#(\d+)/g,
            /\b(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s+#(\d+)/gi,
        ];
        for (const pattern of patterns) {
            for (const m of text.matchAll(pattern)) {
                const num = Number(m[1]);
                if (num) {
                    issueSet.add(num);
                }
            }
        }
    }

    collectIssuesFromText(prTitle);
    collectIssuesFromText(prBody);

    if (issueSet.size === 0) {
        core.info('No linked issues found in PR title or body.');
        return;
    }

    const issues = Array.from(issueSet);
    const labelName = 'waiting-for-release';

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
                core.info(
                    `Added label '${labelName}' to issue #${number} (referenced by PR #${prNumber}).`,
                );
            }
        } catch (err) {
            core.warning(
                `Failed to process issue #${number}: ${err.message}`,
            );
        }
    }
}
