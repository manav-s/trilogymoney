// Area code to timezone mapping for smart timezone detection
export const areaCodeToTimezone: Record<string, string> = {
  // Eastern Time (EST/EDT)
  '201': 'America/New_York', // New Jersey
  '202': 'America/New_York', // Washington DC
  '203': 'America/New_York', // Connecticut
  '212': 'America/New_York', // NYC
  '215': 'America/New_York', // Philadelphia
  '216': 'America/New_York', // Cleveland
  '301': 'America/New_York', // Maryland
  '302': 'America/New_York', // Delaware
  '305': 'America/New_York', // Miami
  '321': 'America/New_York', // Orlando
  '347': 'America/New_York', // NYC
  '404': 'America/New_York', // Atlanta
  '407': 'America/New_York', // Orlando
  '410': 'America/New_York', // Baltimore
  '412': 'America/New_York', // Pittsburgh
  '413': 'America/New_York', // Western Mass
  '414': 'America/Chicago',   // Milwaukee (Central)
  '415': 'America/Los_Angeles', // San Francisco
  '423': 'America/New_York', // Eastern Tennessee
  '434': 'America/New_York', // Virginia
  '443': 'America/New_York', // Baltimore
  '470': 'America/New_York', // Atlanta
  '475': 'America/New_York', // Connecticut
  '484': 'America/New_York', // Pennsylvania
  '516': 'America/New_York', // Long Island
  '518': 'America/New_York', // Albany
  '561': 'America/New_York', // Palm Beach
  '570': 'America/New_York', // Pennsylvania
  '585': 'America/New_York', // Rochester
  '607': 'America/New_York', // Southern NY
  '610': 'America/New_York', // Pennsylvania
  '631': 'America/New_York', // Long Island
  '646': 'America/New_York', // NYC
  '678': 'America/New_York', // Atlanta
  '703': 'America/New_York', // Northern Virginia
  '704': 'America/New_York', // Charlotte
  '706': 'America/New_York', // Georgia
  '716': 'America/New_York', // Buffalo
  '718': 'America/New_York', // NYC
  '732': 'America/New_York', // New Jersey
  '754': 'America/New_York', // Florida
  '757': 'America/New_York', // Virginia
  '762': 'America/New_York', // Georgia
  '770': 'America/New_York', // Atlanta
  '781': 'America/New_York', // Boston
  '786': 'America/New_York', // Miami
  '804': 'America/New_York', // Richmond
  '813': 'America/New_York', // Tampa
  '828': 'America/New_York', // Western NC
  '845': 'America/New_York', // Hudson Valley
  '857': 'America/New_York', // Boston
  '862': 'America/New_York', // New Jersey
  '863': 'America/New_York', // Central Florida
  '864': 'America/New_York', // South Carolina
  '878': 'America/New_York', // Pennsylvania
  '904': 'America/New_York', // Jacksonville
  '914': 'America/New_York', // Westchester
  '917': 'America/New_York', // NYC
  '929': 'America/New_York', // NYC
  '934': 'America/New_York', // Long Island
  '941': 'America/New_York', // Sarasota
  '954': 'America/New_York', // Fort Lauderdale
  '973': 'America/New_York', // New Jersey

  // Central Time (CST/CDT)
  '205': 'America/Chicago', // Birmingham
  '214': 'America/Chicago', // Dallas
  '217': 'America/Chicago', // Springfield IL
  '224': 'America/Chicago', // Chicago suburbs
  '251': 'America/Chicago', // Mobile
  '256': 'America/Chicago', // Huntsville
  '281': 'America/Chicago', // Houston
  '309': 'America/Chicago', // Peoria
  '312': 'America/Chicago', // Chicago
  '314': 'America/Chicago', // St. Louis
  '318': 'America/Chicago', // Louisiana
  '319': 'America/Chicago', // Iowa
  '331': 'America/Chicago', // Chicago suburbs
  '334': 'America/Chicago', // Montgomery
  '337': 'America/Chicago', // Louisiana
  '346': 'America/Chicago', // Houston
  '361': 'America/Chicago', // Corpus Christi
  '409': 'America/Chicago', // Beaumont
  '414': 'America/Chicago', // Milwaukee
  '430': 'America/Chicago', // Texas
  '432': 'America/Chicago', // Midland
  '469': 'America/Chicago', // Dallas
  '479': 'America/Chicago', // Arkansas
  '501': 'America/Chicago', // Little Rock
  '504': 'America/Chicago', // New Orleans
  '507': 'America/Chicago', // Minnesota
  '512': 'America/Chicago', // Austin
  '515': 'America/Chicago', // Des Moines
  '563': 'America/Chicago', // Iowa
  '573': 'America/Chicago', // Missouri
  '601': 'America/Chicago', // Jackson MS
  '608': 'America/Chicago', // Madison
  '612': 'America/Chicago', // Minneapolis
  '615': 'America/Chicago', // Nashville
  '618': 'America/Chicago', // Southern Illinois
  '630': 'America/Chicago', // Chicago suburbs
  '636': 'America/Chicago', // Missouri
  '651': 'America/Chicago', // St. Paul
  '662': 'America/Chicago', // Mississippi
  '682': 'America/Chicago', // Fort Worth
  '708': 'America/Chicago', // Chicago suburbs
  '713': 'America/Chicago', // Houston
  '715': 'America/Chicago', // Wisconsin
  '731': 'America/Chicago', // Tennessee
  '737': 'America/Chicago', // Austin
  '763': 'America/Chicago', // Minneapolis suburbs
  '773': 'America/Chicago', // Chicago
  '779': 'America/Chicago', // Illinois
  '806': 'America/Chicago', // Lubbock
  '815': 'America/Chicago', // Northern Illinois
  '817': 'America/Chicago', // Fort Worth
  '832': 'America/Chicago', // Houston
  '847': 'America/Chicago', // Chicago suburbs
  '901': 'America/Chicago', // Memphis
  '903': 'America/Chicago', // Tyler
  '913': 'America/Chicago', // Kansas City
  '918': 'America/Chicago', // Tulsa
  '920': 'America/Chicago', // Green Bay
  '936': 'America/Chicago', // Huntsville TX
  '940': 'America/Chicago', // Wichita Falls
  '952': 'America/Chicago', // Minneapolis suburbs
  '956': 'America/Chicago', // Laredo
  '972': 'America/Chicago', // Dallas
  '979': 'America/Chicago', // College Station

  // Mountain Time (MST/MDT)
  '303': 'America/Denver', // Denver
  '307': 'America/Denver', // Wyoming
  '385': 'America/Denver', // Utah
  '406': 'America/Denver', // Montana
  '435': 'America/Denver', // Utah
  '505': 'America/Denver', // New Mexico
  '575': 'America/Denver', // New Mexico
  '601': 'America/Denver', // Wyoming
  '720': 'America/Denver', // Denver
  '801': 'America/Denver', // Salt Lake City
  '928': 'America/Phoenix', // Arizona (no DST)
  '970': 'America/Denver', // Colorado

  // Pacific Time (PST/PDT)
  '206': 'America/Los_Angeles', // Seattle
  '209': 'America/Los_Angeles', // Stockton
  '213': 'America/Los_Angeles', // Los Angeles
  '253': 'America/Los_Angeles', // Tacoma
  '310': 'America/Los_Angeles', // Los Angeles
  '323': 'America/Los_Angeles', // Los Angeles
  '360': 'America/Los_Angeles', // Western Washington
  '408': 'America/Los_Angeles', // San Jose
  '415': 'America/Los_Angeles', // San Francisco
  '424': 'America/Los_Angeles', // Los Angeles
  '442': 'America/Los_Angeles', // San Diego
  '510': 'America/Los_Angeles', // Oakland
  '530': 'America/Los_Angeles', // Northern California
  '559': 'America/Los_Angeles', // Fresno
  '562': 'America/Los_Angeles', // Long Beach
  '619': 'America/Los_Angeles', // San Diego
  '626': 'America/Los_Angeles', // Pasadena
  '628': 'America/Los_Angeles', // San Francisco
  '650': 'America/Los_Angeles', // Peninsula
  '657': 'America/Los_Angeles', // Orange County
  '661': 'America/Los_Angeles', // Bakersfield
  '669': 'America/Los_Angeles', // San Jose
  '707': 'America/Los_Angeles', // Santa Rosa
  '714': 'America/Los_Angeles', // Orange County
  '747': 'America/Los_Angeles', // Los Angeles
  '760': 'America/Los_Angeles', // San Diego
  '805': 'America/Los_Angeles', // Santa Barbara
  '818': 'America/Los_Angeles', // Los Angeles
  '831': 'America/Los_Angeles', // Monterey
  '858': 'America/Los_Angeles', // San Diego
  '909': 'America/Los_Angeles', // Inland Empire
  '916': 'America/Los_Angeles', // Sacramento
  '925': 'America/Los_Angeles', // East Bay
  '949': 'America/Los_Angeles', // Orange County
  '951': 'America/Los_Angeles', // Riverside

  // Alaska
  '907': 'America/Anchorage',

  // Hawaii
  '808': 'Pacific/Honolulu',
};

