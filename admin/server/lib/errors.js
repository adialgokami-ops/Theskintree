/**
 * Custom Server Errors
 */

export class ForbiddenError extends Error {
  constructor(message = 'Access forbidden.') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
    this.code = 'FORBIDDEN';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
    this.code = 'UNAUTHORIZED';
  }
}
