export class HttpError extends Error {
  constructor(status, code, message, fields) { super(message); this.status = status; this.code = code; this.fields = fields; }
}
export function fail(status, code, message, fields) { throw new HttpError(status, code, message, fields); }
