// GitHub PR Comment Loader - Content Script
// Automatically clicks "Load more" buttons in PR conversations

(function () {
  'use strict';

  const BUTTON_SELECTOR = 'button.ajax-pagination-btn';
  const CLICK_DELAY = 300; // ms between clicks to avoid rate limiting
  const OBSERVE_DELAY = 500; // ms to wait before observing after page load

  let isEnabled = true;
  let observer = null;
  let isProcessing = false;

  // Check if current page is a PR conversation tab
  function isPRConversationPage() {
    const url = window.location.href;
    // Match PR pages but exclude /files, /commits, /checks tabs
    const isPR = /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(url);
    const isConversation = !url.includes('/files') && 
                           !url.includes('/commits') && 
                           !url.includes('/checks');
    return isPR && isConversation;
  }

  // Click all visible "Load more" buttons
  async function clickLoadMoreButtons() {
    if (!isEnabled || isProcessing) return;
    
    isProcessing = true;
    const buttons = document.querySelectorAll(BUTTON_SELECTOR);
    
    for (const button of buttons) {
      if (!isEnabled) break;
      
      // Check if button is visible and not already loading
      if (button.offsetParent !== null && !button.disabled) {
        button.click();
        // Wait a bit between clicks to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, CLICK_DELAY));
      }
    }
    
    isProcessing = false;
  }

  // Set up MutationObserver to detect new "Load more" buttons
  function setupObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      if (!isEnabled) return;
      
      // Check if any new "Load more" buttons were added
      let hasNewButtons = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches?.(BUTTON_SELECTOR) || 
                  node.querySelector?.(BUTTON_SELECTOR)) {
                hasNewButtons = true;
                break;
              }
            }
          }
        }
        if (hasNewButtons) break;
      }
      
      if (hasNewButtons) {
        // Debounce: wait a bit before clicking to let DOM settle
        setTimeout(clickLoadMoreButtons, CLICK_DELAY);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Initialize the extension
  function init() {
    if (!isPRConversationPage()) return;

    // Load saved state
    chrome.storage.sync.get(['enabled'], (result) => {
      isEnabled = result.enabled !== false; // Default to enabled
      
      if (isEnabled) {
        // Initial click after page load
        setTimeout(() => {
          clickLoadMoreButtons();
          setupObserver();
        }, OBSERVE_DELAY);
      }
    });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'toggleEnabled') {
      isEnabled = message.enabled;
      
      if (isEnabled && isPRConversationPage()) {
        clickLoadMoreButtons();
        setupObserver();
      } else if (observer) {
        observer.disconnect();
        observer = null;
      }
      
      sendResponse({ success: true });
    } else if (message.type === 'getStatus') {
      sendResponse({ 
        enabled: isEnabled,
        isPRPage: isPRConversationPage(),
        buttonCount: document.querySelectorAll(BUTTON_SELECTOR).length
      });
    }
    
    return true; // Keep message channel open for async response
  });

  // Handle GitHub's SPA navigation (turbo/pjax)
  document.addEventListener('turbo:load', init);
  document.addEventListener('pjax:end', init);
  
  // Also handle popstate for browser back/forward
  window.addEventListener('popstate', () => {
    setTimeout(init, OBSERVE_DELAY);
  });

  // Initial run
  init();
})();
