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
import { Lock, LockOpen, Map, Search, TreePine, UserPlus, UserRoundPlus } from 'lucide-react';
import type { FamilyPerson, RelationLink } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useFamily } from '../context/FamilyContext';
import { useToast } from '../context/ToastContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { useT } from '../i18n/useT';
import { STORAGE_KEYS } from '../utils/storage';
import { getAncestorIds, fullName } from '../utils/family';
import { matchesSearch } from '../utils/filters';
import { MadeByKadir } from '../components/MadeByKadir';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { PersonDetailsModal } from '../components/PersonDetailsModal';
import { PersonFormModal } from '../components/PersonFormModal';
import { UnlockModal } from '../components/UnlockModal';
import { computeTreeLayout, CARD_H, CARD_W } from '../features/tree/layout';
import { JunctionNode } from '../features/tree/JunctionNode';
import { GenLabelNode } from '../features/tree/GenLabelNode';
import { ChildEdge } from '../features/tree/ChildEdge';
import { PersonNode } from '../features/tree/PersonNode';
import { TreeInteractionContext } from '../features/tree/TreeInteractionContext';
import type { TreeInteraction } from '../features/tree/TreeInteractionContext';

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

  // Frame the whole tree to its actual bounds on load — fills the canvas
  // instead of leaving big empty margins — capping the zoom so a small family
  // isn't blown up and the cards stay legible.
  const handleInit = useCallback((instance: ReactFlowInstance) => {
    instance.fitView({ padding: 0.16, maxZoom: 0.85 });
  }, []);

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

      {/* Collapsible minimap: a toggle sits at the bottom-right corner; the map
          floats just above it and can be hidden to free up canvas. Hidden on
          phones where it would crowd the view. */}
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
  const { canEdit, canDelete } = useAuth();
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

  const [editMode, setEditMode] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{ person?: FamilyPerson; link?: RelationLink } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit && editMode) setEditMode(false);
  }, [canEdit, editMode]);

  const layout = useMemo(() => computeTreeLayout(people, collapsed), [people, collapsed]);
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

  const interaction = useMemo<TreeInteraction>(
    () => ({
      onOpen: (id) => setDetailsId(id),
      onToggleCollapse: toggleCollapse,
      onQuickAdd: (kind, personId) => setForm({ link: { kind, targetId: personId } }),
      editMode,
    }),
    [toggleCollapse, editMode],
  );

  // Expand every collapsed branch between the founders and this person, then
  // centre on them. Married-in people have no ancestors of their own, so their
  // spouses' branches must open too — otherwise their node stays hidden.
  const revealPath = useCallback(
    (person: FamilyPerson) => {
      const ancestors = getAncestorIds(person.id, index);
      for (const spouseId of person.spouseIds) {
        ancestors.add(spouseId);
        for (const id of getAncestorIds(spouseId, index)) ancestors.add(id);
      }
      setCollapsedList((list) => list.filter((id) => !ancestors.has(id) && id !== person.id));
    },
    [index, setCollapsedList],
  );

  const focusPerson = useCallback(
    (person: FamilyPerson) => {
      revealPath(person);
      setFocusId(person.id);
    },
    [revealPath],
  );

  // Deep link: ?person=<id> centres on and auto-opens that person's details.
  const appliedParamRef = useRef<string | null>(null);
  useEffect(() => {
    const personParam = searchParams.get('person');
    if (!personParam || appliedParamRef.current === personParam) return;
    const person = index.get(personParam);
    if (person) {
      appliedParamRef.current = personParam;
      revealPath(person);
      setFocusId(person.id);
      setDetailsId(person.id);
    }
  }, [searchParams, index, revealPath]);

  // Copy a share link for one person; opening it reopens that person.
  const copyPersonLink = useCallback(
    async (person: FamilyPerson) => {
      const url = `${window.location.origin}${window.location.pathname}?person=${encodeURIComponent(person.id)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast(t('tree.linkCopied'), 'success');
      } catch {
        setSearchParams({ person: person.id });
        toast(t('tree.linkCopyFail'), 'info');
      }
    },
    [toast, t, setSearchParams],
  );

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
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2">
          <TreeSearch onSelect={focusPerson} />

          <div className="ml-auto flex items-center gap-1.5">
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
          </div>
        </div>
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
          onRequestEdit={requestEdit}
          onCopyLink={copyPersonLink}
        />
      )}
      {form && (
        <PersonFormModal
          {...form}
          onClose={() => setForm(null)}
          onSaved={(id) => setFocusId(id)}
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
