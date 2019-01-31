import createError from 'http-errors';
import {Request, Response, NextFunction} from 'express';
import {MongoError} from '@mgcrea/mongozest';

export const mongoErrorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Convert MongoError to HttpErrors
  if (err instanceof MongoError) {
    const {message, errmsg, code = 0} = err;
    const errorMessage = errmsg || message || 'Unknown Mongo Error';
    // Handle Validation errors
    if (code === 121) {
      next(createError(422, errorMessage));
      return;
    }
    // Handle duplicate key errors (check me!)
    if ([110, 11000].includes(code)) {
      next(createError(409, errorMessage));
      return;
    }
    next(createError(400, errorMessage));
    return;
  }
  next(err);
};
