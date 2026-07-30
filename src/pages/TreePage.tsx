import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { Lock, LockOpen, Map, Maximize2, Search, UserPlus, UserRoundPlus, Users, X, Download, Printer, Share2, ZoomIn } from 'lucide-react';
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
import { matchesSearch } from '../utils/filters';
import { MadeByKadir } from '../components/MadeByKadir';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { PersonDetailsModal } from '../components/PersonDetailsModal';
import { PersonFormModal } from '../components/PersonFormModal';
import { UnlockModal } from '../components/UnlockModal';
import { OverflowMenu } from '../components/OverflowMenu';
import { BrandMark } from '../components/BrandLogo';
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
        className={`tree-search-input ${large ? '!py-3.5 !pl-11 !pr-10 !text-base' : '!pl-9'}`}
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
        <ul className="tree-search-dropdown">
          {results.length === 0 && (
            <li className={`px-3 py-2 text-stone-400 ${large ? 'text-base' : 'text-sm'}`}>
              {t('tree.noMatch', { q: query })}
            </li>
          )}
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={`tree-search-result ${large ? 'py-3' : 'py-2'} ${i === activeIndex ? 'bg-emerald-50 dark:bg-emerald-950/50' : ''}`}
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
  const [tipVisible, setTipVisible] = useState(() => {
    if (easyMode) return false;
    return loadJson<boolean>(STORAGE_KEYS.treeTipSeen, (v): v is boolean => typeof v === 'boolean') !== true;
  });
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
      zoomOnScroll
      panOnScroll={false}
      panOnDrag
      proOptions={{ hideAttribution: true }}
    >
      <Background
        id="tree-grid"
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1.25}
        color={dark ? 'rgba(168, 162, 158, 0.14)' : 'rgba(120, 113, 108, 0.18)'}
      />
      {!easyMode && (
        <Panel
          position="top-left"
          className="!m-2 hidden sm:!m-3 sm:block"
        >
          <div className="tree-legend">
            <p className="mb-1.5 font-semibold text-stone-700 dark:text-stone-200">
              {t('tree.legendTitle')}
            </p>
            <ul className="space-y-1.5 text-stone-600 dark:text-stone-300">
              <li className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-5 rounded bg-rose-400 dark:bg-rose-500"
                />
                <span>{t('tree.legendMarried')}</span>
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
                <span>{t('tree.legendDivorced')}</span>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden className="flex items-center">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="inline-block h-0.5 w-3 bg-emerald-500" />
                  <span className="-ml-px inline-block border-y-[3px] border-l-[5px] border-y-transparent border-l-emerald-500" />
                </span>
                <span>{t('tree.legendChildren')}</span>
              </li>
            </ul>
          </div>
        </Panel>
      )}
      {tipVisible && (
        <Panel position="top-center" className="!m-2 sm:!m-3">
          <div className="tree-tip">
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
          </div>
        </Panel>
      )}
      <Panel position="top-right" className="!m-2 flex gap-1.5 sm:!m-3 sm:flex-col">
        <button
          type="button"
          className="tree-action-btn inline-flex items-center gap-1.5"
          onClick={() => focusTopOfTree()}
        >
          <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          {t('tree.zoomReadable')}
        </button>
        <button
          type="button"
          className="tree-action-btn inline-flex items-center gap-1.5"
          onClick={() => fitView({ padding: 0.16, duration: 500, maxZoom: startZoom })}
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
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

      <Panel position="bottom-right" className="!bottom-16 !right-3 hidden md:block">
        <button
          type="button"
          onClick={() => setMinimapOpen((v) => !v)}
          className="tree-action-btn inline-flex items-center gap-1.5 px-2.5 py-1.5"
          aria-pressed={minimapOpen}
        >
          <Map className="h-3.5 w-3.5" aria-hidden />
          {minimapOpen ? t('tree.minimapHide') : t('tree.minimapShow')}
        </button>
      </Panel>
      {minimapOpen && (
        <MiniMap
          className="!hidden !bottom-24 !overflow-hidden !rounded-xl !border !border-stone-200 !shadow-md md:!block dark:!border-stone-700"
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

  const layout = useMemo(() => computeTreeLayout(people, collapsed), [people, collapsed]);
  const flowNodes = useMemo(
    () => [...layout.genLabelNodes, ...layout.nodes, ...layout.junctionNodes] as Node[],
    [layout],
  );

  const runExport = async (mode: 'png' | 'print' | 'share') => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const opts = {
        nodes: flowNodes,
        darkMode: settings.theme === 'dark',
        filename: 'family-tree.png',
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
      const saved = await deletePerson(person.id);
      if (!saved) return;
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
      <div className="tree-page-toolbar">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 sm:flex-row sm:items-center">
          <TreeSearch onSelect={focusPerson} large />

          <div className="flex items-center gap-1.5 sm:ml-auto">
            <Link
              to="/members"
              className="btn-secondary !min-h-10 !px-2.5 sm:!px-3"
              aria-label={t('tree.listView')}
            >
              <Users className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('tree.listView')}</span>
            </Link>
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
            <OverflowMenu
              items={[
                {
                  id: 'join',
                  label: t('tree.addYourself'),
                  icon: <UserRoundPlus className="h-4 w-4" aria-hidden />,
                  onClick: () => setJoinOpen(true),
                },
                {
                  id: 'share',
                  label: t('tree.share'),
                  icon: <Share2 className="h-4 w-4" aria-hidden />,
                  onClick: () => void runExport('share'),
                  disabled: exportBusy || flowNodes.length === 0,
                },
                {
                  id: 'png',
                  label: t('tree.pngTitle'),
                  icon: <Download className="h-4 w-4" aria-hidden />,
                  onClick: () => void runExport('png'),
                  disabled: exportBusy || flowNodes.length === 0,
                },
                {
                  id: 'print',
                  label: t('tree.print'),
                  icon: <Printer className="h-4 w-4" aria-hidden />,
                  onClick: () => void runExport('print'),
                  disabled: exportBusy || flowNodes.length === 0,
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1" style={{ minHeight: 'calc(100dvh - 12rem)' }}>
        <div className="absolute inset-0 bg-stone-50 dark:bg-stone-950">
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
    <div className="tree-empty">
      <BrandMark size="lg" className="!h-16 !w-16 !rounded-[1.35rem] shadow-lg ring-1 ring-stone-900/5 dark:ring-white/10" />
      <div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">{t('tree.emptyTitle')}</h1>
        <p className="mt-2 max-w-md text-sm text-stone-500 dark:text-stone-400">{t('tree.emptyText')}</p>
      </div>
      <button type="button" className="btn-primary" onClick={onAdd}>
        <UserPlus className="h-4 w-4" aria-hidden /> {t('tree.emptyBtn')}
      </button>
      {children}
    </div>
  );
}
