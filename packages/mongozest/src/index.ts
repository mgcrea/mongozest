export * from './plugins';

import Model from './model';
// import Plugin from './plugin';
import Interface from './interface';

export {Interface, Model};
export {ObjectId, MongoError} from 'mongodb';

export default Interface.create;
