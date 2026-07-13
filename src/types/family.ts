export type Gender = 'male' | 'female' | 'unspecified';

export interface FamilyPerson {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  gender: Gender;
  /** ISO date: "YYYY", "YYYY-MM" or "YYYY-MM-DD". */
  birthDate?: string;
  /** ISO date: "YYYY", "YYYY-MM" or "YYYY-MM-DD". */
  deathDate?: string;
  isDeceased: boolean;
  /** URL or data-URL. Empty means "use a generated initials avatar". */
  photo?: string;
  city?: string;
  country?: string;
  occupation?: string;
  biography?: string;
  parentIds: string[];
  spouseIds: string[];
  childIds: string[];
}

/** Versioned wrapper stored in LocalStorage and used for import/export. */
export interface FamilyData {
  version: number;
  exportedAt?: string;
  people: FamilyPerson[];
}

export const FAMILY_DATA_VERSION = 1;

export type Theme = 'light' | 'dark';

export interface PrivacySettings {
  enabled: boolean;
  hideBirthDates: boolean;
  hideDeathDates: boolean;
  hideMinorAges: boolean;
  hideCities: boolean;
  hideOccupations: boolean;
  hideBiographies: boolean;
  hidePhotos: boolean;
}

export type AppLanguage = 'uz' | 'en';

export interface AppSettings {
  theme: Theme;
  /** UI language. Uzbek is the default; English is the second option. */
  language: AppLanguage;
  privacy: PrivacySettings;
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  enabled: false,
  hideBirthDates: true,
  hideDeathDates: false,
  hideMinorAges: true,
  hideCities: true,
  hideOccupations: false,
  hideBiographies: false,
  hidePhotos: false,
};

/** How a newly created person is attached to an existing one. */
export type RelationKind = 'spouse' | 'child' | 'parent' | 'sibling';

/**
 * A "join request": one person plus how they connect to the family, produced
 * by the public "Add yourself" flow. Visitors download this small file and
 * send it to the owner, who imports it to merge the person into the tree.
 */
export const JOIN_REQUEST_TYPE = 'familytree-join-request';

export interface JoinRequest {
  type: typeof JOIN_REQUEST_TYPE;
  version: number;
  submittedAt?: string;
  person: FamilyPerson;
  link?: RelationLink | null;
  /** Human-readable helper so the owner can eyeball the file. */
  linkTargetName?: string;
  note?: string;
}

export interface RelationLink {
  kind: RelationKind;
  targetId: string;
  /**
   * For kind "child": the child's other parent. Matters when the target has
   * been married more than once. `undefined` = default to the first spouse,
   * `null` = no second parent, a person id = that specific spouse/partner.
   */
  secondParentId?: string | null;
}
