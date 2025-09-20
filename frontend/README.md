# PushUp - GitHub Activity Tracking Extension

A Chrome extension to track your coding activity, GitHub commits, and maintain coding streaks.

## Project Structure

- `PushUp/` - Frontend Chrome extension (React + TypeScript + Vite)
- `PushUp-backend/` - Backend OAuth server (Express.js)

## Setup & Installation

### Backend Setup

1. Navigate to backend directory:
```sh
cd PushUp-backend
```

2. Install dependencies:
```sh
npm install
```

3. Create `.env` file with your GitHub OAuth credentials:
```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
REDIRECT_URI=http://localhost:3000/auth/github/callback
FRONTEND_REDIRECT=http://localhost:5173/
EXTENSION_ID=your_extension_id
```

4. Start the backend server:
```sh
npm start
```

Server will run at http://localhost:3000

### Frontend Extension Setup

1. Navigate to extension directory:
```sh
cd PushUp
```

2. Install dependencies:
```sh
npm install
```

3. Start development server:
```sh
npm run dev
```

4. Build the extension:
```sh
npm run build
```

5. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder from your build

## Features

- 🔥 Track daily coding streaks
- 📊 Visualize coding activity
- 🏆 Earn achievements
- 🔔 Get notifications
- 🔄 Auto-sync with GitHub commits
- ⚙️ Customizable settings

## Development

### Available Scripts

Frontend:
- `npm run dev` - Start development server
- `npm run build` - Build extension
- `npm run preview` - Preview build
- `npm run lint` - Run ESLint

Backend:
- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload

### Tech Stack

- Frontend:
  - React 19
  - TypeScript
  - Vite
  - TailwindCSS
  - React Router
  - Recharts

- Backend:
  - Express.js
  - Passport.js
  - GitHub OAuth

## Troubleshooting

1. If GitHub authentication fails:
   - Verify GitHub OAuth credentials in `.env`
   - Ensure backend server is running
   - Check CORS settings

2. If extension doesn't load:
   - Ensure build is complete
   - Check Chrome console for errors
   - Verify manifest.json is correctly configured

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
