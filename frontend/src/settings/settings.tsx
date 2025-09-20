import { useEffect, useState } from "react";
import { GitHubService } from '../utils/github';

// ---- Polyfill for chrome.storage in dev ----
if (typeof chrome === "undefined" || !chrome.storage) {
  console.log("[DEV] Using chrome.storage polyfill (localStorage)");

  interface ChromeStorageLocal {
    get: (keys: string[] | object, cb: (items: { [key: string]: unknown }) => void) => void;
    set: (obj: object, cb?: () => void) => void;
    remove: (key: string, cb?: () => void) => void;
  }

  interface ChromeStorage {
    local: ChromeStorageLocal;
  }

  interface ChromePolyfill {
    storage: ChromeStorage;
    tabs?: {
      create?: (createProperties: { url: string }) => void;
    };
  }

  (window as unknown as { chrome: ChromePolyfill }).chrome = {
    storage: {
      local: {
        get: (_keys, cb) => {
          const stored = JSON.parse(localStorage.getItem("ext_data") || "{}");
          console.log("[DEV] storage.get →", stored);
          cb(stored);
        },
        set: (obj, cb) => {
          const stored = JSON.parse(localStorage.getItem("ext_data") || "{}");
          const updated = { ...stored, ...obj };
          localStorage.setItem("ext_data", JSON.stringify(updated));
          console.log("[DEV] storage.set →", updated);
          if (cb) cb();
        },
        remove: (key, cb) => {
          const stored = JSON.parse(localStorage.getItem("ext_data") || "{}");
          delete stored[key];
          localStorage.setItem("ext_data", JSON.stringify(stored));
          console.log("[DEV] storage.remove →", key);
          if (cb) cb();
        },
      },
    },
    tabs: {
      create: ({ url }) => {
        console.log("[DEV] tabs.create →", url);
        window.open(url, "_blank");
      },
    },
  };
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [repoCheck, setRepoCheck] = useState(false);
  const [githubUser, setGithubUser] = useState("");
  const [githubRepo, setGithubRepo] = useState("");

  // ---- Capture GitHub token from URL ----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
      chrome.storage.local.set({ github_token: t });
      console.log("[DEV] Token captured from URL →", t);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ---- Load saved values ----
  useEffect(() => {
    chrome.storage.local.get(
      ["github_token", "notifications", "repoCheck", "githubUser", "githubRepo"],
      (result) => {
        console.log("[DEV] storage.get(load) →", result);
        if (result.github_token) setToken(result.github_token as string);
        if (result.notifications !== undefined) setNotifications(result.notifications as boolean);
        if (result.repoCheck !== undefined) setRepoCheck(result.repoCheck as boolean);
        if (result.githubUser) setGithubUser(result.githubUser as string);
        if (result.githubRepo) setGithubRepo(result.githubRepo as string);
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (token) {
      fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${token}` },
      })
        .then((res) => res.json())
        .then((data) => console.log("[DEV] GitHub user →", data))
        .catch((err) => console.error("[DEV] GitHub error →", err));
    }
  }, [token]);


  // ---- Save preferences ----
  useEffect(() => {
    if (!loading) {
      chrome.storage.local.set({ notifications, repoCheck, githubUser, githubRepo });
      console.log("[DEV] storage.set(preferences) →", {
        notifications,
        repoCheck,
        githubUser,
        githubRepo,
      });
    }
  }, [notifications, repoCheck, githubUser, githubRepo, loading]);

  // ---- Handlers ----
  const handleLogin = () => {
    if (chrome.tabs?.create) {
      chrome.tabs.create({ url: "http://localhost:3000/auth/github/login" });
    } else {
      window.location.href = "http://localhost:3000/auth/github/login"; // dev fallback
    }
  };

  const handleLogout = () => {
    chrome.storage.local.remove("github_token", () => {
      console.log("[DEV] Token removed");
      setToken(null);
    });
  };

  const [repoName, setRepoName] = useState('');
  const [isNewRepo, setIsNewRepo] = useState(true);

  const handleSetup = async () => {
    try {
      const result = await chrome.storage.local.get(['github_token', 'githubUser']);
      if (!result.github_token || !result.githubUser) {
        throw new Error('GitHub token or username not found. Please connect your GitHub account first.');
      }

      const github = new GitHubService({
        token: result.github_token as string,
        owner: result.githubUser as string,
        repo: repoName
      });

      await github.setupRepo(repoName, isNewRepo);
      
      // Update the repo name in storage after successful setup
      await chrome.storage.local.set({ githubRepo: repoName });
      setGithubRepo(repoName);
      
      alert('Repository setup successful!');
    } catch (error) {
      console.error('Setup failed:', error);
      alert(error instanceof Error ? error.message : 'Repository setup failed. Please check the console for details.');
    }
  };

  if (loading) {
    return (
      <div className="p-5 text-white bg-gray-900 min-h-full">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-5 min-w-[300px] font-sans bg-gray-900 text-white min-h-full">
      <h2 className="text-2xl font-bold mb-5">⚙️ Settings</h2>

      {/* GitHub Auth Section */}
      <div className="bg-gray-800 p-4 rounded-lg shadow mb-5">
        <h3 className="text-lg font-semibold mb-3">GitHub Connection</h3>
        {token ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-green-400">✅ Connected to GitHub</p>
            <p className="text-sm text-gray-400 break-all">Token saved: {token.slice(0, 10)}...</p>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md transition"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg shadow-md transition"
          >
            Login with GitHub
          </button>
        )}
      </div>

      {/* Preferences */}
      <div className="space-y-4">
        <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg shadow hover:bg-gray-700 transition">
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
            className="accent-blue-500 w-5 h-5"
          />
          <span className="text-sm">Enable Notifications</span>
        </label>

        <label className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg shadow hover:bg-gray-700 transition">
          <input
            type="checkbox"
            checked={repoCheck}
            onChange={(e) => setRepoCheck(e.target.checked)}
            className="accent-blue-500 w-5 h-5"
          />
          <span className="text-sm">Enable Repo Checking</span>
        </label>

        <div className="bg-gray-800 p-3 rounded-lg shadow">
          <label className="block text-xs text-gray-400 mb-1">GitHub Username</label>
          <input
            type="text"
            className="border border-gray-700 rounded p-2 w-full bg-gray-900 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={githubUser}
            onChange={(e) => setGithubUser(e.target.value)}
            placeholder="e.g. revanth123"
          />
        </div>

        <div className="bg-gray-800 p-3 rounded-lg shadow">
          <label className="block text-xs text-gray-400 mb-1">Repository Name</label>
          <input
            type="text"
            className="border border-gray-700 rounded p-2 w-full bg-gray-900 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            placeholder="e.g. pushup-tracker"
          />
        </div>
      </div>

      {/* Repository Setup */}
      <div className="bg-gray-800 p-4 rounded-lg shadow mt-5">
        <h3 className="text-lg font-semibold mb-3">GitHub Repository Setup</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block mb-2">
              <input
                type="radio"
                checked={isNewRepo}
                onChange={() => setIsNewRepo(true)}
                className="mr-2"
              />
              Create new repository
            </label>
            <label className="block">
              <input
                type="radio"
                checked={!isNewRepo}
                onChange={() => setIsNewRepo(false)}
                className="mr-2"
              />
              Use existing repository
            </label>
          </div>

          <input
            type="text"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="Repository name"
            className="w-full p-2 border rounded"
          />

          <button
            onClick={handleSetup}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Set Up Repository
          </button>
        </div>
      </div>
    </div>
  );
}
