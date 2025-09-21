// src/utils/oauth.ts
export class GitHubOAuth {
  private static CLIENT_ID = 'your_github_client_id'; // You'll need to set this
  private static get REDIRECT_URL() {
    // Safely get redirect URL with fallback
    try {
      return chrome?.identity?.getRedirectURL?.() || 'https://extension-callback.local';
    } catch {
      return 'https://extension-callback.local';
    }
  }
  private static SCOPES = 'repo,user';

  static async authenticate(): Promise<string | null> {
    // Check if chrome.identity is available
    if (!chrome?.identity?.launchWebAuthFlow) {
      console.log('[PushUp] chrome.identity not available, using Personal Access Token method');
      return this.authenticateWithPersonalToken();
    }

    try {
      const authUrl = `https://github.com/login/oauth/authorize?` +
        `client_id=${this.CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(this.REDIRECT_URL)}&` +
        `scope=${encodeURIComponent(this.SCOPES)}&` +
        `response_type=code`;

      return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          {
            url: authUrl,
            interactive: true
          },
          (responseUrl) => {
            if (chrome.runtime.lastError) {
              console.error('OAuth Error:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }

            if (!responseUrl) {
              reject(new Error('No response URL received'));
              return;
            }

            // Extract the authorization code from the URL
            const url = new URL(responseUrl);
            const code = url.searchParams.get('code');
            
            if (!code) {
              reject(new Error('No authorization code received'));
              return;
            }

            // Exchange code for access token
            this.exchangeCodeForToken(code)
              .then(resolve)
              .catch(reject);
          }
        );
      });
    } catch (error) {
      console.error('Authentication failed:', error);
      return null;
    }
  }

  private static async exchangeCodeForToken(code: string): Promise<string> {
    // For Chrome extensions, we need to handle this differently
    // Option 1: Use your backend server to exchange the code
    // Option 2: Use GitHub's client-side flow (less secure)
    
    // Using backend approach (recommended)
    const response = await fetch('http://localhost:3000/auth/github/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    return data.access_token;
  }

  // Alternative: Direct GitHub token generation method
  static async authenticateWithPersonalToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div style="
          position: fixed; 
          top: 0; 
          left: 0; 
          width: 100%; 
          height: 100%; 
          background: rgba(0,0,0,0.8); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          z-index: 10000;
        ">
          <div style="
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            max-width: 500px; 
            width: 90%;
          ">
            <h3>GitHub Personal Access Token</h3>
            <p>Create a Personal Access Token with 'repo' and 'user' permissions:</p>
            <ol>
              <li>Go to <a href="https://github.com/settings/tokens/new" target="_blank">GitHub Settings → Personal Access Tokens</a></li>
              <li>Click "Generate new token (classic)"</li>
              <li>Give it a name like "PushUp Extension"</li>
              <li>Select scopes: <strong>repo</strong> and <strong>user</strong></li>
              <li>Click "Generate token"</li>
              <li>Copy the token and paste it below</li>
            </ol>
            <input type="password" id="github-token" placeholder="Paste your token here" style="
              width: 100%; 
              padding: 10px; 
              margin: 10px 0; 
              border: 1px solid #ddd; 
              border-radius: 4px;
            ">
            <div style="text-align: right; margin-top: 15px;">
              <button id="cancel-btn" style="
                padding: 8px 16px; 
                margin-right: 10px; 
                border: 1px solid #ddd; 
                background: white; 
                border-radius: 4px; 
                cursor: pointer;
              ">Cancel</button>
              <button id="save-btn" style="
                padding: 8px 16px; 
                background: #007cba; 
                color: white; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer;
              ">Save Token</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const tokenInput = modal.querySelector('#github-token') as HTMLInputElement;
      const saveBtn = modal.querySelector('#save-btn') as HTMLButtonElement;
      const cancelBtn = modal.querySelector('#cancel-btn') as HTMLButtonElement;

      const cleanup = () => {
        document.body.removeChild(modal);
      };

      saveBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token) {
          cleanup();
          resolve(token);
        } else {
          alert('Please enter a valid token');
        }
      });

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      // Focus the input
      tokenInput.focus();

      // Allow Enter key to save
      tokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          saveBtn.click();
        }
      });
    });
  }
}