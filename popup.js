const buttonContainer = document.getElementById('buttonContainer');
const tabQuery = { active: true, currentWindow: true };

// Function to handle the start process
function startCapture(tabId) {
    // 1. Inject content.js manually into the tab (guarantees listener exists)
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js'] 
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Script injection failed: " + chrome.runtime.lastError.message);
            window.close();
            return;
        }

        // 2. Send START message
        chrome.tabs.sendMessage(tabId, { action: "START_CAPTURE" }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error sending START message: " + chrome.runtime.lastError.message);
            }
            window.close(); // Close after sending
        });
    });
}

function pauseCapture(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "PAUSE_CAPTURE" }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error sending PAUSE message: " + chrome.runtime.lastError.message);
    }
    window.close();
  });
}

function resumeCapture(tabId) {
  chrome.tabs.sendMessage(tabId, { action: "RESUME_CAPTURE" }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error sending RESUME message: " + chrome.runtime.lastError.message);
    }
    window.close();
  });
}

// Function to handle the stop process
function stopCapture(tabId) {
    // Send STOP message
    chrome.tabs.sendMessage(tabId, { action: "STOP_CAPTURE" }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("Error sending STOP message: " + chrome.runtime.lastError.message);
        } else if (response && response.status === "capture_stopped") {
            console.log("Capture Stopped");
        }
        window.close(); // Close after sending
    });
}

// Function to render the correct button based on state
function renderButtons(tabId, status) {
  buttonContainer.innerHTML = '';

  const createBtn = (id, text, handler, color) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.classList.add('btn');
    btn.textContent = text;
    btn.style.backgroundColor = color;
    btn.addEventListener('click', handler);
    return btn;
  };

 if (!status.isCapturing && !status.isPaused) {
  // Default state
  buttonContainer.appendChild(createBtn('startButton', 'Start Capturing', () => startCapture(tabId), '#4CAF50'));

} else if (status.isPaused) {
  // Paused -> show Resume + Stop
  buttonContainer.appendChild(createBtn('resumeButton', 'Resume Capturing', () => resumeCapture(tabId), '#2196F3'));
  buttonContainer.appendChild(document.createElement('br'));
  buttonContainer.appendChild(createBtn('stopButton', 'Stop & Download', () => stopCapture(tabId), '#f44336'));

} else if (status.isCapturing) {
  // Capturing -> show Pause + Stop
  buttonContainer.appendChild(createBtn('pauseButton', 'Pause Capturing', () => pauseCapture(tabId), '#ff9800'));
  buttonContainer.appendChild(document.createElement('br'));
  buttonContainer.appendChild(createBtn('stopButton', 'Stop & Download', () => stopCapture(tabId), '#f44336'));
}

}

// Main function to check state on popup open
chrome.tabs.query(tabQuery, (tabs) => {
  if (tabs.length === 0) return;
  const tabId = tabs[0].id;

  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      buttonContainer.textContent = "Error: Cannot access this page.";
      return;
    }

    chrome.tabs.sendMessage(tabId, { action: "GET_STATUS" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        renderButtons(tabId, { isCapturing: false, isPaused: false });
        return;
      }
      renderButtons(tabId, response);
    });
  });
});