import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { Edge, Node, NodeTypes } from '@xyflow/react';
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Image as ImageIcon,
  Lock,
  LockOpen,
  LogOut,
  Search,
  TreePine,
  Upload,
  UserPlus,
  UserRoundPlus,
  X,
} from 'lucide-react';
import type { FamilyPerson, RelationKind, RelationLink } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useFamily } from '../context/FamilyContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useDataTransfer } from '../hooks/useDataTransfer';
import { usePersistentState } from '../hooks/usePersistentState';
import { useT } from '../i18n/useT';
import { STORAGE_KEYS } from '../utils/storage';
import { getAncestorIds, fullName } from '../utils/family';
import { DEFAULT_FILTERS, hasActiveFilters, matchesFilters, matchesSearch } from '../utils/filters';
import type { Filters } from '../utils/filters';
import { FilterPanel } from '../components/FilterPanel';
import { MadeByKadir } from '../components/MadeByKadir';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { PersonDetailsModal } from '../components/PersonDetailsModal';
import { PersonFormModal } from '../components/PersonFormModal';
import { UnlockModal } from '../components/UnlockModal';
import { computeTreeLayout, CARD_H, CARD_W } from '../features/tree/layout';
import { exportTreeAsPng } from '../features/tree/exportPng';
import { JunctionNode } from '../features/tree/JunctionNode';
import { PersonNode } from '../features/tree/PersonNode';
import { TreeInteractionContext } from '../features/tree/TreeInteractionContext';
import type { TreeInteraction } from '../features/tree/TreeInteractionContext';

