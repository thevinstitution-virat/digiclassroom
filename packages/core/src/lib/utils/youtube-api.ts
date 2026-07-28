// Singleton loader for YouTube IFrame API
// Ensures the script is only added to the DOM once.

let apiPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise((resolve, reject) => {
    // If the API is already loaded
    if (typeof window !== 'undefined' && (window as any).YT && (window as any).YT.Player) {
      resolve();
      return;
    }

    // Set up the callback that the YouTube script will call
    (window as any).onYouTubeIframeAPIReady = () => {
      resolve();
    };

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });

  return apiPromise;
}
