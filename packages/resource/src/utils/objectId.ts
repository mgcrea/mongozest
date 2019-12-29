import {intersectionWith, unionWith, uniqBy, uniqWith} from 'lodash';

export const includesObjectId = (arrayOfObjectIds, targetObjectId) =>
  arrayOfObjectIds.some(objectId => objectId.equals(targetObjectId));
export const intersectionWithObjectIds = (...arraysOfObjectIds) =>
  intersectionWith(...arraysOfObjectIds, (arrVal, othVal) => arrVal.equals(othVal));
export const unionWithObjectIds = (...arraysOfObjectIds) =>
  unionWith(...arraysOfObjectIds, (arrVal, othVal) => arrVal.equals(othVal));
export const uniqWithObjectIds = arrayOfObjectIds =>
  uniqWith(arrayOfObjectIds, (arrVal, othVal) => arrVal.equals(othVal));
export const uniqByObjectId = arrayOfObjects => uniqBy(arrayOfObjects, arrVal => arrVal._id.toString());