const nodeTypes: NodeTypes = { person: PersonNode, junction: JunctionNode };

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
      className="relative w-full sm:w-72"
      onBlur={(e) => {
        // Close only when focus leaves the whole widget, so tabbing from the
        // input into a result keeps the list open.
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

function TreeCanvas({
  nodes,
  edges,
  focusId,
  onFocused,
}: {
  nodes: Node[];
  edges: Edge[];
  focusId: string | null;
  onFocused: () => void;
}) {
  const { setCenter } = useReactFlow();
  const t = useT();

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

  // Start centered on the founding couple at a readable zoom, instead of
  // squeezing the whole tree into view (which makes every card unreadably
  // small on large families and phones). "Fit view" in the controls still
  // shows everything. Phones get a closer zoom — at 0.75 the card text is
  // too small to read on a pocket screen.
  const handleInit = useCallback(() => {
    const first = nodes.find((n) => n.type === 'person');
    if (first) {
      const zoom = window.innerWidth < 640 ? 1 : 0.75;
      setCenter(first.position.x + CARD_W + 24, first.position.y + CARD_H * 1.8, { zoom });
    }
  }, [nodes, setCenter]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={handleInit}
      minZoom={0.05}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      zoomOnDoubleClick={false}
      className="bg-stone-50 dark:bg-stone-950"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1.5}
        className="!text-stone-300 dark:!text-stone-700"
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
      <MiniMap
        className="!hidden md:!block"
        pannable
        zoomable
        nodeStrokeWidth={4}
        nodeColor="#a8a29e"
        maskColor="rgb(120 113 108 / 0.15)"
      />
    </ReactFlow>
  );
}

export function TreePage() {
  const { people, index, generations, deletePerson } = useFamily();
  const { canEdit, canDelete, role, signOut } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { exportJson, importFromFile } = useDataTransfer();
  const t = useT();

  const [collapsedList, setCollapsedList] = usePersistentState<string[]>(
    STORAGE_KEYS.collapsed,
    [],
    (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string'),
  );
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [editMode, setEditMode] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [form, setForm] = useState<{ person?: FamilyPerson; link?: RelationLink } | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Signing out (or a password change) always leaves edit mode.
  useEffect(() => {
    if (!canEdit && editMode) setEditMode(false);
  }, [canEdit, editMode]);

  const layout = useMemo(() => computeTreeLayout(people, collapsed), [people, collapsed]);
  const flowNodes = useMemo(() => [...layout.nodes, ...layout.junctionNodes] as Node[], [layout]);

  const dimmedIds = useMemo(() => {
    if (!hasActiveFilters(filters)) return new Set<string>();
    return new Set(people.filter((p) => !matchesFilters(p, filters, generations)).map((p) => p.id));
  }, [people, filters, generations]);

  const toggleCollapse = useCallback(
    (anchorId: string) => {
      setCollapsedList((list) =>
        list.includes(anchorId) ? list.filter((id) => id !== anchorId) : [...list, anchorId],
      );
    },
    [setCollapsedList],
  );

  const interaction = useMemo<TreeInteraction>(
    () => ({
      onOpen: (id) => setDetailsId(id),
      onToggleCollapse: toggleCollapse,
      onQuickAdd: (kind, personId) => setForm({ link: { kind, targetId: personId } }),
      editMode,
      highlightedId,
      dimmedIds,
    }),
    [toggleCollapse, editMode, highlightedId, dimmedIds],
  );

  const focusPerson = useCallback(
    (person: FamilyPerson) => {
      // Expand every collapsed branch between the founders and this person.
      // Married-in people have no ancestors of their own, so their spouses'
      // branches must open too — otherwise their node stays hidden.
      const ancestors = getAncestorIds(person.id, index);
      for (const spouseId of person.spouseIds) {
        ancestors.add(spouseId);
        for (const id of getAncestorIds(spouseId, index)) ancestors.add(id);
      }
      setCollapsedList((list) => list.filter((id) => !ancestors.has(id) && id !== person.id));
      setHighlightedId(person.id);
      setFocusId(person.id);
    },
    [index, setCollapsedList],
  );

  const collapseAll = () => {
    setCollapsedList(people.filter((p) => p.childIds.length > 0).map((p) => p.id));
    toast(t('tree.collapsedToast'), 'info');
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
      await exportTreeAsPng(flowNodes, settings.theme === 'dark');
      toast(t('tree.pngDone'));
    } catch {
      toast(t('tree.pngFail'), 'error');
    }
  };

  const addRelative = (kind: RelationKind, person: FamilyPerson) => {
    setDetailsId(null);
    setForm({ link: { kind, targetId: person.id } });
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
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2">
          <TreeSearch onSelect={focusPerson} />

          {/* On phones all controls live in one horizontally swipeable row
              instead of stacking into a wall of buttons; ≥sm this wrapper
              disappears (display:contents) and the groups wrap as before. */}
          <div className="scrollbar-none flex w-full items-center gap-1.5 overflow-x-auto sm:contents">
          <div className="flex shrink-0 items-center gap-1.5 sm:flex-wrap">
            <button type="button" className="btn-secondary" onClick={() => setCollapsedList([])}>
              <ChevronsUpDown className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('tree.expandAll')}</span>
            </button>
            <button type="button" className="btn-secondary" onClick={collapseAll}>
              <ChevronsDownUp className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('tree.collapseAll')}</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={exportJson}
              title={t('tree.exportTitle')}
            >
              <Download className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('tree.export')}</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportPng}
              title={t('tree.pngTitle')}
            >
              <ImageIcon className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('tree.png')}</span>
            </button>
            {canEdit && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importFromFile(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => importInputRef.current?.click()}
                  title={t('tree.importTitle')}
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">{t('tree.import')}</span>
                </button>
              </>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
              {editMode ? t('tree.editing') : t('tree.editMode')}
            </button>
            {canEdit && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  signOut();
                  toast(t('tree.lockedToast'), 'info');
                }}
                title={t('tree.signOutTitle', {
                  role: role === 'owner' ? t('tree.roleOwner') : t('tree.roleEditor'),
                })}
                aria-label={t('tree.signOutLabel')}
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          </div>
        </div>

        <div className="mx-auto mt-2 flex max-w-[1600px] flex-wrap items-center gap-2">
          <FilterPanel
            compact
            filters={filters}
            onChange={setFilters}
            generationCount={Math.max(...[...generations.values(), 1])}
            countries={
              [...new Set(people.map((p) => p.country?.trim()).filter(Boolean))] as string[]
            }
          />
          {highlightedId && (
            <button
              type="button"
              className="btn-secondary !py-1.5 !text-xs"
              onClick={() => setHighlightedId(null)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t('tree.clearHighlight')}
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-[420px] flex-1" style={{ height: 'calc(100dvh - 12rem)' }}>
        {/* Absolute positioning gives React Flow a rock-solid 100% height;
            percentage heights against flex-grown parents resolve to 0 in
            some browsers, which rendered the whole tree invisible. */}
        <div className="absolute inset-0">
          <TreeInteractionContext.Provider value={interaction}>
            <ReactFlowProvider>
              <TreeCanvas
                nodes={flowNodes}
                edges={layout.edges}
                focusId={focusId}
                onFocused={() => setFocusId(null)}
              />
            </ReactFlowProvider>
          </TreeInteractionContext.Provider>
        </div>
      </div>

      {detailsId && (
        <PersonDetailsModal
          personId={detailsId}
          onClose={() => setDetailsId(null)}
          onNavigate={(id) => setDetailsId(id)}
          editMode={editMode}
          canDelete={canDelete}
          onEdit={(person) => {
            setDetailsId(null);
            setForm({ person });
          }}
          onDelete={handleDelete}
          onAddRelative={addRelative}
        />
      )}
      {form && (
        <PersonFormModal
          {...form}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            setHighlightedId(id);
            setFocusId(id);
          }}
        />
      )}
      {unlockOpen && (
        <UnlockModal onClose={() => setUnlockOpen(false)} onUnlocked={() => setEditMode(true)} />
      )}
      {joinOpen && <JoinFamilyModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
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
