// Documentation Page Interactive Controller

let currentFramework: 'react' | 'angular' | 'vue' | 'vanilla' = 'react';

// Theme toggling matching demo
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement | null;
const savedTheme = localStorage.getItem('fp_theme') || 'light';
if (savedTheme === 'dark') {
  document.body.classList.add('theme-dark');
  if (themeToggle) themeToggle.textContent = '☀️';
} else {
  if (themeToggle) themeToggle.textContent = '🌙';
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('theme-dark');
    const isDark = document.body.classList.contains('theme-dark');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('fp_theme', isDark ? 'dark' : 'light');
  });
}

// Global Framework Switcher
function setFramework(fw: 'react' | 'angular' | 'vue' | 'vanilla') {
  currentFramework = fw;
  document.querySelectorAll('.framework-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-framework') === fw);
  });

  // Switch all code blocks matching data-framework
  document.querySelectorAll<HTMLElement>('.framework-code').forEach(el => {
    const targetFw = el.getAttribute('data-framework');
    el.style.display = targetFw === fw ? 'block' : 'none';
  });
}

// Initialize framework pills
document.querySelectorAll('.framework-pill').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const fw = (target.getAttribute('data-framework') as any) || 'react';
    setFramework(fw);
  });
});

// Real-time Property & Section Search / Filter
const searchInput = document.getElementById('docs-search-input') as HTMLInputElement | null;
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    const propCards = document.querySelectorAll<HTMLElement>('.prop-card');
    const navItems = document.querySelectorAll<HTMLElement>('.docs-nav-item');

    propCards.forEach(card => {
      const text = card.textContent?.toLowerCase() || '';
      const matches = !query || text.includes(query);
      card.style.display = matches ? 'block' : 'none';
    });

    navItems.forEach(item => {
      const text = item.textContent?.toLowerCase() || '';
      const matches = !query || text.includes(query);
      item.style.display = matches ? 'flex' : 'none';
    });
  });
}

// 1-Click Copy Buttons
document.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const pre = btn.closest('.code-box')?.querySelector('pre');
    const code = pre?.textContent || '';
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '✓ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  });
});

// Scrollspy for sidebar navigation
const contentArea = document.querySelector('.docs-content-area');
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.docs-nav-item');

if (contentArea) {
  contentArea.addEventListener('scroll', () => {
    const headings = document.querySelectorAll<HTMLElement>('h2[id], h3[id], .prop-card[id]');
    let currentId = '';

    headings.forEach(h => {
      const rect = h.getBoundingClientRect();
      if (rect.top <= 140) {
        currentId = h.id;
      }
    });

    if (currentId) {
      navLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        link.classList.toggle('active', href === `#${currentId}`);
      });
    }
  });
}

// Smooth hash scrolling inside .docs-content-area
function scrollToHash(hash?: string) {
  const targetId = (hash || window.location.hash || '').replace(/^#/, '');
  if (!targetId) return;

  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Visual pulse effect
    targetEl.classList.add('highlight-target');
    setTimeout(() => {
      targetEl.classList.remove('highlight-target');
    }, 2000);

    // Update active nav item
    navLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      link.classList.toggle('active', href === `#${targetId}`);
    });
  }
}

// Intercept all anchor clicks with hash hrefs to guarantee smooth scrolling inside .docs-content-area
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const href = anchor.getAttribute('href');
    if (!href || href === '#') return;
    const targetId = href.replace(/^#/, '');
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      e.preventDefault();
      history.pushState(null, '', href);
      scrollToHash(href);
    }
  });
});

// Handle initial hash on page load
window.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash) {
    setTimeout(() => scrollToHash(window.location.hash), 80);
  }
});

if (window.location.hash) {
  setTimeout(() => scrollToHash(window.location.hash), 120);
}

// When URL hash changes (e.g. browser forward/back or external deep link)
window.addEventListener('hashchange', () => {
  scrollToHash(window.location.hash);
});

// Set initial framework
setFramework('react');
