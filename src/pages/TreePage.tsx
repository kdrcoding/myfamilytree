import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Edge, EdgeTypes, Node, NodeTypes, ReactFlowInstance } from '@xyflow/react';
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Image as ImageIcon,
  Link as LinkIcon,
  Crosshair,
  Lock,
  LockOpen,
  LogOut,
  Map,
  Maximize,
  MoreHorizontal,
  RotateCcw,
  Rows3,
  Columns3,
  Scan,
  Search,
  TreePine,
  UserPlus,
  UserRoundPlus,
  X,
} from 'lucide-react';
import type { FamilyPerson, RelationLink } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useFamily } from '../context/FamilyContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { useT } from '../i18n/useT';
import { STORAGE_KEYS } from '../utils/storage';
import { getAncestorIds, getDescendantIds, fullName } from '../utils/family';
import { matchesSearch } from '../utils/filters';
import { MadeByKadir } from '../components/MadeByKadir';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { PersonDetailsModal } from '../components/PersonDetailsModal';
import { PersonFormModal } from '../components/PersonFormModal';
import { UnlockModal } from '../components/UnlockModal';
import {
  computeTreeLayout,
  CARD_H,
  CARD_W,
  type TreeOrientation,
  type TreeSpacing,
} from '../features/tree/layout';
import { JunctionNode } from '../features/tree/JunctionNode';
import { GenLabelNode } from '../features/tree/GenLabelNode';
import { ChildEdge } from '../features/tree/ChildEdge';
import { PersonNode } from '../features/tree/PersonNode';
import { TreeInteractionContext } from '../features/tree/TreeInteractionContext';
import type { SelectionRole, TreeInteraction } from '../features/tree/TreeInteractionContext';

const nodeTypes: NodeTypes = { person: PersonNode, junction: JunctionNode, genLabel: GenLabelNode };
const edgeTypes: EdgeTypes = { child: ChildEdge };

