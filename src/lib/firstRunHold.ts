type Listener = () => void;

const listeners = new Set<Listener>();
let birthdayModalOpen = false;

export function setBirthdayModalOpen(open: boolean): void {
  if (birthdayModalOpen === open) return;
  birthdayModalOpen = open;
  listeners.forEach((fn) => fn());
}

export function isBirthdayModalOpen(): boolean {
  return birthdayModalOpen;
}

export function subscribeBirthdayModal(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
