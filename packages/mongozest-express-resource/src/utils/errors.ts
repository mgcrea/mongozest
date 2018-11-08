import createError from 'http-errors';
import {Request, Response, NextFunction} from 'express';
import {MongoError} from '@mgcrea/mongozest';

export const mongoErrorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Convert MongoError to HttpErrors
  if (err instanceof MongoError) {
    const {errmsg = '', code} = err;
    // Handle Validation errors
    if (err.code === 121) {
      next(createError(422, errmsg));
      return;
    }
    // Handle duplicate key errors (check me!)
    if (err.code === 110) {
      next(createError(409, errmsg));
      return;
    }
    next(createError(400, errmsg));
    return;
  }
  next(err);
};
