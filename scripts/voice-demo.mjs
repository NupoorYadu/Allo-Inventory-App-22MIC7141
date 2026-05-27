function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function includesAny(source, candidates) {
  return candidates.some((candidate) => source.includes(candidate));
}

function resolveVoiceCommand(transcript) {
  const text = normalize(transcript);
  if (!text) return { type: 'none' };

  if (includesAny(text, ['open inventory dashboard', 'open dashboard', 'go to dashboard', 'show inventory dashboard'])) {
    return { type: 'navigate', tab: 'products', speak: 'Opening the inventory dashboard.' };
  }
  if (includesAny(text, ['show low stock', 'low stock products', 'out of stock', 'likely to go out of stock'])) {
    return { type: 'search', query: transcript, focus: 'products', speak: 'Searching low stock products.' };
  }
  if (includesAny(text, ['show reservation analytics', 'reservation analytics', 'warehouse utilization', 'open warehouse utilization'])) {
    return { type: 'navigate', tab: 'analytics', speak: 'Opening reservation analytics.' };
  }
  if (includesAny(text, ['run concurrency simulator', 'run concurrency test', 'stress test', 'concurrency probe'])) {
    return { type: 'stress', speak: 'Running the concurrency simulator.' };
  }
  if (includesAny(text, ['show expiring reservations', 'expiring reservations', 'reserved expiring soon'])) {
    return { type: 'search', query: transcript, focus: 'reservations', speak: 'Showing expiring reservations.' };
  }
  if (includesAny(text, ['search', 'find', 'show', 'which', 'what', 'open warehouse'])) {
    return { type: 'search', query: transcript, speak: `Searching for ${transcript}.` };
  }

  return { type: 'search', query: transcript, speak: `I heard ${transcript}.` };
}

const samples = [
  'show low stock electronics',
  'run concurrency simulator',
  'show expiring reservations',
  'open reservation analytics',
  'what warehouses are overloaded',
];

for (const text of samples) {
  const result = resolveVoiceCommand(text);
  console.log('Transcript:', text);
  console.log('Resolved:', result);
  console.log('---');
}
