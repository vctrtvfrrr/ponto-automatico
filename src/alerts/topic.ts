export type TopicError = { kind: 'malformed-topic'; value: string }

const TOPIC = /^[-_A-Za-z0-9]{1,64}$/

const SUGGESTED_PREFIX = 'ponto-automatico-'
const SUGGESTED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const SUGGESTED_LENGTH = 16
const UNBIASED_LIMIT = Math.floor(256 / SUGGESTED_ALPHABET.length) * SUGGESTED_ALPHABET.length

// An empty topic is the push turned off, not a mistake.
export function validateTopic(topic: string): TopicError[] {
  if (topic === '' || TOPIC.test(topic)) return []

  return [{ kind: 'malformed-topic', value: topic }]
}

// The prefix is public and predictable, so the whole unpredictability budget
// lives in the drawn characters — on ntfy.sh the topic name is the password.
export function suggestTopic(): string {
  let drawn = ''
  while (drawn.length < SUGGESTED_LENGTH) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0]!
    if (byte < UNBIASED_LIMIT) drawn += SUGGESTED_ALPHABET[byte % SUGGESTED_ALPHABET.length]
  }

  return SUGGESTED_PREFIX + drawn
}
