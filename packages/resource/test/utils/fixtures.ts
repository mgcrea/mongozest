import { ObjectId } from 'mongodb';

export const user_mongozest = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@gmail.com',
  device: new ObjectId('1a1a836f1cf9087b520148de'),
};

export const user_mongozest_2 = {
  firstName: 'Alice',
  lastName: 'Garden',
  email: 'alice.garden@gmail.com',
  device: new ObjectId('1a1a836f1cf9087b520148df'),
};

export const comment_mongozest = {
  text: 'Hello World',
};
