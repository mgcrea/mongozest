import {ObjectId} from 'mongodb';
export * from './plugins';

import Model from './model';
// import Plugin from './plugin';
import Interface from './interface';

export {Interface, Model, ObjectId};

export default Interface.create;
