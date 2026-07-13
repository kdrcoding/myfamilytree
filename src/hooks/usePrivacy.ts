import { useSettings } from '../context/SettingsContext';
import type { FamilyPerson } from '../types/family';
import { isMinor } from '../utils/dates';

/**
 * Central place that decides which fields may be displayed under the current
 * privacy settings. Every component reads through these helpers so public
 * privacy mode is applied consistently.
 */
export function usePrivacy() {
  const { settings } = useSettings();
  const p = settings.privacy;
  const on = p.enabled;

  return {
    privacyEnabled: on,
    showBirthDate: () => !(on && p.hideBirthDates),
    showDeathDate: () => !(on && p.hideDeathDates),
    showAge: (person: FamilyPerson) =>
      !(on && p.hideMinorAges && isMinor(person.birthDate, person.deathDate)),
    showCity: () => !(on && p.hideCities),
    showOccupation: () => !(on && p.hideOccupations),
    showBiography: () => !(on && p.hideBiographies),
    showPhoto: () => !(on && p.hidePhotos),
  };
}
