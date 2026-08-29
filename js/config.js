/**
 * Application Configuration / Environment Variables
 * Use this file to enable or disable features across the app.
 * Since this is a 100% client-side app, we use a global JS object instead of a hidden .env file.
 */
window.ENV = {
  // Set to true to enable the feature, false to hide it from the UI.
  ENABLE_MERGE: false,
  ENABLE_SPLIT: false,
  ENABLE_ORGANIZE: false,
  ENABLE_CONVERT: false,
  ENABLE_WATERMARK: false,
  ENABLE_SECURITY: false
};
