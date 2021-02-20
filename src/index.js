import { getInput, setFailed } from '@actions/core';
import { context } from '@actions/github';
import octokit from './octokit';

import buildContributorsList from './core';
import getSponsorListQuery from './query/getSponsorsList.gql';

async function run() {
    try {
        if (context.payload.action) {
            if (context.payload.action !== 'closed') return;
        }

        // get various inputs applied in action.yml
        const path = getInput('readme_path').trim();
        const affiliation = getInput('collaborators').trim();
        const message = getInput('commit_message').trim();
        const name = getInput('committer_username').trim();
        const email = getInput('committer_email').trim();

        // get repo token
        const token = process.env['GITHUB_TOKEN'];

        if (!token) {
            throw new Error('Token not found');
        }

        const nwo = process.env['GITHUB_REPOSITORY'] || '/';
        const [owner, repo] = nwo.split('/');

        // get the readme of the repo
        const readme = await octokit.repos.getContent({ owner, repo, path });

        if (readme.headers.status === '404') {
            console.log('readme not added');
            return;
        }

        // get all contributors of the repo max:500
        const contributorsList = await octokit.repos.listContributors({ owner, repo });
        const collaboratorsList = await octokit.repos.listCollaborators({
            owner,
            repo,
            affiliation
        });
        const sponsorsList = await octokit.graphql(getSponsorListQuery, { owner });

        // get data of contributors
        // collaborators
        // bots
        const contributors = contributorsList.data.filter(
            el => el.type !== 'Bot' && !el.login.includes('actions-user')
        );
        const contributorsBots = contributorsList.data
            .filter(el => el.type === 'Bot' || el.login.includes('actions-user'))
            .map(({ login, avatar_url }) => ({
                login: login,
                avatar_url,
                name: login,
                type: 'bot'
            }));
        const collaborators = collaboratorsList.data.filter(
            el => el.type !== 'Bot' && !el.login.includes('actions-user')
        );
        const collaboratorsBots = contributorsList.data
            .filter(el => el.type === 'Bot' || el.login.includes('actions-user'))
            .map(({ login, avatar_url }) => ({
                login: login,
                avatar_url,
                name: login,
                type: 'bot'
            }));
        const sponsors = sponsorsList.user.sponsorshipsAsMaintainer.nodes.map(
            ({ sponsorEntity: { name, login, avatarUrl } }) => ({
                name,
                login,
                avatar_url: avatarUrl
            })
        );
        const bots = [...contributorsBots, ...collaboratorsBots];
        // parse the base64 readme
        let content = Buffer.from(readme.data.content, 'base64').toString('utf8');
        const prevContent = content;

        /**
         * regex expresstion to get all the special readme tags
         * eg: <!-- readme:contributors -start --!> anything inside this<!-- readme:contributors -end --!>
         * gets these matched and the content inside of these tags to an array
         */
        // get all tag comments with the given format
        const getAllReadmeComments = content.match(
            /<!--\s*readme:\s*[a-zA-Z0-9,-]*\s*-start\s*-->[\s\S]*?<!--\s*readme:\s*[a-zA-Z0-9,-]*\s*-end\s*-->/gm
        );

        // return action if no tags were found
        if (!getAllReadmeComments) {
            console.log('No contrib comments were attached');
            return;
        }

        // based on tags update the content
        for (let match = 0; match < getAllReadmeComments.length; match++) {
            content = await buildContributorsList(
                getAllReadmeComments[match],
                contributors,
                collaborators,
                bots,
                sponsors,
                content
            );
        }

        const base64String = Buffer.from(content, 'utf8').toString('base64');

        if (prevContent !== content) {
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                message,
                content: base64String,
                path,
                sha: readme.data.sha,
                committer: {
                    name,
                    email
                }
            });
            console.log('Updated contribution section of readme');
        }
    } catch (error) {
        setFailed(error.message);
    }
}

run();
