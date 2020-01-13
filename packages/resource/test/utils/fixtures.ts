import {ObjectId} from 'mongodb';

// eslint-disable-next-line @typescript-eslint/camelcase
export const user_mongozest = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@gmail.com',
  device: new ObjectId('1a1a836f1cf9087b520148de')
};

// eslint-disable-next-line @typescript-eslint/camelcase
export const comment_mongozest = {
  text: 'Hello World'
};
