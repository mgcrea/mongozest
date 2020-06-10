import {intersectionWith, unionWith, uniqBy, uniqWith} from 'lodash';
import {ObjectId} from 'mongodb';

export const includesObjectId = (arrayOfObjectIds: ObjectId[], targetObjectId: ObjectId): boolean =>
  arrayOfObjectIds.some((objectId) => objectId.equals(targetObjectId));

export const intersectionWithObjectIds = (...arraysOfObjectIds: ObjectId[][]): ObjectId[] =>
  intersectionWith<ObjectId, ObjectId>(...arraysOfObjectIds, (arrVal: ObjectId, othVal: ObjectId) =>
    arrVal.equals(othVal)
  );

export const unionWithObjectIds = (...arraysOfObjectIds: ObjectId[][]): ObjectId[] =>
  unionWith<ObjectId>(...arraysOfObjectIds, (arrVal: ObjectId, othVal: ObjectId) => arrVal.equals(othVal));

export const uniqWithObjectIds = (arrayOfObjectIds: ObjectId[]): ObjectId[] =>
  uniqWith(arrayOfObjectIds, (arrVal, othVal) => arrVal.equals(othVal));

export const uniqByObjectId = <T extends {_id: ObjectId}>(arrayOfObjects: T[]): T[] =>
  uniqBy(arrayOfObjects, (arrVal) => arrVal._id.toString());
