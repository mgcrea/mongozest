import createError from 'http-errors';
import {Request, Response, NextFunction} from 'express';
import {MongoError} from '@mgcrea/mongozest';

export const mongoErrorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Convert MongoError to HttpErrors
  if (err instanceof MongoError) {
    const {message, errmsg, code} = err;
    const errorMessage = errmsg || message || 'Unknown Mongo Error';
    // Handle Validation errors
    if (err.code === 121) {
      next(createError(422, errorMessage));
      return;
    }
    // Handle duplicate key errors (check me!)
    if (err.code === 110) {
      next(createError(409, errorMessage));
      return;
    }
    next(createError(400, errorMessage));
    return;
  }
  next(err);
};
