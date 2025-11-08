// --- Prevent multiple injections ---
if (!window.__locatorCaptureInjected__) {
  window.__locatorCaptureInjected__ = true;

  console.log("Locator Capture content script injected.");

  let isCapturing = false;
  let isPaused = false;
  let capturedLocators = [];

  // --- Helper Function: Check Uniqueness in the DOM ---
  function isUnique(type, locatorValue) {
    try {
      let elements;
      switch (type.toLowerCase()) {
        case 'id':
          elements = document.querySelectorAll(`#${CSS.escape(locatorValue)}`);
          return elements.length === 1;

        case 'name':
          elements = document.querySelectorAll(`[name="${CSS.escape(locatorValue)}"]`);
          return elements.length === 1;

        case 'classname':
        case 'class':
          elements = document.getElementsByClassName(locatorValue);
          return elements.length === 1;

        case 'tagname':
        case 'tag':
          elements = document.getElementsByTagName(locatorValue);
          return elements.length === 1;

        case 'css':
          elements = document.querySelectorAll(locatorValue);
          return elements.length === 1;

        case 'xpath':
        default:
          const xpathResult = document.evaluate(locatorValue, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          return xpathResult.snapshotLength === 1;
      }
    } catch (e) {
      //console.error(`Invalid selector (${type}): ${locatorValue}`, e);
      return false;
    }
  }

  // --- Helper Function: Determine Friendly Element Type ---
  function getElementType(element) {
    const tag = element.tagName.toLowerCase();
    const type = element.type ? element.type.toLowerCase() : '';

    if (tag === 'input') {
      if (['text', 'password', 'email', 'search', 'tel', 'url'].includes(type)) return 'Textfield';
      if (['submit', 'button', 'reset'].includes(type)) return 'Button';
      if (type === 'checkbox') return 'Checkbox';
      if (type === 'radio') return 'Radio Button';
      if (type === 'file') return 'File Input';
      if (type === 'hidden') return 'Hidden Input';
    }
    if (tag === 'textarea') return 'Textarea';
    if (tag === 'select') return 'Dropdown';
    if (tag === 'button') return 'Button';
    if (tag === 'a') return 'Link';
    if (tag.match(/^h[1-6]$/)) return 'Heading';
    if (tag === 'img') return 'Image';
    if (['p', 'span', 'div'].includes(tag)) return 'Text/Container';
    
    return tag;
  }

  // --- Helper Function: Get Display Name ---
  function getDisplayName(element) {
    const immediateText = (element.textContent || '').trim();
    if (immediateText.length > 0 && immediateText.length < 50) return immediateText;
    if (element.placeholder) return element.placeholder;
    if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');
    if (element.title) return element.title;
    if (element.id) {
      const label = document.querySelector(`label[for='${element.id}']`);
      if (label && label.textContent) return label.textContent.trim();
    }
    return 'N/A';
  }

  // --- Helper Function: Generates a reliable, relative XPath ---
  function getRelativeXPath(element) {
    if (element.id) return `//${element.tagName.toLowerCase()}[@id='${element.id}']`;
    if (element.name) return `//${element.tagName.toLowerCase()}[@name='${element.name}']`;

    let path = '';
    while (element && element.tagName && element.tagName.toLowerCase() !== 'body') {
      let index = 1;
      let sibling = element.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === element.tagName) index++;
        sibling = sibling.previousElementSibling;
      }
      const currentSegment = element.tagName.toLowerCase();
      const segmentWithIndex = index > 1 ? `${currentSegment}[${index}]` : currentSegment;
      path = '/' + segmentWithIndex + path;
      element = element.parentElement;
    }
    return '//body' + path;
  }

  // --- Core Function: Generate All Unique Locators ---
  function generateLocator(element) {
    const data = {
      elementName: getDisplayName(element),
      elementType: getElementType(element),
      uniqueLocators: []
    };

    let potentialLocators = [];

    if (element.tagName) potentialLocators.push({ type: 'tagName', value: element.tagName });
    if (element.id) potentialLocators.push({ type: 'id', value: element.id });
    if (element.name) potentialLocators.push({ type: 'name', value: element.name });

    if (element.className) {
      const classes = element.className.trim().split(/\s+/).filter(cls => cls.length > 0);
      console.log(element.className);
      if (classes.length == 1 && classes[0] !="locator-highlight") 
      {
        console.log(classes[0]);
        potentialLocators.push({ type: 'class', value: element.className });
      }   
    }

    const attrs=element.getAttributeNames();
    const removeList = ["id", "class","name"];
    const filteredAttrs = attrs.filter(attr => !removeList.includes(attr));

    if(filteredAttrs > 0)
    {
      filteredAttrs.forEach(attributeName => {
          let locVal=element.tagName+"["+attributeName+"='"+element.getAttribute(attributeName)+"']";
          potentialLocators.push({ type: 'css', value: locVal });
      });
    }
    if(filteredAttrs > 0)
    {
      filteredAttrs.forEach(attributeName => {
          let locVal="//"+element.tagName+"[@"+attributeName+"='"+element.getAttribute(attributeName)+"']";
          potentialLocators.push({ type: 'xpath', value: locVal });
      });
    }


    const textContent = (element.textContent || '').trim();
    if (textContent.length > 0) {
      let textVal="//"+element.tagName+"[normalize-space(.)='"+element.textContent.trim()+"']";
      potentialLocators.push({ type: 'xpath', value: textVal });
    }

    const relativeXPath = getRelativeXPath(element);
    
    potentialLocators.forEach(locator => {
      if (isUnique(locator.type, locator.value)) {
        data.uniqueLocators.push(locator);
      }
    });

    if (data.uniqueLocators.length === 0) {
      data.uniqueLocators.push({
        type: 'xpath',
        value: relativeXPath
      });
    }

    return data;
  }

  // --- Event Handlers ---
  function highlightElement(event) {
    if (!isCapturing || isPaused) return;
    document.querySelectorAll('.locator-highlight').forEach(el => {
      el.style.outline = 'none';
      el.classList.remove('locator-highlight');
    });
    const element = event.target;
    element.style.outline = '2px solid blue';
    element.style.outlineOffset = '-2px';
    element.classList.add('locator-highlight');
  }

  function captureLocator(event) {
    if (!isCapturing || isPaused) return;
    event.preventDefault();
    event.stopPropagation();

    const element = event.target;
    let locatorData = generateLocator(element);
    capturedLocators.push(locatorData);

    element.style.outline = '3px solid green';
    setTimeout(() => {
      if (isCapturing && !isPaused) element.style.outline = '2px solid blue';
      else element.style.outline = 'none';
    }, 200);

    console.log('Locator captured:', locatorData);
  }

  // --- Session Management ---
  function downloadLocators() {
    if (capturedLocators.length === 0) {
      alert("No locators were captured in this session.");
      return;
    }

    const json = JSON.stringify(capturedLocators, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `locators_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    capturedLocators = [];
  }

  function stopCapturing() {
    isCapturing = false;
    isPaused=false;
    document.removeEventListener('mouseover', highlightElement);
    document.removeEventListener('click', captureLocator, true);
    document.querySelectorAll('.locator-highlight').forEach(el => {
      el.style.outline = 'none';
      el.style.outlineOffset = '0';
      el.classList.remove('locator-highlight');
    });
    downloadLocators();
    console.log('Capture stopped and download initiated.');
  }

  // --- Message Listener for Popup Communication ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case "START_CAPTURE":
        if (!isCapturing) {
          isCapturing = true;
          isPaused = false;
          document.addEventListener('mouseover', highlightElement);
          document.addEventListener('click', captureLocator, true);
          console.log('Capture started.');
        }
        sendResponse({ isCapturing, isPaused });
        break;

      case "PAUSE_CAPTURE":
        if (isCapturing) {
          isPaused = true;
          console.log('Capture paused.');
        }
        sendResponse({ isCapturing, isPaused });
        break;

      case "RESUME_CAPTURE":
        if (isCapturing && isPaused) {
          isPaused = false;
          console.log('Capture resumed.');
        }
        sendResponse({ isCapturing, isPaused });
        break;

      case "STOP_CAPTURE":
        if (isCapturing) stopCapturing();
        sendResponse({ isCapturing: false, isPaused: false });
        break;

      case "GET_STATUS":
        sendResponse({ isCapturing, isPaused });
        break;
    }
    return true;
  });
}
