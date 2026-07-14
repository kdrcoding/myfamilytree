import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ImagePlus, Search, X } from 'lucide-react';
import type { FamilyPerson, Gender, JoinRequest, RelationLink } from '../types/family';
import { JOIN_REQUEST_TYPE } from '../types/family';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { useToast } from '../context/ToastContext';
import { useT } from '../i18n/useT';
import type { TKey } from '../i18n/translations';
import { downloadJson } from '../utils/dataTransfer';
import { fullName, generatePersonId, sortByBirth } from '../utils/family';
import { downscalePhoto } from '../utils/image';
import { validatePersonForm, canLink } from '../utils/validation';
import type { PersonFormValues } from '../utils/validation';
import { Avatar } from './Avatar';
import { Modal } from './ui/Modal';

interface PersonFormModalProps {
  /** Person being edited; omit to create a new person. */
  person?: FamilyPerson;
  /** When creating, optionally attach the new person to an existing one. */
  link?: RelationLink;
  /**
   * "Add yourself" mode: no password needed. Saves the person locally and
   * additionally downloads a join-request file to send to the family owner.
   */
  selfJoin?: boolean;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

// Generous input limit — the photo is downscaled to ~100-250 KB before it
// is stored, so even large phone camera originals are fine to pick.
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

const KIND_KEYS = {
  spouse: 'relkind.spouse',
  child: 'relkind.child',
  parent: 'relkind.parent',
  sibling: 'relkind.sibling',
} as const;

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </label>
  );
}

