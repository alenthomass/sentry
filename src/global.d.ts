/* Sentry · Globals: window.claude exists only when the app runs as a claude.ai artifact. */
interface Window {
  claude?: { use(capability: string): Promise<any> };
}
