/** @typedef {import('@actions/github').context} ActionsContext */
/** @typedef {import('@octokit/rest').Octokit} Octokit */
/** @typedef {typeof import('@actions/core')} Core */
/** @typedef {Octokit & { graphql: (query: string, variables: Record<string, unknown>) => Promise<unknown> }} GitHubWithGraphQL */

/**
 * @param {{ github: GitHubWithGraphQL; context: ActionsContext; core: Core }} deps
 */
export default async function run({ github, context, core }) {
    try {
        const version = process.env.VERSION;
        if (!version) {
            core.setFailed('VERSION env is required.');
            return;
        }
        const owner = context.repo.owner;
        const repo = context.repo.repo;
        const labelName = 'waiting-for-release';
        const releasedLabelName = 'released';

        core.info(
            `Fetching closed issues labeled '${labelName}' to update for release v${version}...`,
        );

        /** @type {Array<import('@octokit/rest').RestEndpointMethodTypes['issues']['listForRepo']['response']['data'][number]>} */
        const issues = await github.paginate(github.rest.issues.listForRepo, {
            owner,
            repo,
            state: 'closed',
            labels: labelName,
            per_page: 100,
        });

        if (!issues.length) {
            core.info('No closed issues with the label found.');
            return;
        }

        const releaseUrl = `https://github.com/${owner}/${repo}/releases/tag/v${version}`;
        for (const issue of issues) {
            try {
                if (issue.pull_request) {
                    core.info(`#${issue.number} is a pull request; skipping.`);
                    continue;
                }

                const body = [
                    `🎉 Version v${version} has been released: ${releaseUrl}`,
                    'If the problem persists, please reopen this issue or file a new one.',
                ].join('\n');

                await github.rest.issues.createComment({
                    owner,
                    repo,
                    issue_number: issue.number,
                    body,
                });

                // Remove waiting-for-release label
                try {
                    await github.rest.issues.removeLabel({
                        owner,
                        repo,
                        issue_number: issue.number,
                        name: labelName,
                    });
                    core.info(
                        `Removed label '${labelName}' from #${issue.number}.`,
                    );
                } catch (removeErr) {
                    if (removeErr.status === 404) {
                        core.info(
                            `Label '${labelName}' not present on #${issue.number}, skipping removal.`,
                        );
                    } else {
                        core.warning(
                            `Failed to remove label '${labelName}' from #${issue.number}: ${removeErr.message}`,
                        );
                    }
                }

                // Add released label
                await github.rest.issues.addLabels({
                    owner,
                    repo,
                    issue_number: issue.number,
                    labels: [releasedLabelName],
                });
                core.info(
                    `Added label '${releasedLabelName}' to #${issue.number}.`,
                );
                core.info(
                    `Updated labels for issue #${issue.number} (issue is already closed).`,
                );
            } catch (err) {
                core.warning(
                    `Failed to process #${issue.number}: ${err.message}`,
                );
            }
        }
    } catch (outerErr) {
        core.setFailed(`update-release-labels failed: ${outerErr.message}`);
    }
}