/** Searchable checkbox list used for selecting parents and spouses. */
function PeoplePicker({
  label,
  candidates,
  selected,
  onToggle,
  maxSelected,
  disabledReason,
}: {
  label: string;
  candidates: FamilyPerson[];
  selected: string[];
  onToggle: (id: string) => void;
  maxSelected?: number;
  disabledReason: (id: string) => string | null;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const filtered = candidates.filter((p) =>
    fullName(p).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const full = maxSelected !== undefined && selected.length >= maxSelected;

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
        {maxSelected !== undefined && (
          <span className="ml-1 font-normal text-stone-400">
            ({selected.length}/{maxSelected})
          </span>
        )}
      </span>
      <div className="rounded-xl border border-stone-300 dark:border-stone-600">
        <div className="flex items-center gap-2 border-b border-stone-200 px-3 py-2 dark:border-stone-700">
          <Search className="h-3.5 w-3.5 text-stone-400" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('form.searchIn', { label })}
            className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
          />
        </div>
        <ul className="max-h-36 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-stone-400">{t('form.noMatches')}</li>
          )}
          {filtered.map((p) => {
            const checked = selected.includes(p.id);
            const reason = checked ? null : disabledReason(p.id);
            const disabled = !checked && (reason !== null || full);
            return (
              <li key={p.id}>
                <label
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                    disabled
                      ? 'cursor-not-allowed opacity-40'
                      : 'cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                  title={reason ? t(reason as TKey) : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggle(p.id)}
                    className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="truncate">{fullName(p)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function PersonFormModal({
  person,
  link,
  selfJoin,
  onClose,
  onSaved,
}: PersonFormModalProps) {
  const { people, index, getPerson, addPerson, updatePerson } = useFamily();
  const { canDelete: isOwner } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const isEdit = person !== undefined;
  // Family editors may only fill in MISSING info on existing people; fields
  // that already have a value are locked, and relationships are owner-only.
  const restricted = isEdit && !isOwner;
  const lockText = (value: string | undefined) => restricted && Boolean(value?.trim());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<PersonFormValues>({
    firstName: person?.firstName ?? '',
    lastName: person?.lastName ?? (link ? (getPerson(link.targetId)?.lastName ?? '') : ''),
    nickname: person?.nickname ?? '',
    gender: person?.gender ?? 'unspecified',
    birthDate: person?.birthDate ?? '',
    deathDate: person?.deathDate ?? '',
    isDeceased: person?.isDeceased ?? false,
    photo: person?.photo ?? '',
    city: person?.city ?? '',
    country: person?.country ?? '',
    occupation: person?.occupation ?? '',
    biography: person?.biography ?? '',
  });
  const [parentIds, setParentIds] = useState<string[]>(person?.parentIds ?? []);
  const [spouseIds, setSpouseIds] = useState<string[]>(person?.spouseIds ?? []);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const linkTarget = link ? getPerson(link.targetId) : undefined;
  // When adding a child of someone who has (or had) more than one partner,
  // the child's other parent must be chosen explicitly. '' = no second parent.
  const [otherParentId, setOtherParentId] = useState<string>(linkTarget?.spouseIds[0] ?? '');
  const askOtherParent =
    !isEdit && link?.kind === 'child' && (linkTarget?.spouseIds.length ?? 0) > 0;
  const candidates = useMemo(
    () => [...people].sort(sortByBirth).filter((p) => p.id !== person?.id),
    [people, person?.id],
  );

  const set = <K extends keyof PersonFormValues>(key: K, value: PersonFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const err = (key?: string) => (key ? t(key as TKey) : undefined);

  const onPhotoFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      toast(t('form.photoTooBig'), 'error');
      return;
    }
    // Photos are downscaled to a small JPEG before storing — phone camera
    // originals are megabytes and would make the site slow for everyone.
    downscalePhoto(file).then(
      (dataUrl) => set('photo', dataUrl),
      (error: unknown) => {
        console.error('Photo processing failed:', error);
        toast(t('form.photoReadFail'), 'error');
      },
    );
  };

  /** Validate and save. Returns true on success; does NOT close the modal. */
  const doSave = (): boolean => {
    const fieldErrors = validatePersonForm(values);

    if (isEdit && !restricted) {
      for (const parentId of parentIds) {
        const problem = canLink(people, 'parent-child', parentId, person.id);
        if (problem && !person.parentIds.includes(parentId)) fieldErrors.relationships = problem;
      }
      for (const spouseId of spouseIds) {
        const problem = canLink(people, 'spouse', person.id, spouseId);
        if (problem && !person.spouseIds.includes(spouseId)) fieldErrors.relationships = problem;
      }
    }

    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return false;

    const trimmed = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      nickname: values.nickname.trim() || undefined,
      gender: values.gender,
      birthDate: values.birthDate.trim() || undefined,
      deathDate: values.deathDate.trim() || undefined,
      isDeceased: values.isDeceased,
      photo: values.photo || undefined,
      city: values.city.trim() || undefined,
      country: values.country.trim() || undefined,
      occupation: values.occupation.trim() || undefined,
      biography: values.biography.trim() || undefined,
    };

    const personLabel =
      [trimmed.firstName, trimmed.lastName].filter(Boolean).join(' ') ||
      trimmed.nickname ||
      t('form.thisPerson');

    if (isEdit) {
      updatePerson({ ...person, ...trimmed }, parentIds, spouseIds);
      toast(
        restricted
          ? t('form.updatedRestrictedToast', { name: personLabel })
          : t('form.updatedToast', { name: personLabel }),
      );
      onSaved?.(person.id);
    } else {
      const id = generatePersonId(
        trimmed.firstName || trimmed.nickname || '',
        trimmed.lastName,
        new Set(people.map((p) => p.id)),
      );
      const effectiveLink =
        link && link.kind === 'child' ? { ...link, secondParentId: otherParentId || null } : link;
      const newPerson = { id, ...trimmed, parentIds: [], spouseIds: [], childIds: [] };
      addPerson(newPerson, effectiveLink);
      if (selfJoin) {
        const request: JoinRequest = {
          type: JOIN_REQUEST_TYPE,
          version: 1,
          submittedAt: new Date().toISOString(),
          person: newPerson,
          link: effectiveLink ?? null,
          linkTargetName: linkTarget ? fullName(linkTarget) : undefined,
          note: 'Send this file to the family tree owner so they can import you into the published tree.',
        };
        downloadJson(request, `join-request-${id}.json`);
        toast(t('form.selfJoinToast'), 'info');
      } else {
        toast(t('form.addedToast', { name: personLabel }));
      }
      onSaved?.(id);
    }
    return true;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (doSave()) onClose();
  };

  /** Save this person, then clear the form for the next one (same family). */
  const saveAndAddAnother = () => {
    if (!doSave()) return;
    setValues((v) => ({
      ...v,
      firstName: '',
      nickname: '',
      gender: 'unspecified',
      birthDate: '',
      deathDate: '',
      isDeceased: false,
      photo: '',
      occupation: '',
      biography: '',
      // lastName, city and country are kept — siblings usually share them.
    }));
    setErrors({});
    firstNameRef.current?.focus();
  };

  const title = selfJoin
    ? t('form.titleSelf')
    : isEdit
      ? t('form.titleEdit', { name: fullName(person) })
      : linkTarget
        ? t('form.titleAddKind', { kind: t(KIND_KEYS[link!.kind]), name: fullName(linkTarget) })
        : t('form.titleAdd');

  return (
    <Modal onClose={onClose} labelledBy="person-form-title" size="lg">
      <form onSubmit={submit} noValidate>
        <h2
          id="person-form-title"
          className="text-lg font-semibold text-stone-900 dark:text-stone-100"
        >
          {title}
        </h2>
        {!isEdit && (
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t('form.oneNameHint')}</p>
        )}
        {restricted && (
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {t('form.restrictedNote')}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('form.firstName')} error={err(errors.firstName)}>
            <input
              type="text"
              className="input"
              value={values.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              disabled={lockText(person?.firstName)}
              ref={firstNameRef}
              autoFocus
            />
          </Field>
          <Field label={t('form.lastName')} error={err(errors.lastName)}>
            <input
              type="text"
              className="input"
              value={values.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              disabled={lockText(person?.lastName)}
            />
          </Field>
          <Field label={t('form.gender')}>
            <select
              className="input"
              value={values.gender}
              onChange={(e) => set('gender', e.target.value as Gender)}
              disabled={restricted && person!.gender !== 'unspecified'}
            >
              <option value="unspecified">{t('filters.unspecified')}</option>
              <option value="female">{t('filters.female')}</option>
              <option value="male">{t('filters.male')}</option>
            </select>
          </Field>
        </div>

        {/* Everything beyond name + gender is optional and stays out of the
            way, so adding a person takes seconds. */}
        <details
          className="mt-4 rounded-xl border border-stone-200 dark:border-stone-700"
          open={isEdit}
        >
          <summary className="cursor-pointer select-none rounded-xl px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800/60">
            {t('form.moreDetails')}
          </summary>
          <div className="grid grid-cols-1 gap-4 border-t border-stone-200 p-4 sm:grid-cols-2 dark:border-stone-700">
            <Field label={t('form.nickname')}>
              <input
                type="text"
                className="input"
                value={values.nickname}
                onChange={(e) => set('nickname', e.target.value)}
                disabled={lockText(person?.nickname)}
              />
            </Field>
            <Field label={t('form.birthDate')} error={err(errors.birthDate)}>
              <input
                type="text"
                className="input"
                placeholder={t('form.datePlaceholder')}
                value={values.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
                disabled={lockText(person?.birthDate)}
              />
            </Field>
            <div>
              <label className="flex h-full items-center gap-2 pt-6 text-sm text-stone-700 dark:text-stone-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  checked={values.isDeceased}
                  disabled={restricted && person!.isDeceased}
                  onChange={(e) => {
                    set('isDeceased', e.target.checked);
                    if (!e.target.checked) set('deathDate', '');
                  }}
                />
                {t('form.deceasedCheck')}
              </label>
            </div>
            {values.isDeceased && (
              <Field label={t('form.deathDate')} error={err(errors.deathDate)}>
                <input
                  type="text"
                  className="input"
                  placeholder={t('form.datePlaceholder')}
                  value={values.deathDate}
                  onChange={(e) => set('deathDate', e.target.value)}
                  disabled={lockText(person?.deathDate)}
                />
              </Field>
            )}
            <Field label={t('form.city')}>
              <input
                type="text"
                className="input"
                value={values.city}
                onChange={(e) => set('city', e.target.value)}
                disabled={lockText(person?.city)}
              />
            </Field>
            <Field label={t('form.country')}>
              <input
                type="text"
                className="input"
                value={values.country}
                onChange={(e) => set('country', e.target.value)}
                disabled={lockText(person?.country)}
              />
            </Field>
            <Field label={t('form.occupation')}>
              <input
                type="text"
                className="input"
                value={values.occupation}
                onChange={(e) => set('occupation', e.target.value)}
                disabled={lockText(person?.occupation)}
              />
            </Field>
            <Field label={t('form.bio')} className="sm:col-span-2">
              <textarea
                className="input min-h-20"
                value={values.biography}
                onChange={(e) => set('biography', e.target.value)}
                disabled={lockText(person?.biography)}
              />
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                {t('form.photo')}
              </span>
              <div className="flex items-center gap-3">
                {values.photo ? (
                  <img
                    src={values.photo}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow dark:ring-stone-700"
                  />
                ) : person ? (
                  <Avatar person={person} />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 text-stone-400 dark:bg-stone-800">
                    <ImagePlus className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onPhotoFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={lockText(person?.photo)}
                >
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  {values.photo ? t('form.photoChange') : t('form.photoUpload')}
                </button>
                {values.photo && !lockText(person?.photo) && (
                  <button type="button" className="btn-secondary" onClick={() => set('photo', '')}>
                    <X className="h-4 w-4" aria-hidden /> {t('form.photoRemove')}
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-stone-400">{t('form.photoNote')}</p>
            </div>
          </div>
        </details>

        {isEdit && restricted && (
          <p className="mt-5 border-t border-stone-200 pt-4 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
            {t('form.relOwnerNote')}
          </p>
        )}
        {isEdit && !restricted && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-stone-200 pt-4 sm:grid-cols-2 dark:border-stone-700">
            <PeoplePicker
              label={t('form.parents')}
              candidates={candidates}
              selected={parentIds}
              maxSelected={2}
              onToggle={(id) =>
                setParentIds((ids) =>
                  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
                )
              }
              disabledReason={(id) => canLink(people, 'parent-child', id, person.id)}
            />
            <PeoplePicker
              label={t('form.spouses')}
              candidates={candidates}
              selected={spouseIds}
              onToggle={(id) =>
                setSpouseIds((ids) =>
                  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
                )
              }
              disabledReason={(id) => canLink(people, 'spouse', person.id, id)}
            />
            {errors.relationships && (
              <p role="alert" className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">
                {t(errors.relationships as TKey)}
              </p>
            )}
          </div>
        )}

        {askOtherParent && linkTarget && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/50">
            <Field label={t('form.otherParent', { name: fullName(linkTarget) })}>
              <select
                className="input"
                value={otherParentId}
                onChange={(e) => setOtherParentId(e.target.value)}
              >
                {linkTarget.spouseIds
                  .map((id) => index.get(id))
                  .filter((p): p is FamilyPerson => p !== undefined)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {fullName(p)}
                    </option>
                  ))}
                <option value="">{t('form.otherParentNone')}</option>
              </select>
            </Field>
            <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
              {t('form.otherParentHint', {
                name: fullName(linkTarget),
                count: linkTarget.spouseIds.length,
              })}
            </p>
          </div>
        )}

        {!isEdit && linkTarget && (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
            {t('form.willBeAdded', {
              kind: t(KIND_KEYS[link!.kind]),
              names:
                askOtherParent && otherParentId && index.get(otherParentId)
                  ? `${fullName(linkTarget)} + ${fullName(index.get(otherParentId)!)}`
                  : fullName(linkTarget),
            })}
          </p>
        )}

        {/* Sticky action bar: Save is always reachable, even mid-scroll on a
            long form — crucial on phones. */}
        {/* Sticky save bar. The modal panel has bottom padding inside its
            scroll area; the negative bottom/margin let the bar cover that
            strip so scrolled content never peeks out underneath it. */}
        <div className="sticky bottom-[calc(-1*max(1.25rem,env(safe-area-inset-bottom)))] z-10 -mx-5 mb-[calc(-1*max(1.25rem,env(safe-area-inset-bottom)))] mt-6 flex flex-wrap justify-end gap-2 border-t border-stone-200 bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-stone-700 dark:bg-stone-900">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          {!isEdit && !selfJoin && (
            <button
              type="button"
              className="btn-secondary"
              onClick={saveAndAddAnother}
              title={t('form.saveAnotherTitle')}
            >
              {t('form.saveAnother')}
            </button>
          )}
          <button type="submit" className="btn-primary flex-1 sm:flex-none">
            {selfJoin ? t('form.addMe') : isEdit ? t('form.save') : t('form.add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
