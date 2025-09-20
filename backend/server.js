import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(session({ secret: "secret", resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// ---- GitHub OAuth Strategy ----
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.REDIRECT_URI, // from .env
    },
    function (accessToken, refreshToken, profile, done) {
      return done(null, { profile, token: accessToken });
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ---- Routes ----

// Step 1: Start GitHub login
app.get(
  "/auth/github/login",
  passport.authenticate("github", { scope: ["repo", "user"] })
);

// Step 2: GitHub callback
app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  (req, res) => {
    if (!req.user || !req.user.token) {
      console.error('Missing user or token in callback');
      return res.redirect('/?error=auth_failed');
    }

    const token = req.user.token;
    const frontendRedirect =
      process.env.FRONTEND_REDIRECT ||
      `chrome-extension://${process.env.EXTENSION_ID}/index.html`;

    // Store token in session
    req.session.token = token;
    
    // Redirect with state parameter for additional security
    const state = Math.random().toString(36).substring(7);
    req.session.state = state;
    res.redirect(`${frontendRedirect}?token=${token}&state=${state}`);
  }
);

// Step 3: Verify token & fetch GitHub profile
app.get("/me", async (req, res) => {
  const token = req.query.token;
  const state = req.query.state;

  if (!token) {
    return res.status(400).json({ error: "Missing token" });
  }

  // Verify state parameter matches session
  if (state !== req.session.state) {
    return res.status(400).json({ error: "Invalid state parameter" });
  }

  try {
    const response = await axios.get("https://api.github.com/user", {
      headers: { 
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json'
      },
    });

    // Verify user has required scopes
    const scopes = response.headers['x-oauth-scopes'] || '';
    if (!scopes.includes('repo')) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        message: "The app requires repository access"
      });
    }

    res.json({ 
      success: true, 
      user: response.data,
      scopes: scopes.split(',').map(s => s.trim())
    });
  } catch (err) {
    console.error('GitHub API Error:', err);
    res.status(401).json({ 
      error: "Authentication failed",
      message: "Invalid or expired token"
    });
  }
});

// Optional root route
app.get("/", (req, res) => {
  res.send("✅ Backend is running. Try /auth/github/login");
});

app.listen(3000, () =>
  console.log("✅ Backend running at http://localhost:3000")
);
