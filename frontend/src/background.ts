import { GitHubService, type GitHubConfig, GitHubError } from './utils/github';
import { updateStreak, formatStreakMessage, getStreakStats } from './utils/streak';

interface SubmissionData {
  platform: string;
  problemId: string;
  code: string;
  language: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  title?: string;
}

interface DailySubmissionData {
  date: string;
  submissions: number;
  problems: {
    easy: number;
    medium: number;
    hard: number;
  };
}

let githubService: GitHubService | null = null;

// Initialize GitHub service when extension loads
chrome.storage.local.get(['githubToken', 'githubOwner', 'githubRepo'], (data) => {
  if (data.githubToken && data.githubOwner && data.githubRepo) {
    const config: GitHubConfig = {
      token: data.githubToken,
      owner: data.githubOwner,
      repo: data.githubRepo
    };
    githubService = new GitHubService(config);
    console.log('[PushUp] GitHub service initialized:', config.owner + '/' + config.repo);
  } else {
    console.log('[PushUp] GitHub service not initialized - missing configuration');
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
    console.log('[PushUp] Processing submission:', data);

    // Save solution to GitHub
    await githubService.saveSolution(
      data.platform,
      data.problemId,
      data.code,
      data.language
    );

    // Update daily submission tracking
    await updateDailySubmissions(data);

    // Update streak and check achievements
    const { streak, newAchievements } = await updateStreak();

    // Show streak notification
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/logo.png',
      title: '✅ Solution Saved to GitHub',
      message: `${formatStreakMessage(streak)}\n${data.platform} - ${data.problemId}`
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

    console.log('[PushUp] Submission processed successfully');

  } catch (error) {
    console.error('Failed to handle submission:', error);
    
    // Show error notification
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/logo.png',
      title: '❌ Submission Failed',
      message: `Failed to save ${data.platform} solution. Check settings.`
    });
    
    if (error instanceof GitHubError) {
      throw new Error(`GitHub Error: ${error.message} (${error.code})`);
    }
    throw error;
  }
}

// Update daily submission tracking
async function updateDailySubmissions(data: SubmissionData): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['dailySubmissions', 'totalSolved', 'easy', 'medium', 'hard'], (result) => {
      const dailySubmissions: DailySubmissionData[] = result.dailySubmissions || [];
      let todayData = dailySubmissions.find(d => d.date === today);
      
      if (!todayData) {
        todayData = {
          date: today,
          submissions: 0,
          problems: { easy: 0, medium: 0, hard: 0 }
        };
        dailySubmissions.push(todayData);
      }
      
      // Update submission count
      todayData.submissions++;
      
      // Update difficulty count if provided
      if (data.difficulty) {
        todayData.problems[data.difficulty]++;
      }
      
      // Update total counts
      const totalSolved = (result.totalSolved || 0) + 1;
      const easy = (result.easy || 0) + (data.difficulty === 'easy' ? 1 : 0);
      const medium = (result.medium || 0) + (data.difficulty === 'medium' ? 1 : 0);
      const hard = (result.hard || 0) + (data.difficulty === 'hard' ? 1 : 0);
      
      // Keep only last 365 days
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const filteredSubmissions = dailySubmissions.filter(d => 
        new Date(d.date) >= oneYearAgo
      );
      
      chrome.storage.local.set({
        dailySubmissions: filteredSubmissions,
        totalSolved,
        easy,
        medium,
        hard,
        lastSubmissionDate: today
      }, () => {
        console.log('[PushUp] Daily submissions updated:', { totalSolved, easy, medium, hard });
        resolve();
      });
    });
  });
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
  const data = await chrome.storage.local.get(['notifications', 'githubOwner', 'githubRepo']);
  
  if (!data.notifications || !data.githubOwner || !data.githubRepo) return;

  // Simple check - just log that we checked (can be enhanced later)
  console.log('[PushUp] Repository check completed for:', data.githubOwner + '/' + data.githubRepo);
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
    console.log('[PushUp] GitHub service updated:', config.owner + '/' + config.repo);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'GET_SUBMISSION_STATS') {
    chrome.storage.local.get(['dailySubmissions', 'totalSolved', 'easy', 'medium', 'hard'], (result) => {
      sendResponse({
        success: true,
        data: {
          dailySubmissions: result.dailySubmissions || [],
          totalSolved: result.totalSolved || 0,
          easy: result.easy || 0,
          medium: result.medium || 0,
          hard: result.hard || 0
        }
      });
    });
    return true;
  }
});