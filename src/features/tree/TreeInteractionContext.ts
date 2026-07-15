import { createContext, useContext } from 'react';
import type { RelationKind } from '../../types/family';

/**
 * Lets the custom React Flow nodes talk back to the tree page (open details,
 * collapse branches, quick-add relatives) and read edit mode — without
 * stuffing callbacks into every node's data object.
 */
export interface TreeInteraction {
  onOpen: (personId: string) => void;
  onToggleCollapse: (anchorId: string) => void;
  /** Open the add-person form pre-linked to this relative. */
  onQuickAdd: (kind: RelationKind, personId: string) => void;
  editMode: boolean;
}

export const TreeInteractionContext = createContext<TreeInteraction>({
  onOpen: () => {},
  onToggleCollapse: () => {},
  onQuickAdd: () => {},
  editMode: false,
});

export function useTreeInteraction(): TreeInteraction {
  return useContext(TreeInteractionContext);
}
