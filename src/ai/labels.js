// Deterministic UUID → human-readable label mapping.
// Algorithm adapted from humanhash (public domain).
// Compresses 16 UUID bytes to 3 via XOR, maps each to a word from a 256-word list.
// Collision rate: ~1 in 16.7M — negligible for viewport-sized object sets.

export const WORDLIST = [
  'ack', 'alabama', 'alanine', 'alaska', 'alpha', 'angel', 'apart', 'april',
  'arizona', 'arkansas', 'artist', 'asparagus', 'aspen', 'august', 'autumn',
  'avocado', 'bacon', 'bakerloo', 'batman', 'beer', 'berlin', 'beryllium',
  'black', 'blossom', 'blue', 'bluebird', 'bravo', 'bulldog', 'burger',
  'butter', 'california', 'carbon', 'cardinal', 'carolina', 'carpet', 'cat',
  'ceiling', 'charlie', 'chicken', 'coffee', 'cola', 'cold', 'colorado',
  'comet', 'connecticut', 'crazy', 'cup', 'dakota', 'december', 'delaware',
  'delta', 'diet', 'don', 'double', 'early', 'earth', 'east', 'echo',
  'edward', 'eight', 'eighteen', 'eleven', 'emma', 'enemy', 'equal',
  'failed', 'fanta', 'fifteen', 'fillet', 'finch', 'fish', 'five', 'fix',
  'floor', 'florida', 'football', 'four', 'fourteen', 'foxtrot', 'freddie',
  'friend', 'fruit', 'gee', 'georgia', 'glucose', 'golf', 'green', 'grey',
  'hamper', 'happy', 'harry', 'hawaii', 'helium', 'high', 'hot', 'hotel',
  'hydrogen', 'idaho', 'illinois', 'india', 'indigo', 'ink', 'iowa',
  'island', 'item', 'jersey', 'jig', 'johnny', 'juliet', 'july', 'jupiter',
  'kansas', 'kentucky', 'kilo', 'king', 'kitten', 'lactose', 'lake', 'lamp',
  'lemon', 'leopard', 'lima', 'lion', 'lithium', 'london', 'louisiana',
  'low', 'magazine', 'magnesium', 'maine', 'mango', 'march', 'mars',
  'maryland', 'massachusetts', 'may', 'mexico', 'michigan', 'mike',
  'minnesota', 'mirror', 'mississippi', 'missouri', 'mobile', 'mockingbird',
  'monkey', 'montana', 'moon', 'mountain', 'muppet', 'music', 'nebraska',
  'neptune', 'network', 'nevada', 'nine', 'nineteen', 'nitrogen', 'north',
  'november', 'nuts', 'october', 'ohio', 'oklahoma', 'one', 'orange',
  'oranges', 'oregon', 'oscar', 'oven', 'oxygen', 'papa', 'paris', 'pasta',
  'pennsylvania', 'pip', 'pizza', 'pluto', 'potato', 'princess', 'purple',
  'quebec', 'queen', 'quiet', 'red', 'river', 'robert', 'robin', 'romeo',
  'rugby', 'sad', 'salami', 'saturn', 'september', 'seven', 'seventeen',
  'shade', 'sierra', 'single', 'sink', 'six', 'sixteen', 'skylark', 'snake',
  'social', 'sodium', 'solar', 'south', 'spaghetti', 'speaker', 'spring',
  'stairway', 'steak', 'stream', 'summer', 'sweet', 'table', 'tango', 'ten',
  'tennessee', 'tennis', 'texas', 'thirteen', 'three', 'timing', 'triple',
  'twelve', 'twenty', 'two', 'uncle', 'undress', 'uniform', 'uranus', 'utah',
  'vegan', 'venus', 'vermont', 'victor', 'video', 'violet', 'virginia',
  'washington', 'west', 'whiskey', 'white', 'william', 'winner', 'winter',
  'wisconsin', 'wolfram', 'wyoming', 'xray', 'yankee', 'yellow', 'zebra',
  'zulu',
];

const WORDS = 3;
const SEPARATOR = ' ';

const compress = (bytes, target) => {
  const segSize = (bytes.length / target) >> 0;
  const result = [];
  for (let i = 0; i < target; i++) {
    const start = i * segSize;
    const end = i === target - 1 ? bytes.length : start + segSize;
    let xor = 0;
    for (let j = start; j < end; j++) xor ^= bytes[j];
    result.push(xor);
  }
  return result;
};

export const uuidToLabel = (uuid) => {
  const hex = uuid.replace(/-/g, '');
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return compress(bytes, WORDS).map((b) => WORDLIST[b]).join(SEPARATOR);
};
