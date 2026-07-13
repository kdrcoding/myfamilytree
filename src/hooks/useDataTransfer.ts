import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { useT } from '../i18n/useT';
import { downloadJson, exportFileName, readJsonFile } from '../utils/dataTransfer';
import { fullName, generatePersonId } from '../utils/family';
import { validateFamilyData, validateJoinRequest } from '../utils/validation';

/** Export / import / restore flows shared by the Tree and Settings pages. */
export function useDataTransfer() {
  const { people, addPerson, exportData, replaceAll, resetToSample } = useFamily();
  const { canDelete: isOwner } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();
  const t = useT();

  const exportJson = useCallback(() => {
    downloadJson(exportData(), exportFileName('family-tree'));
    toast(t('data.exported'));
  }, [exportData, toast, t]);

  const importFromFile = useCallback(
    async (file: File) => {
      let parsed: unknown;
      try {
        parsed = await readJsonFile(file);
      } catch {
        toast(t('data.readFail'), 'error');
        return;
      }
      // A join-request file (from "Add yourself") merges one person into the
      // tree instead of replacing everything.
      const joinRequest = validateJoinRequest(parsed);
      if (joinRequest.isJoinRequest) {
        if (!joinRequest.ok || !joinRequest.person) {
          toast(
            t('data.joinInvalid', { err: joinRequest.errors[0] ?? t('data.joinUnknown') }),
            'error',
          );
          return;
        }
        let person = joinRequest.person;
        if (people.some((p) => p.id === person.id)) {
          person = {
            ...person,
            id: generatePersonId(
              person.firstName,
              person.lastName,
              new Set(people.map((p) => p.id)),
            ),
          };
        }
        const target = joinRequest.link
          ? people.find((p) => p.id === joinRequest.link!.targetId)
          : undefined;
        const connection = target
          ? t('data.joinConnAs', {
              kind: t(`relkind.${joinRequest.link!.kind}`),
              name: fullName(target),
            })
          : joinRequest.link
            ? t('data.joinConnMissing')
            : t('data.joinConnNone');
        const proceed = await confirm({
          title: t('data.joinTitle', { name: fullName(person) }),
          message: t('data.joinMsg', { connection }),
          confirmLabel: t('data.joinAddBtn'),
        });
        if (!proceed) return;
        addPerson(person, target ? joinRequest.link! : undefined);
        toast(t('data.joinAdded', { name: fullName(person) }));
        return;
      }

      // Replacing the entire dataset is destructive — owner only. (Join
      // requests above are additive, so family editors may import those.)
      if (!isOwner) {
        toast(t('data.ownerOnlyReplace'), 'error');
        return;
      }

      const result = validateFamilyData(parsed);
      if (!result.ok || !result.data) {
        const detail = result.errors.slice(0, 2).join(' ');
        toast(t('data.importFailed', { detail: detail || t('data.invalidData') }), 'error');
        return;
      }
      const proceed = await confirm({
        title: t('data.replaceTitle'),
        message: t('data.replaceMsg', {
          current: people.length,
          next: result.data.people.length,
          file: file.name,
        }),
        confirmLabel: t('data.replaceBtn'),
        danger: true,
      });
      if (!proceed) return;
      replaceAll(result.data.people);
      toast(t('data.imported', { n: result.data.people.length }));
    },
    [addPerson, confirm, isOwner, people, replaceAll, toast, t],
  );

  const resetSample = useCallback(async () => {
    if (!isOwner) {
      toast(t('data.ownerOnlyReset'), 'error');
      return;
    }
    const proceed = await confirm({
      title: t('data.restoreTitle'),
      message: t('data.restoreMsg'),
      confirmLabel: t('data.restoreBtn'),
      danger: true,
    });
    if (!proceed) return;
    resetToSample();
    toast(t('data.restored'));
  }, [confirm, isOwner, resetToSample, toast, t]);

  return { exportJson, importFromFile, resetSample };
}
