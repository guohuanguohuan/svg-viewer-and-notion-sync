export function stripJsonComments(input: string): string {
  let result = ''
  let inString = false
  let isEscaped = false

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index]
    const next = input[index + 1]

    if (inString) {
      result += current

      if (isEscaped) {
        isEscaped = false
      } else if (current === '\\') {
        isEscaped = true
      } else if (current === '"') {
        inString = false
      }

      continue
    }

    if (current === '"') {
      inString = true
      result += current
      continue
    }

    if (current === '/' && next === '/') {
      index += 2
      while (index < input.length && input[index] !== '\n') {
        index += 1
      }
      if (index < input.length) {
        result += input[index]
      }
      continue
    }

    if (current === '/' && next === '*') {
      index += 2
      while (
        index < input.length - 1 &&
        !(input[index] === '*' && input[index + 1] === '/')
      ) {
        index += 1
      }
      index += 1
      continue
    }

    result += current
  }

  return result
}

export function parseJsonWithComments<T>(input: string): T {
  return JSON.parse(stripJsonComments(input)) as T
}
