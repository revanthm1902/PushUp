// src/utils/github.ts
import { Octokit } from '@octokit/rest';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export class GitHubError extends Error {
  readonly code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'GitHubError';
    this.code = code;
  }
}

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor({ token, owner, repo }: GitHubConfig) {
    if (!token) {
      throw new GitHubError('Authentication token is required', 'AUTH_REQUIRED');
    }
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  async setupRepo(repoName: string, isNew: boolean) {
    try {
      if (!this.octokit) {
        throw new GitHubError('GitHub client is not initialized', 'INIT_ERROR');
      }

      if (isNew) {
        await this.createNewRepo(repoName);
      } else {
        const hasAccess = await this.verifyRepoAccess();
        if (!hasAccess) {
          throw new GitHubError('Insufficient permissions for repository', 'PERMISSION_ERROR');
        }
      }
      await this.initializeFolders();
    } catch (error) {
      throw this.handleGitHubError(error);
    }
  }

  private async createNewRepo(name: string) {
    try {
      const { data } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        auto_init: true,
        private: true,
        description: 'My coding solutions repository managed by PushUp',
      });
      
      if (!data || !data.owner) {
        throw new GitHubError('Failed to create repository', 'REPO_CREATE_ERROR');
      }
      
      this.owner = data.owner.login;
      this.repo = data.name;
      
      // Verify we can access the newly created repo
      await this.verifyRepoAccess();
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 422) {
        throw new GitHubError('Repository already exists', 'REPO_EXISTS');
      }
      throw this.handleGitHubError(error);
    }
  }

  async verifyRepoAccess(): Promise<boolean> {
    try {
      const { data } = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      return data.permissions?.push || false;
    } catch (error) {
      throw this.handleGitHubError(error);
    }
  }

  private async initializeFolders() {
    const folders = ['leetcode', 'codeforces', 'codechef'];
    for (const folder of folders) {
      if (!(await this.checkFileExists(`${folder}/.gitkeep`))) {
        await this.createFile(
          `${folder}/.gitkeep`,
          '',
          `Initialize ${folder} folder`
        );
      }
    }
  }

  async saveSolution(platform: string, problemId: string, code: string, language: string) {
    const path = this.getFilePath(platform, problemId, language);
    const fileExists = await this.checkFileExists(path);
    const message = this.generateCommitMessage(platform, problemId, fileExists);
    
    try {
      if (fileExists) {
        await this.updateFile(path, code, message);
      } else {
        await this.createFile(path, code, message);
      }
    } catch (error) {
      throw this.handleGitHubError(error);
    }
  }

  private getFilePath(platform: string, problemId: string, language: string): string {
    const ext = this.getFileExtension(language);
    const sanitizedProblemId = this.sanitizeFileName(problemId);
    
    switch (platform.toLowerCase()) {
      case 'leetcode':
        return `leetcode/${sanitizedProblemId}.${ext}`;
      case 'codeforces':
        return `codeforces/${sanitizedProblemId}.${ext}`;
      case 'codechef':
        return `codechef/${sanitizedProblemId}.${ext}`;
      default:
        throw new GitHubError(`Unsupported platform: ${platform}`, 'INVALID_PLATFORM');
    }
  }

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private getFileExtension(language: string): string {
    const langMap: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      'c++': 'cpp',
      ruby: 'rb',
      golang: 'go',
      rust: 'rs',
    };
    return langMap[language.toLowerCase()] || 'txt';
  }

  private async checkFileExists(path: string): Promise<boolean> {
    try {
      await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      });
      return true;
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) {
        return false;
      }
      throw this.handleGitHubError(error);
    }
  }

  private async createFile(path: string, content: string, message: string) {
    try {
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
      });
    } catch (error) {
      throw this.handleGitHubError(error);
    }
  }

  private async updateFile(path: string, content: string, message: string) {
    try {
      const { data: existing } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      });

      if (!('sha' in existing)) {
        throw new GitHubError('Invalid file data received from GitHub', 'INVALID_RESPONSE');
      }

      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        sha: existing.sha,
      });
    } catch (error) {
      throw this.handleGitHubError(error);
    }
  }

  private generateCommitMessage(platform: string, problemId: string, isUpdate: boolean): string {
    const action = isUpdate ? 'Update' : 'Add';
    return `${action} ${platform} solution: ${problemId}`;
  }

  private handleGitHubError(error: unknown): GitHubError {
    if (error instanceof GitHubError) {
      return error;
    }

    let message = 'Unknown GitHub error';
    let code = 'UNKNOWN_ERROR';

    if (error instanceof Error) {
      message = error.message;
      
      if ('response' in error && error.response && typeof error.response === 'object') {
        const response = error.response as { data?: { message?: string }, status?: number };
        
        if (response.data?.message) {
          message = response.data.message;
        }

        if (response.status) {
          switch (response.status) {
            case 401:
              code = 'UNAUTHORIZED';
              break;
            case 403:
              code = 'FORBIDDEN';
              break;
            case 404:
              code = 'NOT_FOUND';
              break;
            case 422:
              code = 'VALIDATION_FAILED';
              break;
          }
        }
      }
    }

    return new GitHubError(message, code);
  }
}

// Utility function to check repository activity
export async function checkRepoActivity(username: string, repo: string) {
  try {
    const url = `https://api.github.com/repos/${username}/${repo}/commits?per_page=1`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch commits: ${res.statusText}`);
    }
    const commits = await res.json();
    if (commits && commits.length > 0) {
      const lastCommitDate = new Date(commits[0].commit.author.date);
      const today = new Date();
      return lastCommitDate.toDateString() === today.toDateString();
    }
    return false;
  } catch (error) {
    console.error('Failed to check repo activity:', error);
    return false;
  }
}
