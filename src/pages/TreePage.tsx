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
import { Lock, LockOpen, Map, Search, TreePine, UserPlus, UserRoundPlus, X, Download, Printer, Share2, GitBranch } from 'lucide-react';
import type { FamilyPerson, RelationLink } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useFamily } from '../context/FamilyContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { useT } from '../i18n/useT';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
import { getAncestorIds, fullName } from '../utils/family';
import { filterBranchPeople } from '../utils/branch';
import { matchesSearch } from '../utils/filters';
import { MadeByKadir } from '../components/MadeByKadir';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { PersonDetailsModal } from '../components/PersonDetailsModal';
import { PersonFormModal } from '../components/PersonFormModal';
import { UnlockModal } from '../components/UnlockModal';
import { Avatar } from '../components/Avatar';
import { computeTreeLayout, CARD_H, CARD_W } from '../features/tree/layout';
import { exportTreeAsPng, printTreePoster, shareTreePoster } from '../features/tree/exportPng';
import { JunctionNode } from '../features/tree/JunctionNode';
import { GenLabelNode } from '../features/tree/GenLabelNode';
import { ChildEdge } from '../features/tree/ChildEdge';
import { PersonNode } from '../features/tree/PersonNode';
import { TreeInteractionContext } from '../features/tree/TreeInteractionContext';
import type { TreeInteraction } from '../features/tree/TreeInteractionContext';

const nodeTypes: NodeTypes = { person: PersonNode, junction: JunctionNode, genLabel: GenLabelNode };
const edgeTypes: EdgeTypes = { child: ChildEdge };

const START_ZOOM = 1.1;
const START_ZOOM_EASY = 1.25;
const FOCUS_ZOOM = 1.2;
const FOCUS_ZOOM_EASY = 1.35;

