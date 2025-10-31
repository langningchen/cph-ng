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

    // Use GitHub's GraphQL API to get closing issues references
    core.info(`Fetching linked issues for PR #${prNumber} via GraphQL API...`);

    const query = `
        query($owner: String!, $repo: String!, $prNumber: Int!) {
            repository(owner: $owner, name: $repo) {
                pullRequest(number: $prNumber) {
                    closingIssuesReferences(first: 100) {
                        nodes {
                            number
                            state
                            labels(first: 10) {
                                nodes {
                                    name
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    let linkedIssues = [];
    try {
        const result = await github.graphql(query, {
            owner,
            repo,
            prNumber,
        });

        linkedIssues =
            result?.repository?.pullRequest?.closingIssuesReferences?.nodes ||
            [];
        core.info(`Found ${linkedIssues.length} linked issue(s) via GraphQL.`);
    } catch (err) {
        core.warning(
            `Failed to fetch linked issues via GraphQL: ${err.message}`,
        );
        return;
    }

    if (linkedIssues.length === 0) {
        core.info('No linked issues found for this PR.');
        return;
    }

    const labelName = 'waiting-for-release';

    for (const issue of linkedIssues) {
        try {
            const number = issue.number;
            const issueState = issue.state;
            const issueLabels = issue.labels?.nodes || [];

            const hasLabel = issueLabels.some((l) => l.name === labelName);

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

                // Close the issue immediately after adding the label
                if (issueState && issueState.toLowerCase() === 'open') {
                    await github.rest.issues.update({
                        owner,
                        repo,
                        issue_number: number,
                        state: 'closed',
                    });
                    core.info(`Closed issue #${number}.`);
                }
            }
        } catch (err) {
            core.warning(
                `Failed to process issue #${issue.number}: ${err.message}`,
            );
        }
    }
}
