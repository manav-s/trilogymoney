/**
 * Timezone detection from phone area codes
 * US/Canada area code → timezone mapping
 */

export interface TimezoneInfo {
  timezone: string;
  displayName: string;
}

// Area code to timezone mapping (US/Canada)
const AREA_CODE_TIMEZONES: Record<string, string> = {
  // Pacific Time (PST/PDT)
  '206': 'America/Los_Angeles', // Seattle
  '213': 'America/Los_Angeles', // Los Angeles
  '310': 'America/Los_Angeles', // Los Angeles
  '323': 'America/Los_Angeles', // Los Angeles
  '415': 'America/Los_Angeles', // San Francisco
  '503': 'America/Los_Angeles', // Portland
  '510': 'America/Los_Angeles', // Oakland
  '619': 'America/Los_Angeles', // San Diego
  '626': 'America/Los_Angeles', // Pasadena
  '650': 'America/Los_Angeles', // San Mateo
  '714': 'America/Los_Angeles', // Orange County
  '760': 'America/Los_Angeles', // San Diego
  '805': 'America/Los_Angeles', // Santa Barbara
  '818': 'America/Los_Angeles', // Burbank
  '858': 'America/Los_Angeles', // San Diego
  '909': 'America/Los_Angeles', // San Bernardino
  '916': 'America/Los_Angeles', // Sacramento
  '925': 'America/Los_Angeles', // Contra Costa
  '949': 'America/Los_Angeles', // Irvine
  
  // Mountain Time (MST/MDT)
  '303': 'America/Denver', // Denver
  '385': 'America/Denver', // Salt Lake City
  '480': 'America/Phoenix', // Phoenix (observes MST year-round)
  '505': 'America/Denver', // Albuquerque
  '602': 'America/Phoenix', // Phoenix
  '623': 'America/Phoenix', // Phoenix
  '702': 'America/Denver', // Las Vegas
  '719': 'America/Denver', // Colorado Springs
  '720': 'America/Denver', // Denver
  '801': 'America/Denver', // Salt Lake City
  '970': 'America/Denver', // Fort Collins
  
  // Central Time (CST/CDT)
  '210': 'America/Chicago', // San Antonio
  '214': 'America/Chicago', // Dallas
  '281': 'America/Chicago', // Houston
  '312': 'America/Chicago', // Chicago
  '314': 'America/Chicago', // St. Louis
  '405': 'America/Chicago', // Oklahoma City
  '469': 'America/Chicago', // Dallas
  '512': 'America/Chicago', // Austin
  '515': 'America/Chicago', // Des Moines
  '573': 'America/Chicago', // Columbia MO
  '612': 'America/Chicago', // Minneapolis
  '630': 'America/Chicago', // Chicago suburbs
  '651': 'America/Chicago', // St. Paul
  '682': 'America/Chicago', // Fort Worth
  '713': 'America/Chicago', // Houston
  '773': 'America/Chicago', // Chicago
  '817': 'America/Chicago', // Fort Worth
  '832': 'America/Chicago', // Houston
  '901': 'America/Chicago', // Memphis
  '913': 'America/Chicago', // Kansas City
  '918': 'America/Chicago', // Tulsa
  '972': 'America/Chicago', // Dallas
  
  // Eastern Time (EST/EDT)
  '202': 'America/New_York', // DC
  '212': 'America/New_York', // NYC
  '215': 'America/New_York', // Philadelphia
  '267': 'America/New_York', // Philadelphia
  '301': 'America/New_York', // Maryland
  '305': 'America/New_York', // Miami
  '315': 'America/New_York', // Syracuse
  '347': 'America/New_York', // NYC
  '404': 'America/New_York', // Atlanta
  '407': 'America/New_York', // Orlando
  '410': 'America/New_York', // Baltimore
  '470': 'America/New_York', // Atlanta
  '516': 'America/New_York', // Long Island
  '561': 'America/New_York', // West Palm Beach
  '617': 'America/New_York', // Boston
  '646': 'America/New_York', // NYC
  '678': 'America/New_York', // Atlanta
  '718': 'America/New_York', // NYC
  '754': 'America/New_York', // Fort Lauderdale
  '786': 'America/New_York', // Miami
  '813': 'America/New_York', // Tampa
  '917': 'America/New_York', // NYC
  '929': 'America/New_York', // NYC
  '954': 'America/New_York', // Fort Lauderdale
};

/**
 * Detect timezone from phone number (E.164 format)
 */
export function detectTimezone(phone: string): TimezoneInfo | null {
  // Extract area code from E.164 format (+1XXXXXXXXXX)
  const match = phone.match(/^\+1(\d{3})/);
  if (!match) {
    return null;
  }

  const areaCode = match[1];
  const timezone = AREA_CODE_TIMEZONES[areaCode];

  if (!timezone) {
    return null;
  }

  return {
    timezone,
    displayName: getTimezoneDisplayName(timezone),
  };
}

/**
 * Get human-readable timezone name
 */
export function getTimezoneDisplayName(timezone: string): string {
  const names: Record<string, string> = {
    'America/New_York': 'Eastern Time (ET)',
    'America/Chicago': 'Central Time (CT)',
    'America/Denver': 'Mountain Time (MT)',
    'America/Phoenix': 'Arizona Time (AZ)',
    'America/Los_Angeles': 'Pacific Time (PT)',
    'America/Anchorage': 'Alaska Time (AKT)',
    'Pacific/Honolulu': 'Hawaii Time (HT)',
  };

  return names[timezone] || timezone;
}

/**
 * All US timezones for manual selection
 */
export const US_TIMEZONES: TimezoneInfo[] = [
  { timezone: 'America/New_York', displayName: 'Eastern Time (ET)' },
  { timezone: 'America/Chicago', displayName: 'Central Time (CT)' },
  { timezone: 'America/Denver', displayName: 'Mountain Time (MT)' },
  { timezone: 'America/Phoenix', displayName: 'Arizona Time (AZ)' },
  { timezone: 'America/Los_Angeles', displayName: 'Pacific Time (PT)' },
  { timezone: 'America/Anchorage', displayName: 'Alaska Time (AKT)' },
  { timezone: 'Pacific/Honolulu', displayName: 'Hawaii Time (HT)' },
];

