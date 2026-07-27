import { useEffect, useState } from 'react';
import { Check, Loader2, UserRoundPlus, X } from 'lucide-react';
import { useFamily } from '../context/FamilyContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useLanguage, useT } from '../i18n/useT';
import {
  listPendingJoinRequests,
  markJoinRequestApproved,
  rejectJoinRequest,
} from '../lib/joinRequests';
import type { StoredJoinRequest } from '../lib/joinRequests';
import { fullName, generatePersonId } from '../utils/family';
import { Avatar } from '../components/Avatar';

/**
 * Owner inbox: approve or reject "Add yourself" submissions from the database.
 */
export function JoinRequestsCard() {
  const t = useT();
  const language = useLanguage();
  const { people, addPerson } = useFamily();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [requests, setRequests] = useState<StoredJoinRequest[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => {
    listPendingJoinRequests().then(
      (rows) => {
        setRequests(rows);
        setUnavailable(false);
      },
      (error: unknown) => {
        console.error('Failed to load join requests:', error);
        setUnavailable(true);
      },
    );
  };

  useEffect(refresh, []);

  const approve = async (req: StoredJoinRequest) => {
    const name = fullName(req.person);
    const ok = await confirm({
      title: t('joinReq.approveTitle', { name }),
      message: req.link_target_name
        ? t('joinReq.approveMsgLinked', {
            name,
            target: req.link_target_name,
          })
        : t('joinReq.approveMsg', { name }),
      confirmLabel: t('joinReq.approve'),
    });
    if (!ok) return;

    setBusyId(req.id);
    try {
      // Avoid colliding with someone already on the tree.
      const existing = new Set(people.map((p) => p.id));
      let person = req.person;
      if (existing.has(person.id)) {
        const newId = generatePersonId(person.firstName, person.lastName, existing);
        person = { ...person, id: newId };
      }
      addPerson(person, req.link ?? undefined);
      await markJoinRequestApproved(req.id);
      toast(t('joinReq.approvedToast', { name: fullName(person) }));
      refresh();
    } catch (error) {
      console.error(error);
      toast(t('joinReq.actionFailed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (req: StoredJoinRequest) => {
    const name = fullName(req.person);
    const ok = await confirm({
      title: t('joinReq.rejectTitle', { name }),
      message: t('joinReq.rejectMsg'),
      confirmLabel: t('joinReq.reject'),
      danger: true,
    });
    if (!ok) return;

    setBusyId(req.id);
    try {
      await rejectJoinRequest(req.id);
      toast(t('joinReq.rejectedToast', { name }));
      refresh();
    } catch (error) {
      console.error(error);
      toast(t('joinReq.actionFailed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card mt-4 p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <UserRoundPlus className="h-5 w-5 text-emerald-600" aria-hidden /> {t('joinReq.title')}
        {requests.length > 0 && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
            {requests.length}
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t('joinReq.intro')}</p>

      {unavailable && (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {t('joinReq.setupNeeded')}
        </p>
      )}

      {!unavailable && requests.length === 0 && (
        <p className="mt-3 text-sm text-stone-400">{t('joinReq.empty')}</p>
      )}

      {!unavailable && requests.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
          {requests.map((req) => {
            const name = fullName(req.person);
            const busy = busyId === req.id;
            return (
              <li key={req.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar person={req.person} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900 dark:text-stone-100">{name}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {req.link_target_name
                      ? t('joinReq.linkedAs', { target: req.link_target_name })
                      : t('joinReq.unlinked')}
                    {req.submitter_name ? ` · ${req.submitter_name}` : ''}
                    {' · '}
                    {new Date(req.submitted_at).toLocaleString(
                      language === 'uz' ? 'uz-UZ' : 'en-GB',
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary !px-3"
                    disabled={busy}
                    onClick={() => void approve(req)}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden />
                    )}
                    {t('joinReq.approve')}
                  </button>
                  <button
                    type="button"
                    className="btn-danger !px-3"
                    disabled={busy}
                    onClick={() => void reject(req)}
                  >
                    <X className="h-4 w-4" aria-hidden />
                    {t('joinReq.reject')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