function TreeSearch({ onSelect }: { onSelect: (person: FamilyPerson) => void }) {
  const { people, getLabel } = useFamily();
  const t = useT();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return people.filter((p) => matchesSearch(p, query)).slice(0, 8);
  }, [people, query]);

  const select = (person: FamilyPerson) => {
    onSelect(person);
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div
      className="relative min-w-0 flex-1 sm:w-72 sm:flex-none"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Element | null)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
        aria-hidden
      />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-label={t('tree.searchLabel')}
        placeholder={t('tree.searchPlaceholder')}
        className="input !pl-9"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => (i + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
          } else if (e.key === 'Enter' && open) {
            e.preventDefault();
            select(results[activeIndex >= 0 ? activeIndex : 0]);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
      />
      {open && query.trim() && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-stone-400">{t('tree.noMatch', { q: query })}</li>
          )}
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/50 ${
                  i === activeIndex ? 'bg-emerald-50 dark:bg-emerald-950/50' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(p)}
              >
                <span className="truncate font-medium text-stone-800 dark:text-stone-200">
                  {fullName(p)}
                </span>
                <span className="shrink-0 text-xs text-stone-400">{getLabel(p)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Small dropdown holding the secondary / view actions so the bar never clips. */
function MoreMenu({ children, label }: { children: React.ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // `Node` is shadowed by React Flow's Node type in this module; use the
      // element type for the DOM containment check.
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-60 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-xl dark:border-stone-700 dark:bg-stone-900"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 ${
        active
          ? 'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800'
      }`}
    >
      <span className="shrink-0 text-stone-500 dark:text-stone-400">{icon}</span>
      {label}
    </button>
  );
}

function MenuSeparator() {
  return <div className="my-1 border-t border-stone-200 dark:border-stone-700" />;
}

function TreeCanvas({
  nodes,
  edges,
  focusId,
  onFocused,
  onReady,
}: {
  nodes: Node[];
  edges: Edge[];
  focusId: string | null;
  onFocused: () => void;
  onReady: (instance: ReactFlowInstance) => void;
}) {
  const { setCenter } = useReactFlow();
  const t = useT();
  const [minimapOpen, setMinimapOpen] = useState(true);

  useEffect(() => {
    if (!focusId) return;
    const node = nodes.find((n) => n.id === focusId);
    if (node) {
      setCenter(node.position.x + CARD_W / 2, node.position.y + CARD_H / 2, {
        zoom: 0.9,
        duration: 600,
      });
    }
    onFocused();
  }, [focusId, nodes, setCenter, onFocused]);

  // Frame the whole tree to its actual bounds on load — this fills the canvas
  // instead of leaving big empty margins — but cap the zoom so a small family
  // isn't blown up and the cards stay legible.
  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      onReady(instance);
      // No minZoom clamp: a very wide family must be allowed to zoom out far
      // enough to fit fully rather than be clipped at the edges.
      instance.fitView({ padding: 0.16, maxZoom: 0.85 });
    },
    [onReady],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onInit={handleInit}
      minZoom={0.02}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1.5}
        className="!text-slate-500 dark:!text-stone-700"
      />
      <Panel
        position="top-left"
        className="hidden rounded-xl border border-stone-200 bg-white/90 p-3 text-xs shadow-sm backdrop-blur sm:block dark:border-stone-700 dark:bg-stone-900/90"
      >
        <p className="mb-1.5 font-semibold text-stone-700 dark:text-stone-200">
          {t('tree.legendTitle')}
        </p>
        <ul className="space-y-1.5 text-stone-600 dark:text-stone-300">
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-0.5 w-6 rounded bg-rose-400 dark:bg-rose-600"
            />
            {t('tree.legendMarried')}
          </li>
          <li className="flex items-center gap-2">
            <svg width="24" height="2" aria-hidden className="shrink-0">
              <line
                x1="0"
                y1="1"
                x2="24"
                y2="1"
                strokeWidth="2"
                strokeDasharray="2 5"
                className="stroke-stone-400 dark:stroke-stone-500"
              />
            </svg>
            {t('tree.legendDivorced')}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="flex items-center">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="inline-block h-0.5 w-4 bg-emerald-500" />
              <span className="-ml-px inline-block border-y-4 border-l-[6px] border-y-transparent border-l-emerald-500" />
            </span>
            {t('tree.legendChildren')}
          </li>
        </ul>
      </Panel>
      <Panel position="bottom-left" className="!m-3">
        <MadeByKadir align="left" />
      </Panel>
      <Controls showInteractive={false} position="bottom-right" />

      {/* Collapsible minimap: a toggle sits at the bottom-right corner; the
          map itself floats just above it and can be hidden to free up canvas
          on large families. Hidden on phones where it would crowd the view. */}
      <Panel position="bottom-right" className="!bottom-16 !right-3 hidden md:block">
        <button
          type="button"
          onClick={() => setMinimapOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:border-stone-600 dark:bg-stone-800/90 dark:text-stone-300"
          aria-pressed={minimapOpen}
        >
          <Map className="h-3.5 w-3.5" aria-hidden />
          {minimapOpen ? t('tree.minimapHide') : t('tree.minimapShow')}
        </button>
      </Panel>
      {minimapOpen && (
        <MiniMap
          className="!hidden !bottom-24 md:!block"
          pannable
          zoomable
          nodeStrokeWidth={4}
          nodeColor="#a8a29e"
          maskColor="rgb(120 113 108 / 0.15)"
        />
      )}
    </ReactFlow>
  );
}

export function TreePage() {
  const { people, index, deletePerson } = useFamily();
  const { canEdit, canDelete, signOut } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const confirm = useConfirm();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();

  const [collapsedList, setCollapsedList] = usePersistentState<string[]>(
    STORAGE_KEYS.collapsed,
    [],
    (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string'),
  );
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);

  const [orientation, setOrientation] = usePersistentState<TreeOrientation>(
    STORAGE_KEYS.treeOrientation,
    'vertical',
    (v): v is TreeOrientation => v === 'vertical' || v === 'horizontal',
  );
  const [spacing, setSpacing] = usePersistentState<TreeSpacing>(
    STORAGE_KEYS.treeSpacing,
    'comfortable',
    (v): v is TreeSpacing => v === 'comfortable' || v === 'compact',
  );

  const [editMode, setEditMode] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{ person?: FamilyPerson; link?: RelationLink } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (!canEdit && editMode) setEditMode(false);
  }, [canEdit, editMode]);

  const layout = useMemo(
    () => computeTreeLayout(people, collapsed, { orientation, spacing }),
    [people, collapsed, orientation, spacing],
  );
  const flowNodes = useMemo(
    () => [...layout.genLabelNodes, ...layout.nodes, ...layout.junctionNodes] as Node[],
    [layout],
  );

  const toggleCollapse = useCallback(
    (anchorId: string) => {
      setCollapsedList((list) =>
        list.includes(anchorId) ? list.filter((id) => id !== anchorId) : [...list, anchorId],
      );
    },
    [setCollapsedList],
  );

  // Relatives of the selected person, for highlight + dimming.
  const selection = useMemo(() => {
    if (!selectedId || !index.get(selectedId)) return null;
    const person = index.get(selectedId)!;
    return {
      ancestors: getAncestorIds(selectedId, index),
      descendants: getDescendantIds(selectedId, index),
      spouses: new Set(person.spouseIds),
    };
  }, [selectedId, index]);

  const roleOf = useCallback(
    (personId: string): SelectionRole => {
      if (!selectedId || !selection) return 'none';
      if (personId === selectedId) return 'selected';
      if (selection.spouses.has(personId)) return 'spouse';
      if (selection.ancestors.has(personId)) return 'ancestor';
      if (selection.descendants.has(personId)) return 'descendant';
      return 'unrelated';
    },
    [selectedId, selection],
  );

  const openDetails = useCallback((id: string) => {
    setDetailsId(id);
    setSelectedId(id); // opening a card highlights their relatives too
  }, []);

  const interaction = useMemo<TreeInteraction>(
    () => ({
      onOpen: openDetails,
      onToggleCollapse: toggleCollapse,
      onQuickAdd: (kind, personId) => setForm({ link: { kind, targetId: personId } }),
      editMode,
      selectedId,
      roleOf,
    }),
    [openDetails, toggleCollapse, editMode, selectedId, roleOf],
  );

  const focusPerson = useCallback(
    (person: FamilyPerson) => {
      // Expand every collapsed branch between the founders and this person.
      const ancestors = getAncestorIds(person.id, index);
      for (const spouseId of person.spouseIds) {
        ancestors.add(spouseId);
        for (const id of getAncestorIds(spouseId, index)) ancestors.add(id);
      }
      setCollapsedList((list) => list.filter((id) => !ancestors.has(id) && id !== person.id));
      setSelectedId(person.id);
      setFocusId(person.id);
    },
    [index, setCollapsedList],
  );

  // Deep link: ?person=<id> centers and highlights that person on load.
  const appliedParamRef = useRef<string | null>(null);
  useEffect(() => {
    const personParam = searchParams.get('person');
    if (!personParam || appliedParamRef.current === personParam) return;
    const person = index.get(personParam);
    if (person) {
      appliedParamRef.current = personParam;
      focusPerson(person);
    }
  }, [searchParams, index, focusPerson]);

  const collapseAll = () => {
    setCollapsedList(people.filter((p) => p.childIds.length > 0).map((p) => p.id));
    toast(t('tree.collapsedToast'), 'info');
  };

  // ---- View controls (need the live React Flow instance) --------------------
  // Fit Tree: pack the whole family into view (may zoom out on big trees).
  const fitEntireTree = () => rfRef.current?.fitView({ padding: 0.1, duration: 600 });

  // Reset View: the comfortable default framing — fits the tree to its bounds
  // but never zooms in past a legible level, so there's little empty canvas.
  const resetView = () =>
    rfRef.current?.fitView({ padding: 0.16, maxZoom: 0.85, duration: 600 });

  // Center Selected: bring the selected person to the middle at a close zoom.
  const centerSelected = () => {
    if (!rfRef.current || !selectedId) return;
    const node = flowNodes.find((n) => n.id === selectedId);
    if (node) {
      rfRef.current.setCenter(node.position.x + CARD_W / 2, node.position.y + CARD_H / 2, {
        zoom: 1,
        duration: 600,
      });
    }
  };

  const fitSelectedBranch = () => {
    if (!rfRef.current || !selectedId || !selection) return;
    const branch = new Set<string>([selectedId, ...selection.descendants, ...selection.spouses]);
    const nodes = flowNodes.filter((n) => branch.has(n.id));
    if (nodes.length === 0) return;
    rfRef.current.fitView({ nodes: nodes.map((n) => ({ id: n.id })), padding: 0.2, duration: 600 });
  };

  const copyShareLink = async () => {
    if (!selectedId) return;
    const url = `${window.location.origin}${window.location.pathname}?person=${encodeURIComponent(selectedId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t('tree.linkCopied'), 'success');
    } catch {
      // Reflect the id in the address bar as a fallback the user can copy.
      setSearchParams({ person: selectedId });
      toast(t('tree.linkCopyFail'), 'info');
    }
  };

  const handleDelete = useCallback(
    async (person: FamilyPerson) => {
      const proceed = await confirm({
        title: t('delete.title', { name: fullName(person) }),
        message: t('delete.msg'),
        confirmLabel: t('delete.btn'),
        danger: true,
      });
      if (!proceed) return;
      deletePerson(person.id);
      setDetailsId(null);
      toast(t('delete.done', { name: fullName(person) }));
    },
    [confirm, deletePerson, toast, t],
  );

  const handleExportPng = async () => {
    try {
      const { exportTreeAsPng } = await import('../features/tree/exportPng');
      await exportTreeAsPng(flowNodes, settings.theme === 'dark');
      toast(t('tree.pngDone'));
    } catch {
      toast(t('tree.pngFail'), 'error');
    }
  };

  const requestEdit = (person: FamilyPerson) => {
    setDetailsId(null);
    if (canEdit) {
      setEditMode(true);
      setForm({ person });
    } else {
      setPendingEditId(person.id);
      setUnlockOpen(true);
    }
  };

  if (people.length === 0) {
    return (
      <EmptyTreeState onAdd={() => (canEdit ? setForm({}) : setUnlockOpen(true))}>
        {unlockOpen && (
          <UnlockModal onClose={() => setUnlockOpen(false)} onUnlocked={() => setForm({})} />
        )}
        {form && <PersonFormModal {...form} onClose={() => setForm(null)} />}
      </EmptyTreeState>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
        {/* One flex row that wraps cleanly at any width — no horizontal scroll,
            no clipping. Search grows; the actions stay grouped on the right. */}
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2">
          <TreeSearch onSelect={focusPerson} />

          <div className="ml-auto flex items-center gap-1.5">
            {/* Essential actions stay visible. */}
            {!editMode && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setJoinOpen(true)}
                title={t('tree.addYourselfTitle')}
              >
                <UserRoundPlus className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{t('tree.addYourself')}</span>
              </button>
            )}
            {editMode && (
              <button type="button" className="btn-primary" onClick={() => setForm({})}>
                <UserPlus className="h-4 w-4" aria-hidden />
                {t('tree.addPerson')}
              </button>
            )}
            <button
              type="button"
              className={editMode ? 'btn-primary' : 'btn-secondary'}
              onClick={() => {
                if (!canEdit) setUnlockOpen(true);
                else setEditMode((on) => !on);
              }}
              aria-pressed={editMode}
            >
              {canEdit ? (
                <LockOpen className="h-4 w-4" aria-hidden />
              ) : (
                <Lock className="h-4 w-4" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {editMode ? t('tree.editing') : t('tree.editMode')}
              </span>
            </button>

            {/* Secondary + view actions live in the More menu so the bar never
                overflows on small screens. */}
            <MoreMenu label={t('tree.more')}>
              <MenuItem
                icon={<Maximize className="h-4 w-4" />}
                label={t('tree.fitTree')}
                onClick={fitEntireTree}
              />
              <MenuItem
                icon={<Crosshair className="h-4 w-4" />}
                label={t('tree.centerSelected')}
                onClick={centerSelected}
                disabled={!selectedId}
              />
              <MenuItem
                icon={<Scan className="h-4 w-4" />}
                label={t('tree.fitBranch')}
                onClick={fitSelectedBranch}
                disabled={!selectedId}
              />
              <MenuItem
                icon={<RotateCcw className="h-4 w-4" />}
                label={t('tree.resetView')}
                onClick={resetView}
              />
              <MenuItem
                icon={<LinkIcon className="h-4 w-4" />}
                label={t('tree.copyLink')}
                onClick={() => void copyShareLink()}
                disabled={!selectedId}
              />
              <MenuSeparator />
              <MenuItem
                icon={<Rows3 className="h-4 w-4" />}
                label={t('tree.layoutVertical')}
                onClick={() => setOrientation('vertical')}
                active={orientation === 'vertical'}
              />
              <MenuItem
                icon={<Columns3 className="h-4 w-4" />}
                label={t('tree.layoutHorizontal')}
                onClick={() => setOrientation('horizontal')}
                active={orientation === 'horizontal'}
              />
              <MenuSeparator />
              <MenuItem
                icon={<ChevronsUpDown className="h-4 w-4" />}
                label={t('tree.spacingComfortable')}
                onClick={() => setSpacing('comfortable')}
                active={spacing === 'comfortable'}
              />
              <MenuItem
                icon={<ChevronsDownUp className="h-4 w-4" />}
                label={t('tree.spacingCompact')}
                onClick={() => setSpacing('compact')}
                active={spacing === 'compact'}
              />
              {canDelete && (
                <>
                  <MenuSeparator />
                  <MenuItem
                    icon={<ChevronsUpDown className="h-4 w-4" />}
                    label={t('tree.expandAll')}
                    onClick={() => setCollapsedList([])}
                  />
                  <MenuItem
                    icon={<ChevronsDownUp className="h-4 w-4" />}
                    label={t('tree.collapseAll')}
                    onClick={collapseAll}
                  />
                  <MenuItem
                    icon={<ImageIcon className="h-4 w-4" />}
                    label={t('tree.png')}
                    onClick={() => void handleExportPng()}
                  />
                </>
              )}
              {canEdit && (
                <>
                  <MenuSeparator />
                  <MenuItem
                    icon={<LogOut className="h-4 w-4" />}
                    label={t('tree.signOutLabel')}
                    onClick={() => {
                      signOut();
                      toast(t('tree.lockedToast'), 'info');
                    }}
                  />
                </>
              )}
            </MoreMenu>
          </div>
        </div>

        {selectedId && (
          <div className="mx-auto mt-2 flex max-w-[1600px] flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary !py-1.5 !text-xs"
              onClick={() => setSelectedId(null)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t('tree.clearHighlight')}
            </button>
            <span className="hidden items-center gap-2 text-xs text-stone-500 sm:flex dark:text-stone-400">
              <LegendDot className="bg-amber-400" /> {t('tree.hlSelected')}
              <LegendDot className="bg-sky-400" /> {t('tree.hlAncestors')}
              <LegendDot className="bg-emerald-400" /> {t('tree.hlDescendants')}
              <LegendDot className="bg-rose-400" /> {t('tree.hlSpouses')}
            </span>
          </div>
        )}
      </div>

      <div className="relative min-h-[420px] flex-1" style={{ height: 'calc(100dvh - 12rem)' }}>
        <div className="absolute inset-0 bg-slate-300 dark:bg-stone-950">
          <TreeInteractionContext.Provider value={interaction}>
            <ReactFlowProvider>
              <TreeCanvas
                nodes={flowNodes}
                edges={layout.edges}
                focusId={focusId}
                onFocused={() => setFocusId(null)}
                onReady={(instance) => (rfRef.current = instance)}
              />
            </ReactFlowProvider>
          </TreeInteractionContext.Provider>
        </div>
      </div>

      {detailsId && (
        <PersonDetailsModal
          personId={detailsId}
          onClose={() => setDetailsId(null)}
          onNavigate={(id) => openDetails(id)}
          editMode={editMode}
          canDelete={canDelete}
          onEdit={(person) => {
            setDetailsId(null);
            setForm({ person });
          }}
          onDelete={handleDelete}
          onRequestEdit={requestEdit}
        />
      )}
      {form && (
        <PersonFormModal
          {...form}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            setSelectedId(id);
            setFocusId(id);
          }}
        />
      )}
      {unlockOpen && (
        <UnlockModal
          onClose={() => {
            setUnlockOpen(false);
            setPendingEditId(null);
          }}
          onUnlocked={() => {
            setEditMode(true);
            const pending = pendingEditId ? index.get(pendingEditId) : null;
            if (pending) setForm({ person: pending });
            setPendingEditId(null);
          }}
        />
      )}
      {joinOpen && <JoinFamilyModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />;
}

function EmptyTreeState({ onAdd, children }: { onAdd: () => void; children?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="rounded-full bg-emerald-100 p-4 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <TreePine className="h-10 w-10" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">{t('tree.emptyTitle')}</h1>
      <p className="max-w-md text-sm text-stone-500 dark:text-stone-400">{t('tree.emptyText')}</p>
      <button type="button" className="btn-primary" onClick={onAdd}>
        <UserPlus className="h-4 w-4" aria-hidden /> {t('tree.emptyBtn')}
      </button>
      {children}
    </div>
  );
}
