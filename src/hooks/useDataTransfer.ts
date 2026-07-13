import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { downloadJson, exportFileName, readJsonFile } from '../utils/dataTransfer';
import { fullName, generatePersonId } from '../utils/family';
import { validateFamilyData, validateJoinRequest } from '../utils/validation';

/** Export / import / reset flows shared by the Tree and Settings pages. */
export function useDataTransfer() {
  const { people, addPerson, exportData, replaceAll, resetToSample } = useFamily();
  const { canDelete: isOwner } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();

  const exportJson = useCallback(() => {
    downloadJson(exportData(), exportFileName('family-tree'));
    toast('Family data exported as JSON.');
  }, [exportData, toast]);

  const importFromFile = useCallback(
    async (file: File) => {
      let parsed: unknown;
      try {
        parsed = await readJsonFile(file);
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Could not read the file.', 'error');
        return;
      }
      // A join-request file (from "Add yourself") merges one person into the
      // tree instead of replacing everything.
      const joinRequest = validateJoinRequest(parsed);
      if (joinRequest.isJoinRequest) {
        if (!joinRequest.ok || !joinRequest.person) {
          toast(
            `This join request is invalid: ${joinRequest.errors[0] ?? 'unknown error.'}`,
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
          ? `They will be added as a ${joinRequest.link!.kind} of ${fullName(target)}.`
          : joinRequest.link
            ? 'Their relative was not found in this tree, so they will be added unconnected — edit them afterwards to set their parents or spouse.'
            : 'They chose no connection — edit them afterwards to place them in the tree.';
        const proceed = await confirm({
          title: `Add ${fullName(person)} to the family?`,
          message: `This join request adds one person without touching anyone else. ${connection}`,
          confirmLabel: 'Add person',
        });
        if (!proceed) return;
        addPerson(person, target ? joinRequest.link! : undefined);
        toast(`${fullName(person)} was added to the family.`);
        return;
      }

      // Replacing the entire dataset is destructive — owner only. (Join
      // requests above are additive, so family editors may import those.)
      if (!isOwner) {
        toast(
          'Only the owner can replace the whole family data. You can still import join-request files.',
          'error',
        );
        return;
      }

      const result = validateFamilyData(parsed);
      if (!result.ok || !result.data) {
        const detail = result.errors.slice(0, 2).join(' ');
        toast(`Import failed: ${detail || 'invalid family data.'}`, 'error');
        return;
      }
      const proceed = await confirm({
        title: 'Replace family data?',
        message: `This will replace the current ${people.length} people with the ${result.data.people.length} people from "${file.name}". Consider exporting a backup first.`,
        confirmLabel: 'Replace data',
        danger: true,
      });
      if (!proceed) return;
      replaceAll(result.data.people);
      toast(`Imported ${result.data.people.length} people.`);
    },
    [addPerson, confirm, isOwner, people, replaceAll, toast],
  );

  const resetSample = useCallback(async () => {
    if (!isOwner) {
      toast('Only the owner can reset the family data.', 'error');
      return;
    }
    const proceed = await confirm({
      title: 'Restore the website’s built-in data?',
      message:
        'All changes saved in this browser will be discarded and the family data that ships with the website will be restored. Export a backup first if you want to keep your work.',
      confirmLabel: 'Restore data',
      danger: true,
    });
    if (!proceed) return;
    resetToSample();
    toast('Website’s built-in family data restored.');
  }, [confirm, isOwner, resetToSample, toast]);

  return { exportJson, importFromFile, resetSample };
}
