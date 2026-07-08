// 1. Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// 2. Inject Offline Banner HTML dynamically
const offlineBanner = document.createElement('div');
offlineBanner.id = 'offline-banner';
offlineBanner.innerHTML = '<i class="fa-solid fa-wifi" style="text-decoration: line-through; margin-right: 8px;"></i> You are currently offline. Please connect to the internet to access live features.';
offlineBanner.style.cssText = 'position: fixed; top: -60px; left: 0; width: 100%; background: #ef4444; color: #fff; text-align: center; padding: 12px; z-index: 99999; font-weight: 600; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);';
document.body.appendChild(offlineBanner);

function updateOnlineStatus() {
    if (!navigator.onLine) {
        // Slide down
        offlineBanner.style.transform = 'translateY(60px)';
    } else {
        // Slide back up
        offlineBanner.style.transform = 'translateY(0)';
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Check initial status
if (!navigator.onLine) {
    // Wait a tick for DOM to render
    setTimeout(updateOnlineStatus, 100);
}
