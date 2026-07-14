import { createContext, useContext } from 'react';
import type { RelationKind } from '../../types/family';

/** How a person relates to the currently selected person, for card styling. */
export type SelectionRole =
  | 'selected'
  | 'ancestor'
  | 'descendant'
  | 'spouse'
  | 'unrelated'
  | 'none';

/**
 * Lets the custom React Flow nodes talk back to the tree page (open details,
 * collapse branches, quick-add relatives) and read display state (selection
 * highlight, edit mode) without stuffing callbacks into every node's data.
 */
export interface TreeInteraction {
  onOpen: (personId: string) => void;
  onToggleCollapse: (anchorId: string) => void;
  /** Open the add-person form pre-linked to this relative. */
  onQuickAdd: (kind: RelationKind, personId: string) => void;
  editMode: boolean;
  /** The selected person, or null when nothing is selected. */
  selectedId: string | null;
  /** Role of a given person relative to the selection (drives ring + dimming). */
  roleOf: (personId: string) => SelectionRole;
}

export const TreeInteractionContext = createContext<TreeInteraction>({
  onOpen: () => {},
  onToggleCollapse: () => {},
  onQuickAdd: () => {},
  editMode: false,
  selectedId: null,
  roleOf: () => 'none',
});

export function useTreeInteraction(): TreeInteraction {
  return useContext(TreeInteractionContext);
}
