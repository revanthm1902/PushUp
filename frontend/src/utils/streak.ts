interface StreakData {
  streak: number;
  lastPushDate: string;
  longestStreak: number;
}

export interface Achievement {
  id: string;
  title: string;
  message: string;
  emoji: string;
  condition: (streak: number) => boolean;
}

const achievements: Achievement[] = [
  {
    id: 'streak-7',
    title: '1 Week Streak',
    message: '🔥 You\'ve been coding for 7 days straight!',
    emoji: '🔥',
    condition: (streak: number) => streak >= 7
  },
  {
    id: 'streak-30',
    title: '1 Month Streak',
    message: '💎 Amazing! A whole month of continuous coding!',
    emoji: '💎',
    condition: (streak: number) => streak >= 30
  },
  {
    id: 'streak-50',
    title: '50 Day Streak',
    message: '🏆 Incredible! You\'ve reached the 50-day milestone!',
    emoji: '🏆',
    condition: (streak: number) => streak >= 50
  },
  {
    id: 'streak-100',
    title: 'Century Streak',
    message: '🌟 Legendary! 100 days of consistent coding!',
    emoji: '🌟',
    condition: (streak: number) => streak >= 100
  }
];

export async function updateStreak(): Promise<{ streak: number; newAchievements: Achievement[] }> {
  const data = await chrome.storage.local.get(['streak', 'lastPushDate', 'longestStreak']) as StreakData;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  // If already pushed today, return current streak
  if (data.lastPushDate === today) {
    return {
      streak: data.streak || 0,
      newAchievements: []
    };
  }

  let newStreak = 1;
  if (data.lastPushDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (data.lastPushDate === yesterdayStr) {
      newStreak = (data.streak || 0) + 1;
    }
  }

  const longestStreak = Math.max(newStreak, data.longestStreak || 0);

  // Update storage
  await chrome.storage.local.set({
    streak: newStreak,
    lastPushDate: today,
    longestStreak
  });

  // Check for new achievements
  const newAchievements = await checkAchievements(newStreak);

  return {
    streak: newStreak,
    newAchievements
  };
}

export async function checkAchievements(currentStreak: number): Promise<Achievement[]> {
  const data = await chrome.storage.local.get(['unlockedAchievements']);
  const unlockedAchievements = new Set(data.unlockedAchievements || []);
  const newAchievements: Achievement[] = [];

  for (const achievement of achievements) {
    if (!unlockedAchievements.has(achievement.id) && achievement.condition(currentStreak)) {
      newAchievements.push(achievement);
      unlockedAchievements.add(achievement.id);
    }
  }

  if (newAchievements.length > 0) {
    await chrome.storage.local.set({
      unlockedAchievements: Array.from(unlockedAchievements)
    });
  }

  return newAchievements;
}

export async function getStreakStats(): Promise<StreakData> {
  const data = await chrome.storage.local.get([
    'streak',
    'lastPushDate',
    'longestStreak'
  ]) as StreakData;

  return {
    streak: data.streak || 0,
    lastPushDate: data.lastPushDate || '',
    longestStreak: data.longestStreak || 0
  };
}

export function getStreakEmoji(streak: number): string {
  if (streak >= 100) return '🌟';
  if (streak >= 50) return '🏆';
  if (streak >= 30) return '💎';
  if (streak >= 7) return '🔥';
  return '✨';
}

export function formatStreakMessage(streak: number): string {
  return `${getStreakEmoji(streak)} ${streak}-Day Streak! Keep it up! 💪`;
}