export const timezoneNames: Record<string, string> = {
  'America/New_York': 'Eastern Time',
  'America/Chicago': 'Central Time', 
  'America/Denver': 'Mountain Time',
  'America/Los_Angeles': 'Pacific Time',
  'America/Phoenix': 'Arizona Time',
  'America/Anchorage': 'Alaska Time',
  'Pacific/Honolulu': 'Hawaii Time',
};

export const allTimezones = [
  { value: "America/New_York", label: "Eastern Time (EST)" },
  { value: "America/Chicago", label: "Central Time (CST)" },
  { value: "America/Denver", label: "Mountain Time (MST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PST)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKST)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];

/**
 * Extract area code from phone number
 */
export function extractAreaCode(phoneNumber: string): string | null {
  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Handle various formats
  if (digits.length === 11 && digits.startsWith('1')) {
    // +1AAANNNNNNN format
    return digits.substring(1, 4);
  } else if (digits.length === 10) {
    // AAANNNNNNN format
    return digits.substring(0, 3);
  }
  
  return null;
}

/**
 * Guess timezone from phone number area code
 */
export function guessTimezoneFromPhone(phoneNumber: string): string | null {
  const areaCode = extractAreaCode(phoneNumber);
  if (!areaCode) return null;
  
  return areaCodeToTimezone[areaCode] || null;
}

/**
 * Get timezone display name
 */
export function getTimezoneDisplayName(timezone: string): string {
  return timezoneNames[timezone] || timezone;
}
