import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Bell, Award, Settings } from "lucide-react";
import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";

// Import external pages
import Achievements from "../achievements/achievements";
import SettingsPage from "../settings/settings";
import Notifications from "../notifications/notifications";

// Types
type DailyData = { date: string; solved: number; difficulty: "E" | "M" | "H" };
type StorageResult = {
  streak?: number;
  lastUpdated?: string;
  dailyData?: DailyData[];
  easy?: number;
  medium?: number;
  hard?: number;
};

// ---------------- Home Page ----------------
function Home({
  streak,
  dailyData,
  easy,
  medium,
  hard,
}: {
  streak: number;
  dailyData: DailyData[];
  easy: number;
  medium: number;
  hard: number;
}) {
  // build past 50 days
  const today = new Date();
  const past50Days = Array.from({ length: 50 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (49 - i));
    const iso = d.toISOString().split("T")[0];
    const found = dailyData.find((x) => x.date === iso);
    return { date: iso, solved: found?.solved || 0 };
  });

  // percentages
  const total = easy + medium + hard || 1;
  const easyPct = Math.round((easy / total) * 100);
  const mediumPct = Math.round((medium / total) * 100);
  const hardPct = Math.round((hard / total) * 100);

  // Donut Chart Data
  const chartData = [
    { name: "Easy", value: easy, color: "#22c55e" },
    { name: "Medium", value: medium, color: "#facc15" },
    { name: "Hard", value: hard, color: "#ef4444" },
  ];

  return (
    <div>
      {/* Streak Display */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-4 rounded-xl shadow-lg text-center mb-4">
        <p className="text-sm uppercase tracking-wide font-medium text-orange-100">
          Current Streak
        </p>
        <h1 className="text-4xl font-extrabold text-white drop-shadow-md">
          {streak} 🔥
        </h1>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-10 gap-1 mb-4">
        {past50Days.map((day, i) => (
          <div
            key={i}
            title={day.date}
            className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-medium
              ${day.solved === 0
                ? "bg-gray-700 text-gray-400"
                : day.solved < 2
                ? "bg-green-600 text-white"
                : day.solved < 4
                ? "bg-yellow-500 text-black"
                : "bg-red-500 text-white"
              }`}
          >
            {day.solved > 0 ? day.solved : ""}
          </div>
        ))}
      </div>

      {/* Donut Chart */}
      <div className="flex justify-center mb-5">
        <PieChart width={200} height={200}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={4}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#617ea6",
              borderRadius: "8px",
              border: "none",
              color: "white",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", color: "white" }} />
        </PieChart>
      </div>

      {/* Difficulty Stats */}
      <div className="flex justify-between text-sm mb-5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500" /> 
          E: {easy} ({easyPct}%)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-400" /> 
          M: {medium} ({mediumPct}%)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500" /> 
          H: {hard} ({hardPct}%)
        </div>
      </div>

      {/* Manual Button */}
      <div className="mb-4">
        <button
          className="w-full bg-orange-500 hover:bg-orange-600 active:scale-95 
                     text-white py-2.5 rounded-xl font-semibold transition-all 
                     shadow-md hover:shadow-lg"
          onClick={() => {
            const newStreak = streak + 1;
            const iso = new Date().toISOString().split("T")[0];
            const updatedDaily = [
              ...dailyData.filter((d) => d.date !== iso),
              { date: iso, solved: 1, difficulty: "E" },
            ];
            chrome.storage.local.set({
              streak: newStreak,
              lastUpdated: new Date().toISOString(),
              dailyData: updatedDaily,
              easy: easy + 1,
            });
          }}
        >
          +1 Manual Boost
        </button>
      </div>

      {/* Footer */}
      <footer className="text-xs text-gray-500 text-center border-t border-gray-700 pt-3">
        🚀 Built for Coders.
      </footer>
    </div>
  );
}

// ---------------- App Wrapper ----------------
export default function App() {
  const [streak, setStreak] = useState(0);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [easy, setEasy] = useState(0);
  const [medium, setMedium] = useState(0);
  const [hard, setHard] = useState(0);

  useEffect(() => {
    const isChromeStorageAvailable =
      typeof chrome !== "undefined" && !!chrome.storage?.local;

    // --- GitHub OAuth Token Handling ---
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      chrome.storage.local.set({ github_token: token }, () => {
        console.log("✅ GitHub token saved:", token);
      });
      // clean URL
      window.history.replaceState({}, document.title, "/");
    }

    // --- Load Stored Data ---
    const loadData = () => {
      if (isChromeStorageAvailable) {
        chrome.storage.local.get(
          ["streak", "dailyData", "easy", "medium", "hard"],
          (result: StorageResult) => {
            if (typeof result.streak === "number") setStreak(result.streak);
            if (Array.isArray(result.dailyData)) setDailyData(result.dailyData);
            if (typeof result.easy === "number") setEasy(result.easy);
            if (typeof result.medium === "number") setMedium(result.medium);
            if (typeof result.hard === "number") setHard(result.hard);
          }
        );
      }
    };

    loadData();

    // Listen to changes
    if (isChromeStorageAvailable && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local") {
          if (changes.streak?.newValue !== undefined) {
            setStreak(changes.streak.newValue as number);
          }
          if (changes.dailyData?.newValue) {
            setDailyData(changes.dailyData.newValue as DailyData[]);
          }
          if (changes.easy?.newValue) setEasy(changes.easy.newValue as number);
          if (changes.medium?.newValue) setMedium(changes.medium.newValue as number);
          if (changes.hard?.newValue) setHard(changes.hard.newValue as number);
        }
      });
    }
  }, []);

  return (
    <Router>
      <div className="w-80 p-5 font-sans bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="PushUp Logo" className="w-8 h-8" />
            <h2 className="text-lg font-extrabold">PushUp</h2>
          </div>
          <div className="flex items-center gap-3 text-gray-300">
            <Link to="/notifications">
              <Bell className="w-5 h-5 hover:text-white" />
            </Link>
            <Link to="/achievements">
              <Award className="w-5 h-5 hover:text-white" />
            </Link>
            <Link to="/settings">
              <Settings className="w-5 h-5 hover:text-white" />
            </Link>
          </div>
        </div>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<Home streak={streak} dailyData={dailyData} easy={easy} medium={medium} hard={hard} />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </Router>
  );
}
