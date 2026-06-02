class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.style = {
      cssText: "",
      setProperty(name, value) {
        this[name] = value;
      },
    };
    this._textContent = "";
    this.disabled = false;
    this.scrollHeight = 120;
    this.rect = { width: 0, height: 0, left: 0, right: 0 };
    this.computedStyle = {};
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  addEventListener() {}

  closest() {
    return null;
  }

  cloneNode(deep = false) {
    const clone = new FakeElement(this.tagName);
    clone._textContent = this._textContent;
    clone.disabled = this.disabled;
    clone.scrollHeight = this.scrollHeight;
    clone.rect = { ...this.rect };
    clone.computedStyle = { ...this.computedStyle };
    clone.style.cssText = this.style.cssText;
    clone.style.setProperty = this.style.setProperty;
    for (const [name, value] of this.attributes.entries()) clone.attributes.set(name, value);
    if (deep) {
      for (const child of this.children) clone.appendChild(child.cloneNode(true));
    }
    return clone;
  }

  getBoundingClientRect() {
    return this.rect;
  }

  querySelectorAll(selector) {
    const results = [];
    const matches = (element) => {
      if (selector === "button[aria-expanded]") {
        return element.tagName === "BUTTON" && element.attributes.has("aria-expanded");
      }
      if (selector === "[data-accounts-chevron]") {
        return element.attributes.has("data-accounts-chevron");
      }
      if (selector === "[data-codexpp-account-usage]") {
        return element.attributes.has("data-codexpp-account-usage");
      }
      if (selector === "[data-codexpp-account-plan]") {
        return element.attributes.has("data-codexpp-account-plan");
      }
      if (selector === "[data-codexpp-account-current]") {
        return element.attributes.has("data-codexpp-account-current");
      }
      if (selector === "[data-codexpp-account-switcher-body]") {
        return element.attributes.has("data-codexpp-account-switcher-body");
      }
      if (selector === "[data-codexpp-accounts-icon]") {
        return element.attributes.has("data-codexpp-accounts-icon");
      }
      if (selector === "[data-codexpp-accounts-chevron-fallback]") {
        return element.attributes.has("data-codexpp-accounts-chevron-fallback");
      }
      if (selector === "path") {
        return element.tagName === "PATH";
      }
      if (selector === "svg") {
        return element.tagName === "SVG";
      }
      if (selector === "button") {
        return element.tagName === "BUTTON";
      }
      return false;
    };
    const walk = (element) => {
      for (const child of element.children) {
        if (matches(child)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function withFakeDom(fn) {
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalHTMLElement = global.HTMLElement;
  global.HTMLElement = FakeElement;
  const fakeDocument = {
    queryItems: [],
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createElementNS(_namespace, tagName) {
      return new FakeElement(tagName);
    },
    querySelectorAll() {
      return this.queryItems;
    },
  };
  global.document = fakeDocument;
  global.window = {
    getComputedStyle(element) {
      return {
        color: "",
        cursor: "",
        opacity: "1",
        paddingRight: "0px",
        ...element.computedStyle,
      };
    },
    matchMedia() {
      return { matches: false };
    },
    setTimeout() {},
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {},
  };

  try {
    fn(fakeDocument);
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
    global.HTMLElement = originalHTMLElement;
  }
}

module.exports = { FakeElement, withFakeDom };
