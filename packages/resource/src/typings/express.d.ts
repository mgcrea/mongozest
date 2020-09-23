import 'express';

declare global {
  namespace Express {
    interface Request {
      extraParams?: Record<string, string>;
    }
  }
}
