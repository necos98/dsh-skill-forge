// test/helpers.mjs — shared test helpers.
export function fakeExec(sessionId) {
  return { agent: { session: { header: { id: sessionId } } } };
}

export function fakeRegistry(records) {
  return { list: () => records };
}
