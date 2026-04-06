/**
 * Primansh Growth Intelligence - Client Tracking Snippet
 * Version: 1.0.0
 */
(function() {
  const script = document.currentScript;
  const tid = script.getAttribute('data-id');
  if (!tid) {
    console.warn('[Primansh] Tracking initialized without data-id. Events will not be recorded.');
    return;
  }

  // Use the project's Supabase Edge Function endpoint
  // Replace with environment-provided URL if available, or static for this build
  const endpoint = 'https://tpeskbbvrfebtjiituwi.supabase.co/functions/v1/collect-analytics';

  function track() {
    try {
      const data = {
        tracking_id: tid,
        event: 'pageview',
        path: window.location.pathname,
        title: document.title,
        referrer: document.referrer,
        cid: getClientId(),
        dt: getDeviceType(),
        br: getBrowser(),
        ua: navigator.userAgent
      };

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        mode: 'cors',
        credentials: 'omit'
      }).catch(err => {
        // Silent fail to avoid affecting client website
      });
    } catch (e) {
      // Final fallback
    }
  }

  function getClientId() {
    try {
      let id = localStorage.getItem('_p_cid');
      if (!id) {
        id = 'c_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        localStorage.setItem('_p_cid', id);
      }
      return id;
    } catch (e) {
      return 'anon_' + Math.random().toString(36).substring(2, 5);
    }
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "tablet";
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "mobile";
    return "desktop";
  }

  function getBrowser() {
    const ua = navigator.userAgent;
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    if (ua.indexOf("SamsungBrowser") > -1) return "Samsung Browser";
    if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) return "Opera";
    if (ua.indexOf("Trident") > -1) return "IE";
    if (ua.indexOf("Edge") > -1) return "Edge";
    if (ua.indexOf("Chrome") > -1) return "Chrome";
    if (ua.indexOf("Safari") > -1) return "Safari";
    return "Unknown";
  }

  // Run on load
  if (document.readyState === 'complete') {
    track();
  } else {
    window.addEventListener('load', track);
  }

  // Push state tracking (SPA support)
  let lastPath = window.location.pathname;
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      track();
    }
  });
  observer.observe(document.querySelector('body'), { childList: true, subtree: true });
  
})();
