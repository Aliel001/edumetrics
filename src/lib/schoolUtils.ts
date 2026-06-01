/**
 * Standardizes formatting of school IDs into high-contrast user-facing school names.
 * Removes the random 4-digit trailing suffix assigned for tenant separation,
 * and capitalizes each word accordingly.
 */
export function getSchoolNameFromId(schoolId: string | undefined | null): string {
  if (!schoolId || schoolId === 'default-school') return 'Edumetric';
  
  // Remove trailing random 4-digit number
  const namePart = schoolId.replace(/-\d{4}$/, '');
  
  // Replace hyphens with space and capitalize each word
  return namePart
    .split('-')
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .filter(Boolean)
    .join(' ');
}
