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

  async createRepositoryWithStructure(repoName: string, description?: string) {
    try {
      if (!this.octokit) {
        throw new GitHubError('GitHub client is not initialized', 'INIT_ERROR');
      }

      let repoData;
      
      try {
        // Try to create the repository
        const { data } = await this.octokit.repos.createForAuthenticatedUser({
          name: repoName,
          auto_init: true,
          private: false, // Making it public for better visibility
          description: description || 'My coding solutions repository managed by PushUp - Practice makes perfect! 🚀',
        });
        repoData = data;
        console.log('[PushUp] Repository created successfully:', repoName);
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 422) {
          // Repository already exists, try to get it
          console.log('[PushUp] Repository already exists, trying to access it:', repoName);
          try {
            const { data } = await this.octokit.repos.get({
              owner: this.owner,
              repo: repoName,
            });
            repoData = data;
            console.log('[PushUp] Successfully accessed existing repository:', repoName);
          } catch {
            throw new GitHubError('Repository already exists and cannot be accessed. Please choose a different name or check permissions.', 'REPO_ACCESS_ERROR');
          }
        } else {
          throw this.handleGitHubError(error);
        }
      }
      
      if (!repoData || !repoData.owner) {
        throw new GitHubError('Failed to access repository', 'REPO_ACCESS_ERROR');
      }
      
      this.owner = repoData.owner.login;
      this.repo = repoData.name;
      
      // Initialize the folder structure (this will work even for existing repos)
      await this.initializeFolders();
      
      return {
        success: true,
        repoUrl: repoData.html_url,
        owner: this.owner,
        repo: this.repo
      };
    } catch (error) {
      if (error instanceof GitHubError) {
        throw error;
      }
      throw this.handleGitHubError(error);
    }
  }

  private async initializeFolders() {
    const folders = [
      { name: 'leetcode', description: 'LeetCode Solutions' },
      { name: 'codeforces', description: 'Codeforces Solutions' },
      { name: 'codechef', description: 'CodeChef Solutions' }
    ];
    
    try {
      // Create README.md for the repository (only if it doesn't exist)
      const readmeExists = await this.checkFileExists('README.md');
      if (!readmeExists) {
        const readmeContent = this.generateRepositoryReadme();
        await this.createFile('README.md', readmeContent, 'Initial commit: Setup repository structure');
        console.log('[PushUp] Created main README.md');
      } else {
        console.log('[PushUp] README.md already exists, skipping');
      }
      
      // Create folders with their own README files
      for (const folder of folders) {
        const folderReadmePath = `${folder.name}/README.md`;
        const folderExists = await this.checkFileExists(folderReadmePath);
        
        if (!folderExists) {
          const folderReadme = this.generateFolderReadme(folder.name, folder.description);
          await this.createFile(folderReadmePath, folderReadme, `Initialize ${folder.name} folder`);
          console.log(`[PushUp] Created ${folder.name} folder with README`);
        } else {
          console.log(`[PushUp] ${folder.name} folder already exists, skipping`);
        }
      }
      
      console.log('[PushUp] Repository structure initialization completed');
    } catch (error) {
      console.error('[PushUp] Error initializing folders:', error);
      throw this.handleGitHubError(error);
    }
  }

  private generateRepositoryReadme(): string {
    return `# 🚀 My Coding Journey

This repository contains my coding solutions from various competitive programming platforms, automatically managed by **PushUp** extension.

## 📁 Repository Structure

\`\`\`
├── leetcode/          # LeetCode solutions
├── codeforces/        # Codeforces solutions
└── codechef/          # CodeChef solutions
\`\`\`

## 🎯 Platforms

- **LeetCode**: Data Structures & Algorithms practice
- **Codeforces**: Competitive programming contests
- **CodeChef**: Monthly challenges and contests

## 📊 Progress Tracking

This repository is automatically updated by the PushUp browser extension, which:
- ✅ Automatically detects successful submissions
- 📝 Saves solutions with proper file organization
- 🔥 Tracks coding streaks and progress
- 🏆 Manages achievements and milestones

---
*Generated by [PushUp Extension](https://github.com/revanthm1902/PushUp) 🎯*
`;
  }

  private generateFolderReadme(platform: string, description: string): string {
    const platformUpper = platform.charAt(0).toUpperCase() + platform.slice(1);
    
    return `# ${platformUpper} Solutions

${description} organized and tracked by PushUp extension.

## 📝 File Naming Convention

Files are automatically named based on the problem:
- Problem titles are converted to kebab-case
- File extensions match the programming language used
- Example: \`two-sum.py\`, \`binary-search.cpp\`

## 🏆 Stats

Solutions in this folder are automatically tracked for:
- Daily solving streaks
- Difficulty distribution  
- Language usage patterns
- Time-based progress

---
*Auto-generated by PushUp Extension*
`;
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
        content: btoa(unescape(encodeURIComponent(content))),
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
        content: btoa(unescape(encodeURIComponent(content))),
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

// Utility function to get user information
export async function getUserInfo(token: string) {
  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.users.getAuthenticated();
    return {
      login: data.login,
      name: data.name,
      avatar_url: data.avatar_url,
      public_repos: data.public_repos
    };
  } catch (error) {
    console.error('Failed to get user info:', error);
    throw new GitHubError('Failed to fetch user information', 'USER_INFO_ERROR');
  }
}
