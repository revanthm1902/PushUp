import { GitHubService, type GitHubConfig, GitHubError } from './utils/github';
import { updateStreak, formatStreakMessage, getStreakStats } from './utils/streak';

interface SubmissionData {
  platform: string;
  problemId: string;
  code: string;
  language: string;
}

let githubService: GitHubService | null = null;

// Initialize GitHub service when extension loads
chrome.storage.local.get(['githubToken', 'githubUser', 'githubRepo'], (data) => {
  if (data.githubToken && data.githubUser && data.githubRepo) {
    const config: GitHubConfig = {
      token: data.githubToken,
      owner: data.githubUser,
      repo: data.githubRepo
    };
    githubService = new GitHubService(config);
  }
});

// When extension installs → setup alarms
chrome.runtime.onInstalled.addListener(() => {
  // daily streak check
  chrome.alarms.create("dailyCheck", { periodInMinutes: 60 * 24 });
  // optional repo check (every 1h, can tune)
  chrome.alarms.create("repoCheck", { periodInMinutes: 60 });
});

// ALARM HANDLER
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyCheck") {
    void handleDailyCheck();
  } else if (alarm.name === "repoCheck") {
    void handleRepoCheck();
  }
});

// --- SUBMISSION HANDLING ---
async function handleNewSubmission(data: SubmissionData): Promise<void> {
  if (!githubService) {
    throw new Error('GitHub service not initialized. Please check your settings.');
  }

  try {
    // Save solution to GitHub
    await githubService.saveSolution(
      data.platform,
      data.problemId,
      data.code,
      data.language
    );

    // Update streak and check achievements
    const { streak, newAchievements } = await updateStreak();

    // Show streak notification if it changed
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/logo.png',
      title: '✅ Solution Saved',
      message: `${formatStreakMessage(streak)}\nSuccessfully saved ${data.platform} solution!`
    });

    // Show achievement notifications
    for (const achievement of newAchievements) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/logo.png',
        title: `${achievement.emoji} New Achievement!`,
        message: achievement.message
      });
    }

    // Update storage with new submission
    await chrome.storage.local.get(['totalSolved'], (result) => {
      const totalSolved = (result.totalSolved || 0) + 1;
      void chrome.storage.local.set({ totalSolved });
    });

  } catch (error) {
    console.error('Failed to handle submission:', error);
    if (error instanceof GitHubError) {
      throw new Error(`GitHub Error: ${error.message} (${error.code})`);
    }
    throw error;
  }
}

// --- DAILY STREAK LOGIC ---
async function handleDailyCheck(): Promise<void> {
  const data = await chrome.storage.local.get(['notifications']);
  
  // Check if user has made any submissions today
  const stats = await getStreakStats();
  const today = new Date().toISOString().split('T')[0];
  
  // Only notify about streak if notifications are enabled and we haven't pushed today
  if (data.notifications && stats.lastPushDate !== today) {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/logo.png',
      title: 'Daily Reminder',
      message: `Don't forget to code today! ${formatStreakMessage(stats.streak)}`
    });
  }
}

// --- GITHUB REPO CHECK LOGIC ---
async function handleRepoCheck(): Promise<void> {
  const data = await chrome.storage.local.get(['repoCheck', 'githubUser', 'githubRepo']);
  
  if (!data.repoCheck || !data.githubUser || !data.githubRepo) return;

  try {
    if (!githubService) {
      throw new Error('GitHub service not initialized');
    }

    const hasActivity = await githubService.verifyRepoAccess();
    
    if (hasActivity) {
      const storageData = await chrome.storage.local.get(['totalSolved']);
      const solved = (storageData.totalSolved || 0) + 1;
      await chrome.storage.local.set({ totalSolved: solved });

      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/logo.png',
        title: '✅ Repo Activity Detected',
        message: `New commit detected! Total solutions: ${solved}`
      });
    }
  } catch (error) {
    console.error('Repo check failed:', error);
  }
}

// Message handling
chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.type === 'NEW_SUBMISSION') {
    void handleNewSubmission(message.data)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
  
  if (message.type === 'GITHUB_CONFIG_UPDATED') {
    const config: GitHubConfig = {
      token: message.data.token,
      owner: message.data.owner,
      repo: message.data.repo
    };
    githubService = new GitHubService(config);
    sendResponse({ success: true });
    return true;
  }
});