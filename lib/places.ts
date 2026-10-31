export const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// Suggestions for the city field; any US city can be typed.
export const MAJOR_CITIES = [
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ", "Philadelphia, PA",
  "San Antonio, TX", "San Diego, CA", "Dallas, TX", "Jacksonville, FL", "Fort Worth, TX", "San Jose, CA",
  "Austin, TX", "Charlotte, NC", "Columbus, OH", "Indianapolis, IN", "San Francisco, CA", "Seattle, WA",
  "Denver, CO", "Oklahoma City, OK", "Nashville, TN", "Washington, DC", "El Paso, TX", "Las Vegas, NV",
  "Boston, MA", "Detroit, MI", "Portland, OR", "Louisville, KY", "Memphis, TN", "Baltimore, MD",
  "Milwaukee, WI", "Albuquerque, NM", "Tucson, AZ", "Fresno, CA", "Sacramento, CA", "Mesa, AZ",
  "Atlanta, GA", "Kansas City, MO", "Colorado Springs, CO", "Omaha, NE", "Raleigh, NC", "Miami, FL",
  "Minneapolis, MN", "Tampa, FL", "New Orleans, LA", "Cleveland, OH", "Pittsburgh, PA", "Salt Lake City, UT",
];

const STATE_BY_NAME = Object.fromEntries(Object.entries(STATES).map(([code, name]) => [name.toLowerCase(), code]));

export function stateCode(input: string): string | undefined {
  const s = input.trim().replace(/\.$/, "");
  if (STATES[s.toUpperCase()]) return s.toUpperCase();
  return STATE_BY_NAME[s.toLowerCase()];
}

// "Austin, TX" / "Austin, Texas" -> { city, state }
export function parsePlace(input: string): { city: string; state: string } | undefined {
  const m = input.match(/^\s*([^,]+?)\s*,\s*([A-Za-z .]+?)\s*$/);
  if (!m) return undefined;
  const state = stateCode(m[2]);
  return state ? { city: m[1], state } : undefined;
}

// Pulls "in Austin, Texas" out of a sentence like "Starting a coffee cart in Austin, Texas".
export function placeFromSentence(sentence: string): { city: string; state: string } | undefined {
  const m = sentence.match(/\b(?:in|near|around)\s+([A-Z][A-Za-z .'-]+?)\s*,\s*([A-Za-z .]+?)\s*[.!]?\s*$/);
  if (!m) return undefined;
  const state = stateCode(m[2]);
  return state ? { city: m[1].trim(), state } : undefined;
}
