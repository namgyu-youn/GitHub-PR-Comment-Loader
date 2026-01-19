// GitHub PR Comment Loader - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('enableToggle');
  const prPageDot = document.getElementById('prPageDot');
  const prPageStatus = document.getElementById('prPageStatus');
  const buttonDot = document.getElementById('buttonDot');
  const buttonStatus = document.getElementById('buttonStatus');

  // Load saved state
  const { enabled } = await chrome.storage.sync.get(['enabled']);
  toggle.checked = enabled !== false; // Default to enabled

  // Get current tab status
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url && tab.url.includes('github.com')) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'getStatus' });
      
      if (response) {
        // Update PR page status
        if (response.isPRPage) {
          prPageDot.classList.add('active');
          prPageStatus.textContent = 'On PR conversation page';
        } else {
          prPageDot.classList.add('inactive');
          prPageStatus.textContent = 'Not on PR conversation';
        }

        // Update button status
        if (response.buttonCount > 0) {
          buttonDot.classList.add('active');
          buttonStatus.textContent = `${response.buttonCount} "Load more" button(s) found`;
        } else {
          buttonDot.classList.remove('active', 'inactive');
          buttonStatus.textContent = 'No hidden comments';
        }
      }
    } else {
      prPageDot.classList.add('inactive');
      prPageStatus.textContent = 'Not on GitHub';
      buttonDot.classList.remove('active', 'inactive');
      buttonStatus.textContent = 'N/A';
    }
  } catch (error) {
    // Content script might not be loaded
    prPageDot.classList.add('inactive');
    prPageStatus.textContent = 'Not on GitHub PR page';
    buttonDot.classList.remove('active', 'inactive');
    buttonStatus.textContent = 'N/A';
  }

  // Handle toggle change
  toggle.addEventListener('change', async () => {
    const enabled = toggle.checked;
    
    // Save state
    await chrome.storage.sync.set({ enabled });

    // Notify content script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.includes('github.com')) {
        await chrome.tabs.sendMessage(tab.id, { type: 'toggleEnabled', enabled });
      }
    } catch (error) {
      // Content script might not be loaded, that's okay
    }
  });
});
