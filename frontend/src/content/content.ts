interface SubmissionData {
  platform: string;
  problemId: string;
  code: string;
  language: string;
}

// Initialize the submission detector when the content script loads
console.log('[PushUp] Content script loaded');

class SubmissionDetector {
  private platform: string;

  constructor() {
    this.platform = this.detectPlatform();
    this.initializeDetection();
  }

  private detectPlatform(): string {
    const hostname = window.location.hostname;
    if (hostname.includes('leetcode')) return 'leetcode';
    if (hostname.includes('codeforces')) return 'codeforces';
    if (hostname.includes('codechef')) return 'codechef';
    return 'unknown';
  }

  private initializeDetection() {
    // Watch for successful submission indicators
    const observer = new MutationObserver(() => {
      if (this.isSuccessfulSubmission()) {
        const data = this.extractSubmissionData();
        this.sendToBackground(data);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private isSuccessfulSubmission(): boolean {
    switch (this.platform) {
      case 'leetcode':
        return !!document.querySelector('.success-icon');
      case 'codeforces':
        return document.body.innerText.includes('Accepted');
      case 'codechef':
        return document.body.innerText.includes('Success');
      default:
        return false;
    }
  }

  private extractSubmissionData(): SubmissionData {
    let data: Partial<SubmissionData> = { platform: this.platform };

    switch (this.platform) {
      case 'leetcode':
        data = {
          ...data,
          problemId: this.extractLeetCodeProblemId(),
          code: this.extractLeetCodeCode(),
          language: this.extractLeetCodeLanguage(),
        };
        break;
      // Add other platforms similarly
    }

    const submissionData = data as SubmissionData;
    this.logSubmission(submissionData);
    return submissionData;
  }

  private async sendToBackground(data: SubmissionData) {
    try {
      console.log('[PushUp] Sending submission to background:', data);
      const response = await chrome.runtime.sendMessage({
        type: 'NEW_SUBMISSION',
        data,
      });
      
      if (response?.success) {
        console.log('[PushUp] Submission saved successfully!');
      } else {
        console.error('[PushUp] Submission failed:', response?.error);
      }
    } catch (error) {
      console.error('[PushUp] Failed to send submission:', error);
    }
  }

  // Platform-specific extractors
  private extractLeetCodeProblemId(): string {
    try {
      const title = document.querySelector('.title-text')?.textContent;
      if (!title) throw new Error('Could not find problem title');
      return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    } catch (error) {
      console.error('[PushUp] Failed to extract LeetCode problem ID:', error);
      throw error;
    }
  }

  private extractLeetCodeCode(): string {
    try {
      const editor = document.querySelector('.monaco-editor');
      if (!editor) throw new Error('Could not find code editor');
      
      const codeElement = editor.querySelector('.view-lines');
      if (!codeElement) throw new Error('Could not find code content');
      
      const code = codeElement.textContent;
      if (!code) throw new Error('No code content found');
      
      return code.trim();
    } catch (error) {
      console.error('[PushUp] Failed to extract LeetCode code:', error);
      throw error;
    }
  }

  private extractLeetCodeLanguage(): string {
    try {
      const langElement = document.querySelector('.language-btn');
      if (!langElement) throw new Error('Could not find language selector');
      
      const language = langElement.textContent;
      if (!language) throw new Error('No language selected');
      
      return language.toLowerCase();
    } catch (error) {
      console.error('[PushUp] Failed to extract LeetCode language:', error);
      throw error;
    }
  }

  private logSubmission(data: SubmissionData) {
    console.log('[PushUp] Detected submission:', {
      platform: data.platform,
      problemId: data.problemId,
      language: data.language,
      codeLength: data.code.length
    });
  }
}

// Initialize detector and handle errors
try {
  new SubmissionDetector();
  console.log('[PushUp] Submission detector initialized successfully');
} catch (error) {
  console.error('[PushUp] Failed to initialize submission detector:', error);
}