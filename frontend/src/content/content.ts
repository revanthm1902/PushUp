interface SubmissionData {
  platform: string;
  problemId: string;
  code: string;
  language: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  title?: string;
}

// Initialize the submission detector when the content script loads
console.log('[PushUp] Content script loaded');

// Add debug helper to window for manual testing
interface PushUpDebug {
  detector: SubmissionDetector | null;
  testExtraction: () => SubmissionData | null | string;
  checkSuccessIndicators: () => boolean | string;
  debugDOM: () => void;
  findTitleElements: () => void;
}

(window as unknown as { PushUpDebug: PushUpDebug }).PushUpDebug = {
  detector: null,
  testExtraction: () => {
    const debug = (window as unknown as { PushUpDebug: PushUpDebug }).PushUpDebug;
    if (debug.detector) {
      try {
        const data = debug.detector.extractSubmissionData();
        console.log('[PushUp DEBUG] Extracted data:', data);
        return data;
      } catch (error) {
        console.error('[PushUp DEBUG] Extraction failed:', error);
        return null;
      }
    }
    return 'No detector instance found';
  },
  checkSuccessIndicators: () => {
    const debug = (window as unknown as { PushUpDebug: PushUpDebug }).PushUpDebug;
    if (debug.detector) {
      const isSuccess = debug.detector.isSuccessfulSubmission();
      console.log('[PushUp DEBUG] Success detected:', isSuccess);
      return isSuccess;
    }
    return 'No detector instance found';
  },
  debugDOM: () => {
    console.log('[PushUp DEBUG] DOM Analysis:');
    console.log('URL:', window.location.href);
    console.log('Title:', document.title);
    console.log('All h1 elements:', Array.from(document.querySelectorAll('h1')).map(el => ({ element: el, text: el.textContent?.trim() })));
    console.log('All elements with "title" in class:', Array.from(document.querySelectorAll('[class*="title"]')).map(el => ({ element: el, text: el.textContent?.trim(), className: el.className })));
    console.log('All elements with "question" in class:', Array.from(document.querySelectorAll('[class*="question"]')).map(el => ({ element: el, text: el.textContent?.trim(), className: el.className })));
    console.log('All elements with "problem" in class:', Array.from(document.querySelectorAll('[class*="problem"]')).map(el => ({ element: el, text: el.textContent?.trim(), className: el.className })));
  },
  findTitleElements: () => {
    console.log('[PushUp DEBUG] Searching for title elements...');
    const selectors = [
      'h1', 'h2', 'h3',
      '[class*="title"]',
      '[class*="question"]',
      '[class*="problem"]',
      '[data-cy*="title"]',
      '[data-cy*="question"]'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Selector "${selector}" found ${elements.length} elements:`);
        elements.forEach((el, index) => {
          console.log(`  ${index + 1}. "${el.textContent?.trim()}" (${el.tagName.toLowerCase()}.${el.className})`);
        });
      }
    });
  }
};

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

  public isSuccessfulSubmission(): boolean {
    switch (this.platform) {
      case 'leetcode':
        // Check for various success indicators with more selectors
        return !!(
          document.querySelector('.success-icon') ||
          document.querySelector('[data-e2e-locator="console-result"] .text-green-s') ||
          document.querySelector('.result-success') ||
          document.querySelector('[data-testid="success-icon"]') ||
          document.querySelector('.text-green-600') ||
          document.querySelector('.text-green-500') ||
          document.querySelector('[class*="text-green"]') ||
          document.querySelector('[class*="success"]') ||
          document.body.innerText.includes('Accepted') ||
          document.body.innerText.includes('Success') ||
          document.body.innerText.includes('Runtime:') ||
          document.body.innerText.includes('Memory:')
        );
      case 'codeforces':
        return !!(
          document.body.innerText.includes('Accepted') ||
          document.querySelector('.verdict-accepted') ||
          document.querySelector('.accepted') ||
          document.querySelector('[class*="accepted"]')
        );
      case 'codechef':
        return !!(
          document.body.innerText.includes('Success') ||
          document.body.innerText.includes('Accepted') ||
          document.querySelector('.result-success') ||
          document.querySelector('[class*="success"]')
        );
      default:
        return false;
    }
  }

  public extractSubmissionData(): SubmissionData {
    console.log(`[PushUp] Extracting submission data for ${this.platform}`);
    let data: Partial<SubmissionData> = { platform: this.platform };

    try {
      switch (this.platform) {
        case 'leetcode':
          data = {
            ...data,
            problemId: this.extractLeetCodeProblemId(),
            code: this.extractLeetCodeCode(),
            language: this.extractLeetCodeLanguage(),
            difficulty: this.extractLeetCodeDifficulty(),
            title: this.extractLeetCodeTitle(),
          };
          break;
        case 'codeforces':
          data = {
            ...data,
            problemId: this.extractCodeforceProblemId(),
            code: this.extractCodeforceCode(),
            language: this.extractCodeforceLanguage(),
            title: this.extractCodeforceTitle(),
          };
          break;
        case 'codechef':
          data = {
            ...data,
            problemId: this.extractCodechefProblemId(),
            code: this.extractCodechefCode(),
            language: this.extractCodechefLanguage(),
            title: this.extractCodechefTitle(),
          };
          break;
      }
    } catch (error) {
      console.error(`[PushUp] Error extracting ${this.platform} data:`, error);
      // Still try to send partial data with fallbacks
      data.problemId = data.problemId || `unknown-${Date.now()}`;
      data.code = data.code || '// Code extraction failed';
      data.language = data.language || 'unknown';
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
      console.log('[PushUp DEBUG] Attempting to extract LeetCode problem title...');
      console.log('[PushUp DEBUG] Current URL:', window.location.href);
      
      // Try multiple selectors for problem title (expanded list for 2024/2025 LeetCode)
      const titleSelectors = [
        // Modern LeetCode selectors (2024/2025)
        '[data-cy="question-title"]',
        'h1[class*="text-title-large"]',
        'div[class*="text-title-large"]',
        '.text-title-large',
        'h1[class*="text-label-1"]',
        'div[class*="text-label-1"]',
        '.text-label-1',
        'h1[class*="font-medium"]',
        'div[class*="font-medium"]',
        // CSS class patterns from modern LeetCode
        'h1[class*="mr-2"]',
        'div[class*="mr-2"]',
        '[class*="question-title"]',
        '[class*="problem-title"]',
        // Tailwind-based selectors
        '.text-lg.font-medium',
        '.text-xl.font-medium',
        '.text-2xl.font-medium',
        // Legacy selectors
        '.title-text',
        '.css-v3d350',
        'h1[class*="text"]',
        '.question-title',
        // Generic fallbacks
        'h1',
        '.title',
        '[role="heading"]'
      ];
      
      let title = null;
      for (const selector of titleSelectors) {
        try {
          const element = document.querySelector(selector);
          console.log(`[PushUp DEBUG] Trying selector "${selector}":`, element?.textContent?.trim() || 'No content');
          if (element?.textContent?.trim()) {
            title = element.textContent.trim();
            console.log(`[PushUp DEBUG] Found title with selector "${selector}": "${title}"`);
            break;
          }
        } catch (e) {
          console.log(`[PushUp DEBUG] Selector "${selector}" failed:`, e);
        }
      }
      
      // Fallback: extract from URL
      if (!title) {
        console.log('[PushUp DEBUG] No title found with selectors, trying URL extraction...');
        const urlMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
        if (urlMatch) {
          title = urlMatch[1].replace(/-/g, ' ');
          console.log('[PushUp DEBUG] Extracted title from URL:', title);
        }
      }
      
      // Additional fallback: try to get page title
      if (!title && document.title) {
        console.log('[PushUp DEBUG] Trying document title:', document.title);
        const titleMatch = document.title.match(/^([^-]+)/);
        if (titleMatch) {
          title = titleMatch[1].trim();
          console.log('[PushUp DEBUG] Extracted from document title:', title);
        }
      }
      
      // Last resort: use current timestamp
      if (!title) {
        console.log('[PushUp DEBUG] All extraction methods failed, using fallback');
        title = `leetcode-problem-${Date.now()}`;
      }
      
      console.log('[PushUp DEBUG] Final extracted title:', title);
      const problemId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      console.log('[PushUp DEBUG] Final problem ID:', problemId);
      
      return problemId;
    } catch (error) {
      console.error('[PushUp] Failed to extract LeetCode problem ID:', error);
      throw error;
    }
  }

  private extractLeetCodeCode(): string {
    try {
      // Try multiple ways to get the code
      let code = '';
      
      // Method 1: Monaco editor
      const editor = document.querySelector('.monaco-editor');
      if (editor) {
        const codeElement = editor.querySelector('.view-lines');
        if (codeElement?.textContent) {
          code = codeElement.textContent.trim();
        }
      }
      
      // Method 2: CodeMirror editor (fallback)
      if (!code) {
        const codeMirror = document.querySelector('.CodeMirror-code');
        if (codeMirror?.textContent) {
          code = codeMirror.textContent.trim();
        }
      }
      
      // Method 3: Textarea (fallback)
      if (!code) {
        const textarea = document.querySelector('textarea[data-mode]') as HTMLTextAreaElement;
        if (textarea?.value) {
          code = textarea.value.trim();
        }
      }
      
      if (!code) throw new Error('No code content found');
      
      return code;
    } catch (error) {
      console.error('[PushUp] Failed to extract LeetCode code:', error);
      throw error;
    }
  }

  private extractLeetCodeLanguage(): string {
    try {
      // Try multiple selectors for language
      const languageSelectors = [
        '.language-btn',
        'button[id*="headlessui-listbox-button"]',
        '[data-track-load="description_page"]',
        '.text-xs.font-medium.text-label-2',
        'button[class*="language"]',
        'select[name="lang"]'
      ];
      
      let language = '';
      for (const selector of languageSelectors) {
        const element = document.querySelector(selector);
        if (element?.textContent?.trim()) {
          language = element.textContent.trim();
          break;
        }
      }
      
      // Fallback: try to get from URL or page context
      if (!language) {
        const urlParams = new URLSearchParams(window.location.search);
        language = urlParams.get('lang') || 'javascript'; // default fallback
      }
      
      return language.toLowerCase();
    } catch (error) {
      console.error('[PushUp] Failed to extract LeetCode language:', error);
      throw error;
    }
  }

  private extractLeetCodeDifficulty(): 'easy' | 'medium' | 'hard' | undefined {
    try {
      const difficultyElement = document.querySelector('[diff]') || 
                               document.querySelector('.css-10o4wqw') ||
                               document.querySelector('[data-difficulty]');
      
      if (!difficultyElement) {
        // Try to find difficulty in text content
        const pageText = document.body.innerText.toLowerCase();
        if (pageText.includes('easy')) return 'easy';
        if (pageText.includes('medium')) return 'medium';
        if (pageText.includes('hard')) return 'hard';
        return undefined;
      }
      
      const diffText = difficultyElement.textContent?.toLowerCase();
      if (diffText?.includes('easy')) return 'easy';
      if (diffText?.includes('medium')) return 'medium';
      if (diffText?.includes('hard')) return 'hard';
      
      return undefined;
    } catch (error) {
      console.error('[PushUp] Failed to extract LeetCode difficulty:', error);
      return undefined;
    }
  }

  private extractLeetCodeTitle(): string | undefined {
    try {
      // Try multiple selectors for problem title
      const titleSelectors = [
        '.title-text',
        '[data-cy="question-title"]',
        '.css-v3d350',
        '.text-title-large',
        '.mr-2.text-label-1.dark\\:text-dark-label-1.font-medium',
        'h1[class*="text"]',
        '[class*="question-title"]',
        '.question-title',
        'h1'
      ];
      
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element?.textContent?.trim()) {
          return element.textContent.trim();
        }
      }
      
      return undefined;
    } catch (error) {
      console.error('[PushUp] Failed to extract LeetCode title:', error);
      return undefined;
    }
  }

  // Codeforces extractors
  private extractCodeforceProblemId(): string {
    try {
      const url = window.location.href;
      const match = url.match(/problem\/([A-Z0-9]+)/);
      if (match) return match[1].toLowerCase();
      
      // Fallback: try to get from title
      const title = document.querySelector('.title')?.textContent;
      return title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'unknown';
    } catch (error) {
      console.error('[PushUp] Failed to extract Codeforces problem ID:', error);
      return 'unknown';
    }
  }

  private extractCodeforceCode(): string {
    try {
      // Try multiple selectors for code editor
      const codeElement = document.querySelector('textarea[name="sourceCode"]') ||
                         document.querySelector('.CodeMirror-code') ||
                         document.querySelector('#program-source-text');
      
      if (!codeElement) throw new Error('Could not find code editor');
      
      const code = codeElement.textContent || (codeElement as HTMLTextAreaElement).value;
      if (!code) throw new Error('No code content found');
      
      return code.trim();
    } catch (error) {
      console.error('[PushUp] Failed to extract Codeforces code:', error);
      throw error;
    }
  }

  private extractCodeforceLanguage(): string {
    try {
      const langSelect = document.querySelector('select[name="programTypeId"]') as HTMLSelectElement;
      if (!langSelect) throw new Error('Could not find language selector');
      
      const selectedOption = langSelect.options[langSelect.selectedIndex];
      const language = selectedOption?.textContent;
      if (!language) throw new Error('No language selected');
      
      return language.toLowerCase();
    } catch (error) {
      console.error('[PushUp] Failed to extract Codeforces language:', error);
      throw error;
    }
  }

  private extractCodeforceTitle(): string | undefined {
    try {
      const titleElement = document.querySelector('.title') ||
                          document.querySelector('.problem-statement .title');
      return titleElement?.textContent?.trim();
    } catch (error) {
      console.error('[PushUp] Failed to extract Codeforces title:', error);
      return undefined;
    }
  }

  // CodeChef extractors
  private extractCodechefProblemId(): string {
    try {
      const url = window.location.href;
      const match = url.match(/problems\/([A-Z0-9]+)/);
      if (match) return match[1].toLowerCase();
      
      // Fallback: try to get from problem heading
      const title = document.querySelector('.problem-title')?.textContent;
      return title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'unknown';
    } catch (error) {
      console.error('[PushUp] Failed to extract CodeChef problem ID:', error);
      return 'unknown';
    }
  }

  private extractCodechefCode(): string {
    try {
      const codeElement = document.querySelector('#solution_code') ||
                         document.querySelector('.CodeMirror-code') ||
                         document.querySelector('textarea[name="code"]');
      
      if (!codeElement) throw new Error('Could not find code editor');
      
      const code = codeElement.textContent || (codeElement as HTMLTextAreaElement).value;
      if (!code) throw new Error('No code content found');
      
      return code.trim();
    } catch (error) {
      console.error('[PushUp] Failed to extract CodeChef code:', error);
      throw error;
    }
  }

  private extractCodechefLanguage(): string {
    try {
      const langSelect = document.querySelector('#language') as HTMLSelectElement;
      if (!langSelect) throw new Error('Could not find language selector');
      
      const selectedOption = langSelect.options[langSelect.selectedIndex];
      const language = selectedOption?.textContent;
      if (!language) throw new Error('No language selected');
      
      return language.toLowerCase();
    } catch (error) {
      console.error('[PushUp] Failed to extract CodeChef language:', error);
      throw error;
    }
  }

  private extractCodechefTitle(): string | undefined {
    try {
      const titleElement = document.querySelector('.problem-title') ||
                          document.querySelector('h1') ||
                          document.querySelector('.title');
      return titleElement?.textContent?.trim();
    } catch (error) {
      console.error('[PushUp] Failed to extract CodeChef title:', error);
      return undefined;
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
  const detector = new SubmissionDetector();
  // Store reference for debugging
  (window as unknown as { PushUpDebug: PushUpDebug }).PushUpDebug.detector = detector;
  console.log('[PushUp] Submission detector initialized successfully');
} catch (error) {
  console.error('[PushUp] Failed to initialize submission detector:', error);
}