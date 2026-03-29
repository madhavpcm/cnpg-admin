import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import { Volume, createFsFromVolume } from 'memfs';
import * as path from 'path';

export async function cloneToMemory(repoUrl: string, token?: string) {
    const vol = new Volume();
    const fs = createFsFromVolume(vol);

    // @ts-ignore
    await git.clone({
        fs,
        http,
        dir: '/',
        url: repoUrl,
        onAuth: () => ({ username: token || 'x-token', password: '' }),
        singleBranch: true,
        depth: 1
    });

    return { vol, fs };
}

export async function createPullRequest(repoUrl: string, branch: string, filePath: string, newContent: string, commitMsg: string) {
    // This is where we'd commit and push.
    // For the PR part, we use the GitHub REST API.
    console.log(`[git-client] PR creation logic for ${repoUrl} on ${branch} for ${filePath}`);

    // MOCK for now
    return {
        url: `${repoUrl}/pull/123`,
        id: '123'
    };
}
