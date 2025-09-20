import { useEffect, useState } from "react";

type Badge = { id: string; name: string; desc: string; earned: boolean };

export default function Achievements() {
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    chrome.storage.local.get(["streak", "totalSolved"], (res) => {
      const streak = res.streak || 0;
      const solved = res.totalSolved || 0;

      const earnedBadges: Badge[] = [
        { id: "streak7", name: "🔥 7-Day Streak", desc: "Solve daily for 7 days", earned: streak >= 7 },
        { id: "streak30", name: "🔥 30-Day Streak", desc: "1 month consistency", earned: streak >= 30 },
        { id: "easy10", name: "🟢 Easy Master", desc: "10 Easy problems solved", earned: solved >= 10 },
        { id: "hard5", name: "🔴 Hard Grinder", desc: "5 Hard problems solved", earned: solved >= 5 },
      ];

      setBadges(earnedBadges);
    });
  }, []);

  return (
    <div className="p-4 font-sans bg-gray-900 min-h-full text-white">
      <h2 className="text-2xl font-bold mb-6">🏆 Achievements</h2>
      <div className="grid gap-4">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`p-4 rounded-xl shadow-md transition transform hover:scale-[1.02] ${
              b.earned ? "bg-indigo-700/40 border border-indigo-500" : "bg-gray-800 border border-gray-700"
            }`}
          >
            <h3 className="font-semibold text-lg">{b.name}</h3>
            <p className="text-sm text-gray-300">{b.desc}</p>
            <p className="mt-2">{b.earned ? "✅ Earned" : "🔒 Locked"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
