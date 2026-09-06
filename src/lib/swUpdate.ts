export const SW_UPDATE_EVENT = 'familytree:sw-update';

export function notifyAppUpdateReady(): void {
  window.dispatchEvent(new Event(SW_UPDATE_EVENT));
}
