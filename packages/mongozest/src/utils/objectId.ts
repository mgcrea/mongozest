import {intersectionWith, unionWith, uniqBy, uniqWith} from 'lodash';
import {ObjectId} from 'mongodb';

export const includesObjectId = (arrayOfObjectIds: ObjectId[], targetObjectId: ObjectId) =>
  arrayOfObjectIds.some(objectId => objectId.equals(targetObjectId));

export const intersectionWithObjectIds = (...arraysOfObjectIds: ObjectId[]) =>
  intersectionWith<ObjectId, ObjectId>(...arraysOfObjectIds, (arrVal: ObjectId, othVal: ObjectId) =>
    arrVal.equals(othVal)
  );

export const unionWithObjectIds = (...arraysOfObjectIds: ObjectId[]) =>
  unionWith<ObjectId>(...arraysOfObjectIds, (arrVal: ObjectId, othVal: ObjectId) => arrVal.equals(othVal));

export const uniqWithObjectIds = (arrayOfObjectIds: ObjectId[]) =>
  uniqWith(arrayOfObjectIds, (arrVal, othVal) => arrVal.equals(othVal));

export const uniqByObjectId = (arrayOfObjects: {_id: ObjectId}[]) =>
  uniqBy(arrayOfObjects, arrVal => arrVal._id.toString());