function TreeSearch({
  onSelect,
  large = false,
}: {
  onSelect: (person: FamilyPerson) => void;
  large?: boolean;
}) {
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
      className={`relative min-w-0 flex-1 ${large ? 'sm:max-w-xl sm:flex-1' : 'sm:w-72 sm:flex-none'}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Element | null)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <Search
        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 ${
          large ? 'h-5 w-5' : 'h-4 w-4'
        }`}
        aria-hidden
      />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-label={t('tree.searchLabel')}
        placeholder={t(large ? 'tree.searchPlaceholderEasy' : 'tree.searchPlaceholder')}
        className={`input ${large ? '!py-3.5 !pl-11 !pr-10 !text-base' : '!pl-9'}`}
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
      {query && (
        <button
          type="button"
          className="icon-btn absolute right-1.5 top-1/2 -translate-y-1/2"
          onClick={() => {
            setQuery('');
            setOpen(false);
            setActiveIndex(-1);
          }}
          aria-label={t('search.clear')}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
      {open && query.trim() && (
        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900">
          {results.length === 0 && (
            <li className={`px-3 py-2 text-stone-400 ${large ? 'text-base' : 'text-sm'}`}>
              {t('tree.noMatch', { q: query })}
            </li>
          )}
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/50 ${
                  large ? 'py-3' : 'py-2'
                } ${i === activeIndex ? 'bg-emerald-50 dark:bg-emerald-950/50' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(p)}
              >
                <Avatar person={p} size={large ? 'md' : 'sm'} />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-medium text-stone-800 dark:text-stone-200 ${
                      large ? 'text-base' : 'text-sm'
                    }`}
                  >
                    {fullName(p)}
                  </span>
                  <span className="block truncate text-xs text-stone-400">{getLabel(p)}</span>
                </span>
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
  easyMode,
}: {
  nodes: Node[];
  edges: Edge[];
  focusId: string | null;
  onFocused: () => void;
  easyMode: boolean;
}) {
  const { setCenter, getZoom, fitView } = useReactFlow();
  const t = useT();
  const { settings } = useSettings();
  const dark = settings.theme === 'dark';
  const [minimapOpen, setMinimapOpen] = useState(!easyMode);

  useEffect(() => {
    if (easyMode) setMinimapOpen(false);
  }, [easyMode]);
  const [tipVisible, setTipVisible] = useState(
    () => loadJson<boolean>(STORAGE_KEYS.treeTipSeen, (v): v is boolean => typeof v === 'boolean') !== true,
  );
  const didInitialFocus = useRef(false);
  const startZoom = easyMode ? START_ZOOM_EASY : START_ZOOM;
  const focusZoom = easyMode ? FOCUS_ZOOM_EASY : FOCUS_ZOOM;

  const focusTopOfTree = useCallback(
    (instance?: ReactFlowInstance, animate = true) => {
      const personNodes = nodes.filter((n) => n.type === 'person');
      if (personNodes.length === 0) return;
      // Prefer generation 1 (founders) so side branches don't pull the camera.
      const gen1 = personNodes.filter((n) => n.data && (n.data as { generation?: number }).generation === 1);
      const topRow = gen1.length > 0
        ? gen1
        : (() => {
            const minY = Math.min(...personNodes.map((n) => n.position.y));
            return personNodes.filter((n) => n.position.y === minY);
          })();
      const centersX = topRow.map((n) => n.position.x + CARD_W / 2);
      const cx = (Math.min(...centersX) + Math.max(...centersX)) / 2;
      const cy = topRow[0].position.y + CARD_H / 2;
      const opts = { zoom: startZoom, duration: animate ? 500 : 0 };
      if (instance) instance.setCenter(cx, cy, opts);
      else setCenter(cx, cy, opts);
    },
    [nodes, setCenter, startZoom],
  );

  useEffect(() => {
    if (!focusId) return;
    const node = nodes.find((n) => n.id === focusId);
    if (node) {
      setCenter(node.position.x + CARD_W / 2, node.position.y + CARD_H / 2, {
        zoom: Math.max(getZoom(), focusZoom),
        duration: 600,
      });
    }
    onFocused();
  }, [focusId, nodes, setCenter, getZoom, focusZoom, onFocused]);

  // Centre on the founding row at a readable zoom — not fitView of the whole tree.
  const handleInit = useCallback(
    (instance: ReactFlowInstance) => {
      focusTopOfTree(instance, false);
      didInitialFocus.current = true;
    },
    [focusTopOfTree],
  );

  useEffect(() => {
    if (didInitialFocus.current) return;
    if (!nodes.some((n) => n.type === 'person')) return;
    didInitialFocus.current = true;
    focusTopOfTree(undefined, false);
  }, [nodes, focusTopOfTree]);

  const dismissTip = () => {
    setTipVisible(false);
    saveJson(STORAGE_KEYS.treeTipSeen, true);
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onInit={handleInit}
      minZoom={0.08}
      maxZoom={2.25}
      className={`family-tree-canvas ${easyMode ? 'tree-easy' : ''} ${dark ? 'family-tree-canvas--dark' : 'family-tree-canvas--light'}`}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      zoomOnDoubleClick={false}
      panOnScroll
      proOptions={{ hideAttribution: true }}
    >
      <Background
        id="tree-grid"
        variant={BackgroundVariant.Cross}
        gap={28}
        size={1.25}
        color={dark ? 'rgba(168, 162, 158, 0.14)' : 'rgba(120, 113, 108, 0.18)'}
      />
      {!easyMode && (
        <Panel
          position="top-left"
          className="!m-2 hidden rounded-xl border border-stone-200/80 bg-white/95 p-2.5 text-[11px] shadow-sm backdrop-blur sm:!m-3 sm:block dark:border-stone-700/80 dark:bg-stone-900/95"
        >
          <p className="mb-1 font-semibold text-stone-700 dark:text-stone-200">
            {t('tree.legendTitle')}
          </p>
          <ul className="space-y-1 text-stone-600 dark:text-stone-300">
            <li className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-0.5 w-5 rounded bg-rose-400 dark:bg-rose-500"
              />
              {t('tree.legendMarried')}
            </li>
            <li className="flex items-center gap-2">
              <svg width="20" height="2" aria-hidden className="shrink-0">
                <line
                  x1="0"
                  y1="1"
                  x2="20"
                  y2="1"
                  strokeWidth="2"
                  strokeDasharray="2 4"
                  className="stroke-stone-400 dark:stroke-stone-500"
                />
              </svg>
              {t('tree.legendDivorced')}
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden className="flex items-center">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span className="inline-block h-0.5 w-3 bg-emerald-500" />
                <span className="-ml-px inline-block border-y-[3px] border-l-[5px] border-y-transparent border-l-emerald-500" />
              </span>
              {t('tree.legendChildren')}
            </li>
          </ul>
        </Panel>
      )}
      {tipVisible && (
        <Panel
          position="top-center"
          className="!m-2 max-w-[min(100%-1rem,20rem)] rounded-xl border border-emerald-200/80 bg-white/95 px-2.5 py-2 text-xs shadow-sm backdrop-blur sm:!m-3 sm:max-w-md sm:p-3 sm:text-sm dark:border-emerald-800/80 dark:bg-stone-900/95"
        >
          <div className="flex items-start gap-2">
            <p className="flex-1 leading-snug text-stone-700 dark:text-stone-200">{t('tree.tip')}</p>
            <button
              type="button"
              className="icon-btn !h-8 !w-8 shrink-0"
              onClick={dismissTip}
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </Panel>
      )}
      <Panel position="top-right" className="!m-2 flex gap-1.5 sm:!m-3 sm:flex-col">
        <button
          type="button"
          className="rounded-xl border border-stone-200/90 bg-white/95 px-2.5 py-2 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur hover:border-emerald-400 hover:text-emerald-800 dark:border-stone-700 dark:bg-stone-900/95 dark:text-stone-200 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
          onClick={() => focusTopOfTree()}
        >
          {t('tree.zoomReadable')}
        </button>
        <button
          type="button"
          className="rounded-xl border border-stone-200/90 bg-white/95 px-2.5 py-2 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur hover:border-emerald-400 hover:text-emerald-800 dark:border-stone-700 dark:bg-stone-900/95 dark:text-stone-200 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
          onClick={() => fitView({ padding: 0.16, duration: 500, maxZoom: startZoom })}
        >
          {t('tree.fitTree')}
        </button>
      </Panel>
      <Panel position="bottom-left" className="!m-3 !mb-20 hidden sm:block lg:!mb-3">
        <MadeByKadir align="left" />
      </Panel>
      <Controls
        showInteractive={false}
        position="bottom-right"
        className={`family-tree-controls !mb-[4.75rem] !mr-2 overflow-hidden rounded-xl border border-stone-200/90 shadow-md sm:!mb-16 lg:!mb-3 lg:!mr-3 ${easyMode ? 'tree-controls-easy' : ''}`}
      />

      <Panel position="bottom-right" className="!bottom-16 !right-3 hidden md:block lg:!bottom-16">
        <button
          type="button"
          onClick={() => setMinimapOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:border-stone-600 dark:bg-stone-800/95 dark:text-stone-300"
          aria-pressed={minimapOpen}
        >
          <Map className="h-3.5 w-3.5" aria-hidden />
          {minimapOpen ? t('tree.minimapHide') : t('tree.minimapShow')}
        </button>
      </Panel>
      {minimapOpen && (
        <MiniMap
          className="!hidden !bottom-24 !overflow-hidden !rounded-xl !border !border-stone-200 md:!block dark:!border-stone-700"
          pannable
          zoomable
          nodeStrokeWidth={3}
          nodeColor={dark ? '#78716c' : '#a8a29e'}
          maskColor={dark ? 'rgb(0 0 0 / 0.45)' : 'rgb(68 64 60 / 0.12)'}
        />
      )}
    </ReactFlow>
  );
}

export function TreePage() {
  const { people, index, deletePerson } = useFamily();
  const { canEdit, canDelete } = useAuth();
  const { settings } = useSettings();
  const easy = Boolean(settings.easyMode);
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
  const [branchRootId, setBranchRootId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    if (!canEdit && editMode) setEditMode(false);
  }, [canEdit, editMode]);

  // Invite / join deep link: ?join=1 or ?invite=1 opens Add yourself.
  useEffect(() => {
    if (searchParams.get('join') === '1' || searchParams.get('invite') === '1') {
      setJoinOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('join');
      next.delete('invite');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const branchPeople = useMemo(
    () => filterBranchPeople(people, branchRootId, index),
    [people, branchRootId, index],
  );

  const layout = useMemo(
    () => computeTreeLayout(branchPeople, collapsed),
    [branchPeople, collapsed],
  );
  const flowNodes = useMemo(
    () => [...layout.genLabelNodes, ...layout.nodes, ...layout.junctionNodes] as Node[],
    [layout],
  );

  const branchRoot = branchRootId ? index.get(branchRootId) : null;

  const runExport = async (mode: 'png' | 'print' | 'share') => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const opts = {
        nodes: flowNodes,
        darkMode: settings.theme === 'dark',
        filename: branchRoot
          ? `family-tree-${fullName(branchRoot).replace(/\s+/g, '-').toLowerCase()}.png`
          : 'family-tree.png',
        title: t('site.title'),
        text: t('tree.shareText'),
      };
      if (mode === 'png') {
        await exportTreeAsPng(opts);
        toast(t('tree.pngDone'), 'success');
      } else if (mode === 'print') {
        await printTreePoster(opts);
      } else {
        const result = await shareTreePoster(opts);
        toast(result === 'shared' ? t('tree.shareDone') : t('tree.pngDone'), 'success');
      }
    } catch (error) {
      console.error(error);
      toast(t('tree.pngFail'), 'error');
    } finally {
      setExportBusy(false);
    }
  };

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
      <div className="border-b border-stone-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3 dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <TreeSearch onSelect={focusPerson} large />

          <div className="flex items-center gap-1.5 sm:ml-auto">
            <button
              type="button"
              className="icon-btn !min-h-10 !min-w-10 sm:hidden"
              disabled={exportBusy || flowNodes.length === 0}
              onClick={() => void runExport('share')}
              title={t('tree.shareTitle')}
              aria-label={t('tree.share')}
            >
              <Share2 className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-secondary !hidden !min-h-10 sm:!inline-flex"
              disabled={exportBusy || flowNodes.length === 0}
              onClick={() => void runExport('png')}
              title={t('tree.pngTitle')}
            >
              <Download className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">{t('tree.png')}</span>
            </button>
            <button
              type="button"
              className="btn-secondary !hidden !min-h-10 md:!inline-flex"
              disabled={exportBusy || flowNodes.length === 0}
              onClick={() => void runExport('print')}
              title={t('tree.printTitle')}
            >
              <Printer className="h-4 w-4" aria-hidden />
              <span className="hidden lg:inline">{t('tree.print')}</span>
            </button>
            <button
              type="button"
              className="btn-secondary !hidden !min-h-10 sm:!inline-flex"
              disabled={exportBusy || flowNodes.length === 0}
              onClick={() => void runExport('share')}
              title={t('tree.shareTitle')}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              <span className="hidden lg:inline">{t('tree.share')}</span>
            </button>
            {!editMode && (
              <button
                type="button"
                className="icon-btn !min-h-10 !min-w-10 sm:!min-w-0 sm:!w-auto sm:!gap-1.5 sm:!px-3 sm:!text-sm"
                onClick={() => setJoinOpen(true)}
                title={t('tree.addYourselfTitle')}
                aria-label={t('tree.addYourself')}
              >
                <UserRoundPlus className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{t('tree.addYourself')}</span>
              </button>
            )}
            {editMode && (
              <button type="button" className="btn-primary !min-h-10" onClick={() => setForm({})}>
                <UserPlus className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{t('tree.addPerson')}</span>
              </button>
            )}
            <button
              type="button"
              className={`${editMode ? 'btn-primary' : 'btn-secondary'} !min-h-10 !px-2.5 sm:!px-3`}
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
        {branchRoot && (
          <div className="mx-auto mt-2 flex max-w-[1600px] items-center gap-2 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900 sm:px-3 sm:py-2 sm:text-sm dark:bg-emerald-950/40 dark:text-emerald-100">
            <GitBranch className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-medium">
              {t('tree.focusBanner', { name: fullName(branchRoot) })}
            </span>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-emerald-200 bg-white/80 px-2 py-1 text-xs font-semibold dark:border-emerald-800 dark:bg-stone-900/60"
              onClick={() => setBranchRootId(null)}
            >
              {t('tree.focusClear')}
            </button>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1" style={{ minHeight: 'calc(100dvh - 11rem)' }}>
        <div className="absolute inset-0 bg-stone-100 dark:bg-stone-950">
          <TreeInteractionContext.Provider value={interaction}>
            <ReactFlowProvider>
              <TreeCanvas
                nodes={flowNodes}
                edges={layout.edges}
                focusId={focusId}
                onFocused={() => setFocusId(null)}
                easyMode={easy}
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
          onFocusBranch={(person) => {
            setBranchRootId(person.id);
            setFocusId(person.id);
            toast(t('tree.focusToast', { name: fullName(person) }), 'info');
          }}
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
