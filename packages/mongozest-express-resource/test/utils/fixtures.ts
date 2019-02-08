import {ObjectId} from '@mgcrea/mongozest';
const user = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@gmail.com',
  device: new ObjectId('1a1a836f1cf9087b520148de')
};

const comment = {
  text: 'Hello World'
};

export {user, comment};
