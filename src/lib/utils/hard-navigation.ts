// Full page loads drop client state (query cache, session); tests mock this module.
export function hardReplace(url: string): void {
  window.location.replace(url);
}

export function hardReload(): void {
  window.location.reload();
}
