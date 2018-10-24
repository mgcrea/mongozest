// describe('test', () => {
//   jest.setTimeout(10000);
//   it('should work', async () => {
//     d('in!');
//     return await [1, 2, 3].reduce(async (soFar, value) => {
//       await soFar;
//       d('about to start', value);
//       const result = new Promise((resolve, reject) =>
//         setTimeout(() => {
//           d('about to resolve', value);
//           expect(2).toEqual(2);
//           resolve(value);
//         }, 1000)
//       );
//       return result;
//     }, Promise.resolve([]));
//   });
// });
import Hooks from './../../../src/utils/hooks';

require('debug-utils').default();

describe('Hooks', () => {
  let hooks: Hooks;
  it('should properly be constructed', async () => {
    hooks = new Hooks();
    expect(hooks instanceof Hooks).toBeTruthy();
  });
  // describe('should properly cast an `objectId` bsonType', () => {
  //   it('from a `string`', async () => {
  //     const {ops, insertedId} = await TestModel.insertOne({
  //       objectIdValue: '5bcdc07ffd331bc20d10f2d7'
  //     });
  //     // Check op result
  //     const insertedDoc = ops[0];
  //     expect(ObjectId.isValid(insertedDoc.objectIdValue)).toBeTruthy();
  //     expect(insertedDoc.objectIdValue.toString()).toEqual('5bcdc07ffd331bc20d10f2d7');
  //     // Check findOne result
  //     const foundDoc = await TestModel.findOne({_id: insertedId});
  //     expect(ObjectId.isValid(foundDoc.objectIdValue)).toBeTruthy();
  //     expect(foundDoc.objectIdValue.toString()).toEqual('5bcdc07ffd331bc20d10f2d7');
  //   });
  // });
});
